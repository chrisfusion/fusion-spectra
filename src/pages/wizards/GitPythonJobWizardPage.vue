<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import CronPicker from '@/components/CronPicker.vue'
import * as forgeApi from '@/api/forgeApi'
import * as weaveApi from '@/api/weaveApi'
import * as indexApi from '@/api/indexApi'
import { ApiError } from '@/api/bffClient'

const router = useRouter()

// ─── Placeholders — replace once the preset/template system exists ────────────
// Job-kind steps never read resources/runner image from metadata.yaml (verified
// in fusion-flux/internal/jobbuilder/builder.go) so these have to live somewhere
// until the deferred cores/runner-type presets land.
const DEFAULT_RUNNER_IMAGE = 'fusion-runner-python312:local'
const DEFAULT_RESOURCES: weaveApi.ResourceRequirements = {
  requests: { cpu: '250m', memory: '256Mi' },
  limits:   { cpu: '1',    memory: '1Gi' },
}

// ─── Wizard state ──────────────────────────────────────────────────────────────

const step       = ref<1 | 2 | 3>(1)
const stepLabels = ['Setup', 'Provisioning', 'Done'] as const

// ─── Step 1 fields ──────────────────────────────────────────────────────────────

const jobName    = ref('')
const repoUrl    = ref('')
const repoRef    = ref('')
const projectDir = ref('')

interface EntrypointConfig {
  file:        string
  triggerType: 'OnDemand' | 'Cron'
  schedule:    string
}
const entrypointConfigs = ref<EntrypointConfig[]>([])
const newEntrypoint     = ref('')
const newEntrypointErr  = ref<string | null>(null)

const ENTRYPOINT_RE = /^[A-Za-z0-9_.-]+\.py$/

function addEntrypoint() {
  const val = newEntrypoint.value.trim()
  if (!val) return
  if (!ENTRYPOINT_RE.test(val)) {
    newEntrypointErr.value = 'Must be a .py filename (letters, digits, _ . - only)'
    return
  }
  if (entrypointConfigs.value.some(c => c.file === val)) {
    newEntrypointErr.value = 'Already added'
    return
  }
  entrypointConfigs.value.push({ file: val, triggerType: 'OnDemand', schedule: '0 9 * * *' })
  newEntrypoint.value    = ''
  newEntrypointErr.value = null
}
function removeEntrypoint(file: string) {
  entrypointConfigs.value = entrypointConfigs.value.filter(c => c.file !== file)
}
function onEntrypointKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addEntrypoint()
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────────

const jobNameErr    = ref<string | null>(null)
const repoUrlErr    = ref<string | null>(null)
const projectDirErr = ref<string | null>(null)
const entrypointsErr = ref<string | null>(null)

const K8S_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/
const URL_RE       = /^https?:\/\/.+/

function validateStep1(): boolean {
  let ok = true
  const name = jobName.value.trim()

  if (!name) {
    jobNameErr.value = 'Name is required'
    ok = false
  } else if (!K8S_NAME_RE.test(name)) {
    jobNameErr.value = 'Lowercase letters, digits and hyphens only; must start and end with alphanumeric'
    ok = false
  } else if (name.length > 253) {
    jobNameErr.value = 'Max 253 characters'
    ok = false
  } else {
    jobNameErr.value = null
  }

  if (!repoUrl.value.trim()) {
    repoUrlErr.value = 'Repository URL is required'
    ok = false
  } else if (!URL_RE.test(repoUrl.value.trim())) {
    repoUrlErr.value = 'Must be an HTTP(S) URL'
    ok = false
  } else {
    repoUrlErr.value = null
  }

  if (projectDir.value.trim()) {
    if (projectDir.value.trim().startsWith('/') || projectDir.value.includes('..')) {
      projectDirErr.value = 'Must be a relative path without ..'
      ok = false
    } else {
      projectDirErr.value = null
    }
  } else {
    projectDirErr.value = null
  }

  if (entrypointConfigs.value.length === 0) {
    entrypointsErr.value = 'Add at least one entrypoint file'
    ok = false
  } else {
    entrypointsErr.value = null
  }

  return ok
}

