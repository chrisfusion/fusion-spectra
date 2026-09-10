import { ref, onUnmounted } from 'vue'
import * as forgeApi from '@/api/forgeApi'
import * as weaveApi from '@/api/weaveApi'
import { ApiError } from '@/api/bffClient'

// Shared by every "Git -> <something>" shortcut wizard (GitPythonJobWizardPage,
// GitBatchJobWizardPage, ...): GitWatcher -> build -> "stable" tag -> job
// blueprint -> run blueprint (chain). Wizard-specific trigger creation stays
// in each wizard — the shapes diverge there (one trigger per entrypoint file
// with a parameterOverride vs. a single fixed trigger that gets fired).

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

  function extractAppBuildId(lastBuildName: string): number | null {
    const m = lastBuildName.match(/^forge-app-(\d+)$/)
    return m ? Number(m[1]) : null
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

  async function waitForBuild(name: string): Promise<forgeApi.AppBuild> {
    await sleep(2_000)

    let lastBuildName: string | null = null
    for (let i = 0; i < 60 && !cancelled; i++) {
      const w = await forgeApi.getGitWatcher(name)
      if (w.status.lastBuildName) { lastBuildName = w.status.lastBuildName; break }
      await sleep(5_000)
    }
    if (!lastBuildName) {
      throw new Error('Timed out waiting for the first build to start — the watcher may still be polling. Check its detail page.')
    }

    const id = extractAppBuildId(lastBuildName)
    if (id === null) {
      throw new Error(`Unrecognized build name "${lastBuildName}".`)
    }

    for (let i = 0; i < 120 && !cancelled; i++) {
      const b = await forgeApi.getAppBuild(id)
      if (b.status === 'SUCCEEDED' || b.status === 'FAILED') return b
      await sleep(5_000)
    }
    throw new Error('Timed out waiting for the build to finish.')
  }

  async function ensureJobTemplate(name: string, build: forgeApi.AppBuild): Promise<void> {
    try {
      const existing = await weaveApi.getJobTemplate(name)
      if (existing.spec.codeSource?.artifactName !== build.name) {
        throw new Error(`A job blueprint named "${name}" already exists but points at a different artifact — choose a different job name.`)
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        await weaveApi.createJobTemplate({
          metadata: { name },
          spec: {
            image:     DEFAULT_RUNNER_IMAGE,
            resources: DEFAULT_RESOURCES,
            codeSource: { artifactName: build.name, tag: 'stable' },
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
