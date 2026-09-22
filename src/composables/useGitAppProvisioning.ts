import { ref, onUnmounted } from 'vue'
import * as forgeApi from '@/api/forgeApi'
import * as weaveApi from '@/api/weaveApi'
import { ApiError } from '@/api/bffClient'

// Shared by the one remaining client-side-orchestrated shortcut wizard,
// GitPythonJobWizardPage: GitWatcher -> build -> "stable" tag -> job
// blueprint -> run blueprint (chain). Git -> Batch Job and Git -> BatchCron
// Job were both migrated onto the fusion-wizard backend (WizardRunPage.vue
// + the batch-git-job / batchcron-git-job WizardDefinitions) and no longer
// use this composable — see PLAN_fusion_wizard.md. Python Job stays here
// until the step catalogue supports per-entrypoint Cron schedules.

// Job-kind steps never read resources/runner image from metadata.yaml (verified
// in fusion-flux/internal/jobbuilder/builder.go) so these have to live somewhere
// until the deferred cores/runner-type presets land.
export const DEFAULT_RUNNER_IMAGE = 'fusion-runner-python312:local'
export const DEFAULT_RESOURCES: weaveApi.ResourceRequirements = {
  requests: { cpu: '250m', memory: '256Mi' },
  limits:   { cpu: '1',    memory: '1Gi' },
}

export type ProgressStatus = 'pending' | 'running' | 'done' | 'error'
export interface ProgressItem {
  key:     string
  label:   string
  status:  ProgressStatus
  detail?: string
}

// fusion-forge always publishes app-builds to fusion-index under "app.<build.name>"
// (confirmed against a live artifact: build.name "wizard-batch-test-job" published
// as fullName "app.wizard-batch-test-job") — build.name itself is NOT the artifact
// name codeSource needs to resolve.
function appBuildArtifactName(build: forgeApi.AppBuild): string {
  return `app.${build.name}`
}

export function toK8sName(s: string, max = 63): string {
  let out = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (!out) out = 'x'
  if (out.length > max) out = out.slice(0, max).replace(/-+$/, '')
  return out
}

export interface GitAppRepoParams {
  name:       string
  repoUrl:    string
  repoRef:    string
  projectDir: string
}

export function useGitAppProvisioning() {
  const progress       = ref<ProgressItem[]>([])
  const provisionError = ref<string | null>(null)
  const resolvedBuild  = ref<forgeApi.AppBuild | null>(null)
  // Orphan-recovery ref, per this repo's multi-step wizard convention — the
  // watcher already exists once this is set, so a retry never re-creates it.
  const createdWatcherName = ref<string | null>(null)

  let cancelled = false
  onUnmounted(() => { cancelled = true })

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  function setStatus(key: string, status: ProgressStatus, detail?: string) {
    const item = progress.value.find(p => p.key === key)
    if (item) { item.status = status; item.detail = detail }
  }

  async function ensureGitWatcher(params: GitAppRepoParams): Promise<void> {
    const { name, repoUrl, repoRef, projectDir } = params
    try {
      const existing = await forgeApi.getGitWatcher(name)
      const sameRepo =
        existing.spec.buildType === 'app' &&
        existing.spec.repoURL === repoUrl &&
        (existing.spec.projectDir ?? '') === (projectDir || '')
      if (!sameRepo) {
        throw new Error(`A GitOps watcher named "${name}" already exists for a different repository/subfolder — choose a different job name.`)
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        await forgeApi.createGitWatcher({
          name,
          repo_url:    repoUrl,
          repo_ref:    repoRef || undefined,
          build_type:  'app',
          project_dir: projectDir || undefined,
        })
        return
      }
      throw e
    }
  }

  // Polls fusion-forge's own appbuilds list (filtered by name) rather than the
  // GitWatcher CR's status.lastBuildName — that field is transient (cleared once
  // status.lastBuiltVersion is set) and a fast build can finish between the
  // initial delay and the first poll, so a build can complete without this
  // wizard ever observing lastBuildName set at all.
  //
  // GET /appbuilds (list) reads straight from Postgres with no sync; only
  // GET /appbuilds/:id lazily syncs the underlying CIBuild CR's status into
  // the DB row (fusion-forge internal/api/handlers/appbuilds.go). Polling
  // list alone can never observe SUCCEEDED/FAILED even after the build
  // actually finishes — so once the build's id is known, switch to polling
  // it by id instead, which is what actually triggers that sync.
  async function waitForBuild(name: string): Promise<forgeApi.AppBuild> {
    await sleep(2_000)

    let buildId: number | null = null
    for (let i = 0; i < 120 && !cancelled; i++) {
      if (buildId === null) {
        const page = await forgeApi.listAppBuilds({ name, pageSize: 5 })
        const latest = page.items.reduce<forgeApi.AppBuild | null>(
          (best, b) => (!best || b.id > best.id) ? b : best, null)
        if (latest) {
          buildId = latest.id
          if (latest.status === 'SUCCEEDED' || latest.status === 'FAILED') return latest
        }
      } else {
        const build = await forgeApi.getAppBuild(buildId)
        if (build.status === 'SUCCEEDED' || build.status === 'FAILED') return build
      }
      await sleep(5_000)
    }
    throw new Error('Timed out waiting for the build to start/finish — the watcher may still be polling. Check its detail page.')
  }

  async function ensureJobTemplate(name: string, build: forgeApi.AppBuild): Promise<void> {
    try {
      const existing = await weaveApi.getJobTemplate(name)
      if (existing.spec.codeSource?.artifactName !== appBuildArtifactName(build)) {
        throw new Error(`A job blueprint named "${name}" already exists but points at a different artifact — choose a different job name.`)
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        await weaveApi.createJobTemplate({
          metadata: { name },
          spec: {
            image:     DEFAULT_RUNNER_IMAGE,
            resources: DEFAULT_RESOURCES,
            codeSource: { artifactName: appBuildArtifactName(build), tag: 'stable' },
          },
        })
        return
      }
      throw e
    }
  }

  async function ensureChain(name: string): Promise<void> {
    try {
      const existing = await weaveApi.getWeaveChain(name)
      if (!existing.spec.steps.some(s => s.jobTemplateRef?.name === name)) {
        throw new Error(`A run blueprint named "${name}" already exists but doesn't reference this job blueprint — choose a different job name.`)
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        await weaveApi.createWeaveChain({
          metadata: { name },
          spec: { steps: [{ name: 'run', stepKind: 'Job', jobTemplateRef: { name } }] },
        })
        return
      }
      throw e
    }
  }

  return {
    progress,
    provisionError,
    resolvedBuild,
    createdWatcherName,
    isCancelled: () => cancelled,
    setStatus,
    ensureGitWatcher,
    waitForBuild,
    ensureJobTemplate,
    ensureChain,
  }
}