// ─── Provisioning ───────────────────────────────────────────────────────────────

type ProgressStatus = 'pending' | 'running' | 'done' | 'error'
interface ProgressItem {
  key:     string
  label:   string
  status:  ProgressStatus
  detail?: string
}

const progress        = ref<ProgressItem[]>([])
const provisionError  = ref<string | null>(null)
const resolvedBuild   = ref<forgeApi.AppBuild | null>(null)
// Orphan-recovery ref, per this repo's multi-step wizard convention — the
// watcher already exists once this is set, so a retry never re-creates it.
const createdWatcherName = ref<string | null>(null)

let cancelled = false
onUnmounted(() => { cancelled = true })

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function initProgress() {
  progress.value = [
    { key: 'watcher',  label: 'GitOps watcher',         status: 'pending' },
    { key: 'build',    label: 'Building artifact',       status: 'pending' },
    { key: 'tag',      label: 'Assigning "stable" tag',  status: 'pending' },
    { key: 'template', label: 'Job blueprint',           status: 'pending' },
    { key: 'chain',    label: 'Run blueprint (chain)',   status: 'pending' },
    ...entrypointConfigs.value.map(c => ({
      key: `trigger:${c.file}`, label: `Trigger — ${c.file}`, status: 'pending' as ProgressStatus,
    })),
  ]
}
function setStatus(key: string, status: ProgressStatus, detail?: string) {
  const item = progress.value.find(p => p.key === key)
  if (item) { item.status = status; item.detail = detail }
}

function extractAppBuildId(lastBuildName: string): number | null {
  const m = lastBuildName.match(/^forge-app-(\d+)$/)
  return m ? Number(m[1]) : null
}

async function ensureGitWatcher(): Promise<void> {
  const name = jobName.value.trim()
  try {
    const existing = await forgeApi.getGitWatcher(name)
    const sameRepo =
      existing.spec.buildType === 'app' &&
      existing.spec.repoURL === repoUrl.value.trim() &&
      (existing.spec.projectDir ?? '') === (projectDir.value.trim() || '')
    if (!sameRepo) {
      throw new Error(`A GitOps watcher named "${name}" already exists for a different repository/subfolder — choose a different job name.`)
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      await forgeApi.createGitWatcher({
        name,
        repo_url:    repoUrl.value.trim(),
        repo_ref:    repoRef.value.trim() || undefined,
        build_type:  'app',
        project_dir: projectDir.value.trim() || undefined,
      })
      return
    }
    throw e
  }
}

