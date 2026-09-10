<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import CronPicker from '@/components/CronPicker.vue'
import * as weaveApi from '@/api/weaveApi'
import * as indexApi from '@/api/indexApi'
import { ApiError } from '@/api/bffClient'
import { useGitAppProvisioning, type ProgressStatus } from '@/composables/useGitAppProvisioning'

const router = useRouter()

const {
  progress, provisionError, resolvedBuild, createdWatcherName, isCancelled,
  setStatus, ensureGitWatcher, waitForBuild, ensureJobTemplate, ensureChain,
} = useGitAppProvisioning()

// ─── Wizard state ──────────────────────────────────────────────────────────────

const step       = ref<1 | 2 | 3>(1)
const stepLabels = ['Setup', 'Provisioning', 'Done'] as const

// ─── Step 1 fields ──────────────────────────────────────────────────────────────

const jobName    = ref('')
const repoUrl    = ref('')
const repoRef    = ref('')
const projectDir = ref('')

// Single job per repo/branch/subfolder — ENTRYPOINT is fixed in the target's
// own metadata.yaml, so (unlike the Python wizard) there's no file list here,
// just one schedule for the one trigger this wizard creates.
const triggerType = ref<'OnDemand' | 'Cron'>('OnDemand')
const schedule    = ref('0 9 * * *')

// ─── Validation ─────────────────────────────────────────────────────────────────

const jobNameErr    = ref<string | null>(null)
const repoUrlErr    = ref<string | null>(null)
const repoRefErr    = ref<string | null>(null)
const projectDirErr = ref<string | null>(null)

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

  if (!repoRef.value.trim()) {
    repoRefErr.value = 'Branch (or tag) is required — a batch job is pinned to one ref'
    ok = false
  } else {
    repoRefErr.value = null
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

  return ok
}

watch(jobName, () => { jobNameErr.value = null })
watch(repoUrl, () => { repoUrlErr.value = null })
watch(repoRef, () => { repoRefErr.value = null })
watch(projectDir, () => { projectDirErr.value = null })

// ─── Provisioning ───────────────────────────────────────────────────────────────
// Shared watcher/build/tag/template/chain logic lives in useGitAppProvisioning();
// this wizard only adds a single trigger, then fires it to actually start the batch.

function initProgress() {
  progress.value = [
    { key: 'watcher',  label: 'GitOps watcher',         status: 'pending' },
    { key: 'build',    label: 'Building artifact',       status: 'pending' },
    { key: 'tag',      label: 'Assigning "stable" tag',  status: 'pending' },
    { key: 'template', label: 'Job blueprint',           status: 'pending' },
    { key: 'chain',    label: 'Run blueprint (chain)',   status: 'pending' },
    { key: 'trigger',  label: 'Trigger',                 status: 'pending' },
    { key: 'run',      label: 'Starting batch run',      status: 'pending' },
  ]
}

async function ensureTrigger(name: string): Promise<void> {
  try {
    await weaveApi.getWeaveTrigger(name)
    // Already exists — assume it was created by a previous run of this wizard
    // for the same job name; nothing else to do.
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      const spec: weaveApi.WeaveTriggerSpec = {
        chainRef: { name },
        type:     triggerType.value,
      }
      if (triggerType.value === 'Cron') spec.schedule = schedule.value
      await weaveApi.createWeaveTrigger({ metadata: { name }, spec })
      return
    }
    throw e
  }
}

async function runProvisioning() {
  provisionError.value = null
  const name = jobName.value.trim()
  try {
    setStatus('watcher', 'running')
    createdWatcherName.value = name
    await ensureGitWatcher({ name, repoUrl: repoUrl.value.trim(), repoRef: repoRef.value.trim(), projectDir: projectDir.value.trim() })
    setStatus('watcher', 'done')

    setStatus('build', 'running')
    const build = await waitForBuild(name)
    if (isCancelled()) return
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
    await ensureJobTemplate(name, build)
    setStatus('template', 'done')

    setStatus('chain', 'running')
    await ensureChain(name)
    setStatus('chain', 'done')

    setStatus('trigger', 'running')
    await ensureTrigger(name)
    setStatus('trigger', 'done')

    setStatus('run', 'running')
    await weaveApi.fireWeaveTrigger(name)
    setStatus('run', 'done')

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
  jobName.value            = ''
  repoUrl.value             = ''
  repoRef.value             = ''
  projectDir.value          = ''
  triggerType.value         = 'OnDemand'
  schedule.value            = '0 9 * * *'
  progress.value            = []
  provisionError.value      = null
  resolvedBuild.value       = null
  createdWatcherName.value  = null
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
      <span class="breadcrumb__current">Git → Batch Job</span>
    </div>

    <CanvasPanel title="Git → Batch Job Wizard" icon="mdi-tray-full" :wide="true">

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
              placeholder="my-batch-job"
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
          <label class="form-label">Branch/Ref <span class="required">*</span></label>
          <div class="field-wrap">
            <input
              v-model="repoRef"
              class="fs-input fs-mono"
              :class="{ 'fs-input--error': repoRefErr }"
              placeholder="main"
            />
            <span v-if="repoRefErr" class="field-error">{{ repoRefErr }}</span>
            <span v-else class="field-hint">Branch or tag containing the batch job</span>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">Subfolder</label>
          <div class="field-wrap">
            <input
              v-model="projectDir"
              class="fs-input fs-mono"
              :class="{ 'fs-input--error': projectDirErr }"
              placeholder="jobs/myjob"
            />
            <span v-if="projectDirErr" class="field-error">{{ projectDirErr }}</span>
            <span v-else class="field-hint">Relative path containing metadata.yaml — no .. (optional)</span>
          </div>
        </div>

        <div class="form-section-title">Schedule</div>

        <div class="form-row form-row--top">
          <label class="form-label">Recurrence</label>
          <div class="field-wrap">
            <div class="kind-toggle">
              <button
                class="kind-btn"
                :class="{ 'kind-btn--active': triggerType === 'OnDemand' }"
                type="button"
                @click="triggerType = 'OnDemand'"
              >Manual only</button>
              <button
                class="kind-btn"
                :class="{ 'kind-btn--active': triggerType === 'Cron' }"
                type="button"
                @click="triggerType = 'Cron'"
              >Also on a schedule</button>
            </div>
            <span class="field-hint">The batch always starts once immediately — this only controls future runs</span>
            <CronPicker v-if="triggerType === 'Cron'" v-model="schedule" />
          </div>
        </div>

        <div class="form-actions">
          <button class="fs-btn fs-btn--primary" @click="startWizard">
            Create &amp; Start <q-icon name="mdi-arrow-right" size="14px" />
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
        <p class="success-title">Batch started</p>
        <p class="success-sub">
          <span class="fs-mono">{{ jobName }}</span> is wired up and its first run has been fired — the "stable" tag is pinned to
          <span class="fs-mono">{{ resolvedBuild?.name }}:{{ resolvedBuild?.indexArtifactVersion ?? resolvedBuild?.version }}</span>.
          <template v-if="triggerType === 'Cron'"> Future runs will also fire on the schedule you set.</template>
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

/* Toggle (build type style, reused for OnDemand/Cron) */
.kind-toggle { display: flex; border: 1px solid var(--fs-border); border-radius: 4px; overflow: hidden; width: fit-content; }
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