async function waitForBuild(): Promise<forgeApi.AppBuild> {
  const name = jobName.value.trim()
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

async function ensureJobTemplate(build: forgeApi.AppBuild): Promise<void> {
  const name = jobName.value.trim()
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

async function ensureChain(): Promise<void> {
  const name = jobName.value.trim()
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

function toK8sName(s: string, max = 63): string {
  let out = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (!out) out = 'x'
  if (out.length > max) out = out.slice(0, max).replace(/-+$/, '')
  return out
}
function triggerNameFor(build: forgeApi.AppBuild, file: string): string {
  const base = file.replace(/\.py$/i, '')
  return toK8sName(`${build.name}-${base}`)
}

async function ensureTrigger(cfg: EntrypointConfig, build: forgeApi.AppBuild): Promise<void> {
  const chainName    = jobName.value.trim()
  const triggerName  = triggerNameFor(build, cfg.file)
  try {
    await weaveApi.getWeaveTrigger(triggerName)
    // Already exists — assume it was created by a previous run of this wizard
    // for the same job name + entrypoint; nothing else to do.
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      const spec: weaveApi.WeaveTriggerSpec = {
        chainRef: { name: chainName },
        type: cfg.triggerType,
        parameterOverrides: [{ name: 'ENTRYPOINT', value: cfg.file }],
      }
      if (cfg.triggerType === 'Cron') spec.schedule = cfg.schedule
      await weaveApi.createWeaveTrigger({ metadata: { name: triggerName }, spec })
      return
    }
    throw e
  }
}

async function runProvisioning() {
  provisionError.value = null
  try {
    setStatus('watcher', 'running')
    createdWatcherName.value = jobName.value.trim()
    await ensureGitWatcher()
    setStatus('watcher', 'done')

    setStatus('build', 'running')
    const build = await waitForBuild()
    if (cancelled) return
    if (build.status === 'FAILED') {
      setStatus('build', 'error', 'Build failed.')
      provisionError.value = 'The first build failed. fusion-forge will retry automatically on its own schedule — click Retry to keep watching, or open the watcher/build detail pages for logs.'
      return
    }
    resolvedBuild.value = build
    setStatus('build', 'done')

    setStatus('tag', 'running')
    await indexApi.putTag(build.indexArtifactId!, 'stable', build.indexArtifactVersion ?? build.version)
    setStatus('tag', 'done')

    setStatus('template', 'running')
    await ensureJobTemplate(build)
    setStatus('template', 'done')

    setStatus('chain', 'running')
    await ensureChain()
    setStatus('chain', 'done')

    for (const cfg of entrypointConfigs.value) {
      setStatus(`trigger:${cfg.file}`, 'running')
      await ensureTrigger(cfg, build)
      setStatus(`trigger:${cfg.file}`, 'done')
    }

    step.value = 3
  } catch (e) {
    provisionError.value = e instanceof Error ? e.message : 'Something went wrong'
    const running = progress.value.find(p => p.status === 'running')
    if (running) running.status = 'error'
  }
}

async function startWizard() {
  if (!validateStep1()) return
  step.value = 2
  initProgress()
  await runProvisioning()
}

async function retry() {
  await runProvisioning()
}

function createAnother() {
  jobName.value    = ''
  repoUrl.value    = ''
  repoRef.value    = ''
  projectDir.value = ''
  entrypointConfigs.value = []
  newEntrypoint.value     = ''
  newEntrypointErr.value  = null
  progress.value          = []
  provisionError.value    = null
  resolvedBuild.value     = null
  createdWatcherName.value = null
  step.value = 1
}

const STATUS_ICON: Record<ProgressStatus, string> = {
  pending: 'mdi-circle-outline',
  running: 'mdi-loading',
  done:    'mdi-check-circle-outline',
  error:   'mdi-alert-circle-outline',
}
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/wizards')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Wizards
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">Git → Python Job</span>
    </div>

    <CanvasPanel title="Git → Python Job Wizard" icon="mdi-creation" :wide="true">

      <!-- Step indicator -->
      <div class="wizard-steps">
        <div
          v-for="(label, i) in stepLabels"
          :key="label"
          class="wizard-step"
          :class="{ 'wizard-step--active': step === i + 1, 'wizard-step--done': step > i + 1 }"
        >
          <div class="wizard-step__dot">
            <q-icon v-if="step > i + 1" name="mdi-check" size="11px" />
            <span v-else>{{ i + 1 }}</span>
          </div>
          <span class="wizard-step__label">{{ label }}</span>
          <div v-if="i < stepLabels.length - 1" class="wizard-step__line" />
        </div>
      </div>

      <!-- ── Step 1: Setup ── -->
      <div v-if="step === 1" class="form-body">

        <div class="form-section-title">Identity</div>

        <div class="form-row">
          <label class="form-label">Job Name <span class="required">*</span></label>
          <div class="field-wrap">
            <input
              v-model="jobName"
              class="fs-input fs-mono"
              :class="{ 'fs-input--error': jobNameErr }"
              placeholder="my-scripts"
            />
            <span v-if="jobNameErr" class="field-error">{{ jobNameErr }}</span>
            <span v-else class="field-hint">Shared Kubernetes name for the watcher, chain, and job blueprint</span>
          </div>
        </div>

        <div class="form-section-title">Repository</div>

        <div class="form-row">
          <label class="form-label">Repo URL <span class="required">*</span></label>
          <div class="field-wrap">
            <input
              v-model="repoUrl"
              class="fs-input fs-mono"
              :class="{ 'fs-input--error': repoUrlErr }"
              placeholder="https://github.com/org/repo"
            />
            <span v-if="repoUrlErr" class="field-error">{{ repoUrlErr }}</span>
            <span v-else class="field-hint">Public HTTP(S) git URL</span>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">Ref</label>
          <div class="field-wrap">
            <input v-model="repoRef" class="fs-input fs-mono" placeholder="main" />
            <span class="field-hint">Branch or tag to watch (default: main)</span>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">Subfolder</label>
          <div class="field-wrap">
            <input
              v-model="projectDir"
              class="fs-input fs-mono"
              :class="{ 'fs-input--error': projectDirErr }"
              placeholder="services/myapp"
            />
            <span v-if="projectDirErr" class="field-error">{{ projectDirErr }}</span>
            <span v-else class="field-hint">Relative path containing metadata.yaml — no .. (optional)</span>
          </div>
        </div>

        <div class="form-section-title">Entrypoints</div>

        <div class="form-row form-row--top">
          <label class="form-label">Files <span class="required">*</span></label>
          <div class="field-wrap">
            <div class="entry-add">
              <input
                v-model="newEntrypoint"
                class="fs-input fs-mono"
                placeholder="train.py"
                @keydown="onEntrypointKeydown"
              />
              <button class="fs-btn fs-btn--ghost" type="button" @click="addEntrypoint">
                <q-icon name="mdi-plus" size="14px" /> Add
              </button>
            </div>
            <span v-if="newEntrypointErr" class="field-error">{{ newEntrypointErr }}</span>
            <span v-else-if="entrypointsErr" class="field-error">{{ entrypointsErr }}</span>
            <span v-else class="field-hint">metadata.yaml must list these under `files` — no ENTRYPOINT key</span>
          </div>
        </div>

        <div v-for="cfg in entrypointConfigs" :key="cfg.file" class="entry-row">
          <div class="entry-row__head">
            <span class="entry-row__file fs-mono">{{ cfg.file }}</span>
            <div class="kind-toggle kind-toggle--sm">
              <button
                class="kind-btn"
                :class="{ 'kind-btn--active': cfg.triggerType === 'OnDemand' }"
                type="button"
                @click="cfg.triggerType = 'OnDemand'"
              >Manual</button>
              <button
                class="kind-btn"
                :class="{ 'kind-btn--active': cfg.triggerType === 'Cron' }"
                type="button"
                @click="cfg.triggerType = 'Cron'"
              >Cron</button>
            </div>
            <button class="entry-row__remove" type="button" title="Remove" @click="removeEntrypoint(cfg.file)">
              <q-icon name="mdi-close" size="14px" />
            </button>
          </div>
          <CronPicker v-if="cfg.triggerType === 'Cron'" v-model="cfg.schedule" />
        </div>

        <div class="form-actions">
          <button class="fs-btn fs-btn--primary" @click="startWizard">
            Create <q-icon name="mdi-arrow-right" size="14px" />
          </button>
        </div>

      </div>

      <!-- ── Step 2: Provisioning ── -->
      <div v-else-if="step === 2" class="form-body">

        <div class="progress-list">
          <div v-for="item in progress" :key="item.key" class="progress-item">
            <q-spinner v-if="item.status === 'running'" size="16px" class="progress-item__spinner" />
            <q-icon
              v-else
              :name="STATUS_ICON[item.status]"
              size="16px"
              :class="`progress-item__icon progress-item__icon--${item.status}`"
            />
            <span class="progress-item__label" :class="`progress-item__label--${item.status}`">{{ item.label }}</span>
          </div>
        </div>

        <div v-if="provisionError" class="inline-msg inline-msg--error">
          <q-icon name="mdi-alert-circle-outline" size="13px" />
          {{ provisionError }}
        </div>

        <div v-if="provisionError" class="form-actions">
          <button class="fs-btn fs-btn--primary" @click="retry">
            <q-icon name="mdi-refresh" size="14px" /> Retry
          </button>
        </div>

      </div>

      <!-- ── Step 3: Done ── -->
      <div v-else class="success-body">
        <q-icon name="mdi-check-circle-outline" size="48px" class="success-icon" />
        <p class="success-title">Ready to run</p>
        <p class="success-sub">
          <span class="fs-mono">{{ jobName }}</span> is wired up — the "stable" tag is pinned to
          <span class="fs-mono">{{ resolvedBuild?.name }}:{{ resolvedBuild?.indexArtifactVersion ?? resolvedBuild?.version }}</span>,
          and {{ entrypointConfigs.length }} trigger(s) are ready to fire.
        </p>
        <div class="info-box">
          <q-icon name="mdi-information-outline" size="13px" />
          Promoting "stable" to a newer build is a separate, manual step — do it from the artifact's tag view when you're ready.
        </div>
        <div class="success-actions">
          <button class="fs-btn fs-btn--ghost" @click="router.push(`/pipelines/weave/chains/${encodeURIComponent(jobName)}`)">
            <q-icon name="mdi-link-chain" size="14px" /> View Chain
          </button>
          <button class="fs-btn fs-btn--ghost" @click="router.push(`/forge/gitwatchers/${encodeURIComponent(jobName)}`)">
            <q-icon name="mdi-source-branch-sync" size="14px" /> View Watcher
          </button>
          <button class="fs-btn fs-btn--ghost" @click="router.push('/pipelines/weave/triggers')">
            <q-icon name="mdi-lightning-bolt-outline" size="14px" /> View Triggers
          </button>
          <button class="fs-btn fs-btn--primary" @click="createAnother">
            <q-icon name="mdi-plus" size="14px" /> Create Another
          </button>
        </div>
      </div>

    </CanvasPanel>
  </div>
</template>

<style scoped>
.page-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 16px;
  align-content: start;
}

.breadcrumb {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 4px;
}
.breadcrumb__back {
  display: flex; align-items: center; gap: 5px;
  background: none; border: none; padding: 4px 8px; border-radius: 4px;
  cursor: pointer; color: var(--fs-text-muted); font-size: 12px; font-family: inherit;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.breadcrumb__back:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.breadcrumb__current { font-size: 12px; color: var(--fs-accent); font-weight: 500; }
.muted-icon { color: var(--fs-text-muted); }
.fs-mono { font-family: var(--fs-font-mono); }

/* Wizard step indicator */
.wizard-steps { display: flex; align-items: center; padding: 16px 10px 24px; }
.wizard-step { display: flex; align-items: center; gap: 8px; flex: 1; }
.wizard-step:last-child { flex: none; }
.wizard-step__dot {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; flex-shrink: 0;
  border: 1.5px solid var(--fs-border);
  color: var(--fs-text-muted);
  background: var(--fs-bg-elevated);
  transition: border-color var(--fs-ease), background var(--fs-ease), color var(--fs-ease);
}
.wizard-step--active .wizard-step__dot { border-color: var(--fs-accent); background: var(--fs-accent); color: #fff; }
.wizard-step--done   .wizard-step__dot { border-color: var(--fs-pos, #4caf50); background: var(--fs-pos, #4caf50); color: #fff; }
.wizard-step__label { font-size: 11.5px; font-weight: 500; color: var(--fs-text-muted); white-space: nowrap; transition: color var(--fs-ease); }
.wizard-step--active .wizard-step__label,
.wizard-step--done  .wizard-step__label { color: var(--fs-text-primary); }
.wizard-step__line { flex: 1; height: 1px; background: var(--fs-border); margin: 0 8px; }

/* Form layout */
.form-body { display: flex; flex-direction: column; gap: 16px; padding: 0 10px 10px; }

.form-section-title {
  font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--fs-accent); padding-top: 8px; border-bottom: 1px solid var(--fs-border); padding-bottom: 4px;
}

.form-row { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 12px; }
.form-row--top { align-items: start; }
.form-label {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted); padding-top: 8px;
}
.required { color: var(--fs-neg, #e57373); }

.field-wrap { display: flex; flex-direction: column; gap: 4px; }
.field-error { font-size: 11px; color: var(--fs-neg, #e57373); }
.field-hint  { font-size: 11px; color: var(--fs-text-muted); }

.fs-input {
  width: 100%;
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 7px 10px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--fs-text-primary);
  outline: none;
  transition: border-color var(--fs-ease);
  box-sizing: border-box;
}
.fs-input:focus  { border-color: var(--fs-accent); }
.fs-input--error { border-color: var(--fs-neg, #e57373); }

/* Entrypoint add row */
.entry-add { display: flex; gap: 8px; }
.entry-add .fs-input { flex: 1; }

/* Entrypoint config rows */
.entry-row {
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px 12px; border: 1px solid var(--fs-border); border-radius: 5px;
  margin-left: 152px;
}
.entry-row__head { display: flex; align-items: center; gap: 10px; }
.entry-row__file { flex: 1; font-size: 12.5px; color: var(--fs-text-primary); }
.entry-row__remove {
  background: none; border: none; cursor: pointer; padding: 2px;
  color: var(--fs-text-muted); display: flex; align-items: center;
  transition: color var(--fs-ease);
}
.entry-row__remove:hover { color: var(--fs-neg, #e57373); }

/* Toggle (build type style, reused for OnDemand/Cron) */
.kind-toggle { display: flex; border: 1px solid var(--fs-border); border-radius: 4px; overflow: hidden; width: fit-content; }
.kind-toggle--sm .kind-btn { padding: 4px 10px; font-size: 11px; }
.kind-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px; font-size: 12px; font-family: inherit; font-weight: 500;
  cursor: pointer; background: var(--fs-bg-hover); border: none;
  border-right: 1px solid var(--fs-border); color: var(--fs-text-muted);
  transition: background var(--fs-ease), color var(--fs-ease);
}
.kind-btn:last-child { border-right: none; }
.kind-btn:hover { color: var(--fs-text-primary); }
.kind-btn--active { background: var(--fs-accent); color: #fff; }

/* Progress checklist */
.progress-list { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; }
.progress-item { display: flex; align-items: center; gap: 10px; padding: 8px 4px; }
.progress-item__spinner { color: var(--fs-accent); }
.progress-item__icon--pending { color: var(--fs-text-muted); opacity: 0.5; }
.progress-item__icon--done    { color: var(--fs-pos, #4caf50); }
.progress-item__icon--error   { color: var(--fs-neg, #e57373); }
.progress-item__label { font-size: 12.5px; color: var(--fs-text-muted); }
.progress-item__label--done  { color: var(--fs-text-primary); }
.progress-item__label--error { color: var(--fs-neg, #e57373); }

/* Info / inline messages */
.info-box {
  display: flex; align-items: flex-start; gap: 6px; text-align: left;
  font-size: 11.5px; color: var(--fs-text-muted);
  background: var(--fs-bg-hover); border: 1px solid var(--fs-border);
  border-radius: 4px; padding: 8px 12px; line-height: 1.5;
}
.inline-msg { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 8px 10px; border-radius: 4px; }
.inline-msg--error { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

/* Action bar */
.form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

/* Buttons */
.fs-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px;
  border-radius: 4px; font-size: 12.5px; font-family: inherit; font-weight: 500;
  cursor: pointer; border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease), filter var(--fs-ease);
}
.fs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fs-btn--primary { background: var(--fs-accent); color: #fff; border-color: var(--fs-accent); }
.fs-btn--primary:hover:not(:disabled) { filter: brightness(1.1); }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.fs-btn--ghost:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }

/* Success state */
.success-body { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 24px 40px; text-align: center; }
.success-icon  { color: var(--fs-pos, #4caf50); }
.success-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--fs-text-primary); }
.success-sub   { margin: 0; font-size: 12.5px; color: var(--fs-text-muted); max-width: 460px; }
.success-actions { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
</style>
