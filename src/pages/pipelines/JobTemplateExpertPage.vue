<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as weaveApi from '@/api/weaveApi'

const router = useRouter()

// ─── Identity ─────────────────────────────────────────────────────────────────

const name       = ref('')
const image      = ref('')
const nameError  = ref<string | null>(null)
const imageError = ref<string | null>(null)

const K8S_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/

// ─── Execution ────────────────────────────────────────────────────────────────

const commandText = ref('')
const argsText    = ref('')

// ─── Environment vars ─────────────────────────────────────────────────────────

interface EnvRow { key: string; value: string }
const envRows = ref<EnvRow[]>([{ key: '', value: '' }])

function addEnvRow() {
  envRows.value = [...envRows.value, { key: '', value: '' }]
}
function removeEnvRow(i: number) {
  const rows = envRows.value.filter((_, idx) => idx !== i)
  envRows.value = rows.length > 0 ? rows : [{ key: '', value: '' }]
}

// ─── Resources ────────────────────────────────────────────────────────────────

const cpuRequest    = ref('')
const cpuLimit      = ref('')
const memoryRequest = ref('')
const memoryLimit   = ref('')

// ─── Job settings ─────────────────────────────────────────────────────────────

const parallelism           = ref('')
const completions           = ref('')
const activeDeadlineSeconds = ref('')
const serviceAccountName    = ref('')

// ─── Retry policy ─────────────────────────────────────────────────────────────

const retryEnabled    = ref(false)
const maxRetries      = ref(3)
const backoffSeconds  = ref(10)

// ─── Volumes ──────────────────────────────────────────────────────────────────

interface VolumeRow {
  name:       string
  mountPath:  string
  type:       'secret' | 'configmap'
  sourceName: string
}
const volumes = ref<VolumeRow[]>([])

function addVolume() {
  volumes.value = [...volumes.value, { name: '', mountPath: '', type: 'secret', sourceName: '' }]
}
function removeVolume(i: number) {
  volumes.value = volumes.value.filter((_, idx) => idx !== i)
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(): boolean {
  let ok = true
  const n = name.value.trim()
  if (!n) {
    nameError.value = 'Name is required'
    ok = false
  } else if (!K8S_NAME_RE.test(n)) {
    nameError.value = 'Lowercase letters, digits and hyphens only; must start and end with alphanumeric'
    ok = false
  } else if (n.length > 253) {
    nameError.value = 'Max 253 characters'
    ok = false
  } else {
    nameError.value = null
  }
  if (!image.value.trim()) {
    imageError.value = 'Image is required'
    ok = false
  } else {
    imageError.value = null
  }
  return ok
}

// ─── Build spec ───────────────────────────────────────────────────────────────

function buildSpec(): weaveApi.WeaveJobTemplateSpec {
  const spec: weaveApi.WeaveJobTemplateSpec = { image: image.value.trim() }

  const cmd = commandText.value.split('\n').map(s => s.trim()).filter(Boolean)
  if (cmd.length) spec.command = cmd

  const args = argsText.value.split('\n').map(s => s.trim()).filter(Boolean)
  if (args.length) spec.args = args

  const env = envRows.value.filter(r => r.key.trim()).map(r => ({ name: r.key.trim(), value: r.value }))
  if (env.length) spec.env = env

  const resources: weaveApi.ResourceRequirements = {}
  if (cpuRequest.value.trim() || memoryRequest.value.trim()) {
    resources.requests = {}
    if (cpuRequest.value.trim())    resources.requests.cpu    = cpuRequest.value.trim()
    if (memoryRequest.value.trim()) resources.requests.memory = memoryRequest.value.trim()
  }
  if (cpuLimit.value.trim() || memoryLimit.value.trim()) {
    resources.limits = {}
    if (cpuLimit.value.trim())    resources.limits.cpu    = cpuLimit.value.trim()
    if (memoryLimit.value.trim()) resources.limits.memory = memoryLimit.value.trim()
  }
  if (resources.requests || resources.limits) spec.resources = resources

  const par = parseInt(parallelism.value)
  if (!isNaN(par) && par >= 1) spec.parallelism = par

  const comp = parseInt(completions.value)
  if (!isNaN(comp) && comp >= 1) spec.completions = comp

  const deadline = parseInt(activeDeadlineSeconds.value)
  if (!isNaN(deadline) && deadline > 0) spec.activeDeadlineSeconds = deadline

  if (serviceAccountName.value.trim()) spec.serviceAccountName = serviceAccountName.value.trim()

  if (retryEnabled.value) {
    spec.retryPolicy = {
      maxRetries:     maxRetries.value,
      backoffSeconds: backoffSeconds.value,
    }
  }

  const vols = volumes.value
    .filter(v => v.name.trim() && v.mountPath.trim() && v.sourceName.trim())
    .map(v => ({
      name:      v.name.trim(),
      mountPath: v.mountPath.trim(),
      ...(v.type === 'secret'    ? { secretName:    v.sourceName.trim() } : { configMapName: v.sourceName.trim() }),
    }))
  if (vols.length) spec.volumes = vols

  return spec
}

// ─── Submit ───────────────────────────────────────────────────────────────────

const submitting      = ref(false)
const submitError     = ref<string | null>(null)
const createdTemplate = ref<weaveApi.WeaveJobTemplate | null>(null)

async function submit() {
  if (!validate()) return
  submitting.value  = true
  submitError.value = null
  try {
    createdTemplate.value = await weaveApi.createJobTemplate({
      metadata: { name: name.value.trim() },
      spec:     buildSpec(),
    })
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Creation failed'
  } finally {
    submitting.value = false
  }
}

function createAnother() {
  name.value          = ''
  image.value         = ''
  nameError.value     = null
  imageError.value    = null
  commandText.value   = ''
  argsText.value      = ''
  envRows.value       = [{ key: '', value: '' }]
  cpuRequest.value    = ''
  cpuLimit.value      = ''
  memoryRequest.value = ''
  memoryLimit.value   = ''
  parallelism.value           = ''
  completions.value           = ''
  activeDeadlineSeconds.value = ''
  serviceAccountName.value    = ''
  retryEnabled.value   = false
  maxRetries.value     = 3
  backoffSeconds.value = 10
  volumes.value        = []
  submitError.value    = null
  createdTemplate.value = null
}
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/pipelines/weave/jobtemplates')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Job Templates
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">Expert Create</span>
    </div>

    <CanvasPanel title="Create Job Template — Expert" icon="mdi-briefcase-edit-outline" :wide="true">

      <!-- ── Success state ── -->
      <div v-if="createdTemplate" class="success-body">
        <q-icon name="mdi-check-circle-outline" size="48px" class="success-icon" />
        <p class="success-title">Job template created</p>
        <p class="success-sub">
          <span class="fs-mono">{{ createdTemplate.metadata.name }}</span>
          was submitted — validation runs asynchronously.
        </p>
        <div class="success-actions">
          <button class="fs-btn fs-btn--ghost" @click="router.push('/pipelines/weave/jobtemplates')">
            <q-icon name="mdi-format-list-bulleted" size="14px" />
            View Templates
          </button>
          <button class="fs-btn fs-btn--primary" @click="createAnother">
            <q-icon name="mdi-plus" size="14px" />
            Create Another
          </button>
        </div>
      </div>

      <!-- ── Form ── -->
      <form v-else class="expert-form" @submit.prevent="submit">

        <!-- ── Identity ── -->
        <div class="section-header">
          <q-icon name="mdi-identifier" size="15px" class="section-icon" />
          Identity
        </div>

        <div class="form-row">
          <label class="form-label">Name <span class="required">*</span></label>
          <div class="field-wrap">
            <input
              v-model="name"
              class="fs-input fs-mono"
              :class="{ 'fs-input--error': nameError }"
              placeholder="my-job-template"
            />
            <span v-if="nameError" class="field-error">{{ nameError }}</span>
            <span v-else class="field-hint">Lowercase, alphanumeric and hyphens; used as the Kubernetes resource name</span>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">Image <span class="required">*</span></label>
          <div class="field-wrap">
            <input
              v-model="image"
              class="fs-input fs-mono"
              :class="{ 'fs-input--error': imageError }"
              placeholder="python:3.12-slim"
            />
            <span v-if="imageError" class="field-error">{{ imageError }}</span>
            <span v-else class="field-hint">Container image that will run in each job pod</span>
          </div>
        </div>

        <!-- ── Execution ── -->
        <div class="section-header">
          <q-icon name="mdi-play-circle-outline" size="15px" class="section-icon" />
          Execution
        </div>

        <div class="form-row form-row--top">
          <label class="form-label">Command</label>
          <div class="field-wrap">
            <textarea
              v-model="commandText"
              class="fs-input fs-textarea fs-mono"
              placeholder="One entry per line&#10;python&#10;/app/run.py"
              rows="3"
            />
            <span class="field-hint">Overrides the container entrypoint; one argument per line</span>
          </div>
        </div>

        <div class="form-row form-row--top">
          <label class="form-label">Args</label>
          <div class="field-wrap">
            <textarea
              v-model="argsText"
              class="fs-input fs-textarea fs-mono"
              placeholder="One entry per line&#10;--input&#10;/data/in.csv"
              rows="3"
            />
            <span class="field-hint">Arguments passed to the command; one argument per line</span>
          </div>
        </div>

        <!-- ── Environment ── -->
        <div class="section-header">
          <q-icon name="mdi-variable" size="15px" class="section-icon" />
          Environment Variables
        </div>

        <div class="form-row form-row--top">
          <label class="form-label">Env vars</label>
          <div class="field-wrap">
            <div class="env-table">
              <div class="env-header">
                <span class="env-header__key">Key</span>
                <span class="env-header__val">Value</span>
              </div>
              <div v-for="(row, i) in envRows" :key="i" class="env-row">
                <input v-model="row.key"   class="fs-input fs-mono env-input" placeholder="LOG_LEVEL" />
                <input v-model="row.value" class="fs-input fs-mono env-input" placeholder="info" />
                <button type="button" class="icon-btn icon-btn--danger" title="Remove" @click="removeEnvRow(i)">
                  <q-icon name="mdi-close" size="13px" />
                </button>
              </div>
            </div>
            <button type="button" class="fs-btn fs-btn--ghost add-btn" @click="addEnvRow">
              <q-icon name="mdi-plus" size="13px" /> Add variable
            </button>
          </div>
        </div>

        <!-- ── Resources ── -->
        <div class="section-header">
          <q-icon name="mdi-memory" size="15px" class="section-icon" />
          Resources
        </div>

        <div class="form-row">
          <label class="form-label">CPU request</label>
          <input v-model="cpuRequest" class="fs-input fs-mono field-narrow" placeholder="200m" />
        </div>
        <div class="form-row">
          <label class="form-label">CPU limit</label>
          <input v-model="cpuLimit"   class="fs-input fs-mono field-narrow" placeholder="500m" />
        </div>
        <div class="form-row">
          <label class="form-label">Memory request</label>
          <input v-model="memoryRequest" class="fs-input fs-mono field-narrow" placeholder="256Mi" />
        </div>
        <div class="form-row">
          <label class="form-label">Memory limit</label>
          <input v-model="memoryLimit"   class="fs-input fs-mono field-narrow" placeholder="512Mi" />
        </div>

        <!-- ── Job Settings ── -->
        <div class="section-header">
          <q-icon name="mdi-cog-outline" size="15px" class="section-icon" />
          Job Settings
        </div>

        <div class="form-row">
          <label class="form-label">Parallelism</label>
          <div class="field-wrap">
            <input v-model="parallelism" type="number" min="1" class="fs-input field-narrow" placeholder="1 (default)" />
            <span class="field-hint">Number of pods to run in parallel</span>
          </div>
        </div>
        <div class="form-row">
          <label class="form-label">Completions</label>
          <div class="field-wrap">
            <input v-model="completions" type="number" min="1" class="fs-input field-narrow" placeholder="1 (default)" />
            <span class="field-hint">Number of successful pod completions required</span>
          </div>
        </div>
        <div class="form-row">
          <label class="form-label">Timeout (s)</label>
          <div class="field-wrap">
            <input v-model="activeDeadlineSeconds" type="number" min="1" class="fs-input field-narrow" placeholder="unlimited" />
            <span class="field-hint">activeDeadlineSeconds — job is killed if it exceeds this duration</span>
          </div>
        </div>
        <div class="form-row">
          <label class="form-label">Service account</label>
          <div class="field-wrap">
            <input v-model="serviceAccountName" class="fs-input fs-mono field-narrow" placeholder="default" />
            <span class="field-hint">Kubernetes service account for the job pod</span>
          </div>
        </div>

        <!-- ── Retry Policy ── -->
        <div class="section-header">
          <q-icon name="mdi-refresh" size="15px" class="section-icon" />
          Retry Policy
        </div>

        <div class="form-row">
          <label class="form-label">Enable retries</label>
          <label class="toggle-wrap">
            <input v-model="retryEnabled" type="checkbox" class="toggle-input" />
            <span class="toggle-track">
              <span class="toggle-thumb" />
            </span>
            <span class="toggle-label">{{ retryEnabled ? 'Enabled' : 'Disabled' }}</span>
          </label>
        </div>

        <template v-if="retryEnabled">
          <div class="form-row">
            <label class="form-label">Max retries</label>
            <div class="field-wrap">
              <input v-model.number="maxRetries" type="number" min="0" class="fs-input field-narrow" />
              <span class="field-hint">Number of times to retry a failed pod (min 0)</span>
            </div>
          </div>
          <div class="form-row">
            <label class="form-label">Backoff (s)</label>
            <div class="field-wrap">
              <input v-model.number="backoffSeconds" type="number" min="1" class="fs-input field-narrow" />
              <span class="field-hint">Seconds to wait before each retry attempt (min 1)</span>
            </div>
          </div>
        </template>

        <!-- ── Volumes ── -->
        <div class="section-header">
          <q-icon name="mdi-harddisk" size="15px" class="section-icon" />
          Volumes
        </div>

        <div class="form-row form-row--top">
          <label class="form-label">Mounts</label>
          <div class="field-wrap">
            <div v-if="volumes.length > 0" class="vol-table">
              <div class="vol-header">
                <span>Name</span>
                <span>Mount Path</span>
                <span>Type</span>
                <span>Source Name</span>
                <span></span>
              </div>
              <div v-for="(vol, i) in volumes" :key="i" class="vol-row">
                <input v-model="vol.name"       class="fs-input fs-mono vol-input" placeholder="creds" />
                <input v-model="vol.mountPath"  class="fs-input fs-mono vol-input" placeholder="/etc/creds" />
                <select v-model="vol.type" class="fs-input vol-select">
                  <option value="secret">Secret</option>
                  <option value="configmap">ConfigMap</option>
                </select>
                <input v-model="vol.sourceName" class="fs-input fs-mono vol-input" placeholder="my-secret" />
                <button type="button" class="icon-btn icon-btn--danger" title="Remove" @click="removeVolume(i)">
                  <q-icon name="mdi-close" size="13px" />
                </button>
              </div>
            </div>
            <button type="button" class="fs-btn fs-btn--ghost add-btn" @click="addVolume">
              <q-icon name="mdi-plus" size="13px" /> Add volume
            </button>
          </div>
        </div>

        <!-- ── Submit ── -->
        <div v-if="submitError" class="inline-msg inline-msg--error">
          <q-icon name="mdi-alert-circle-outline" size="13px" />
          {{ submitError }}
        </div>

        <div class="form-actions">
          <button type="submit" class="fs-btn fs-btn--primary" :disabled="submitting">
            <q-spinner v-if="submitting" size="13px" color="white" />
            <q-icon v-else name="mdi-check-outline" size="14px" />
            {{ submitting ? 'Creating…' : 'Create Template' }}
          </button>
        </div>

      </form>
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

/* Breadcrumb */
.breadcrumb {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 4px;
}
.breadcrumb__back {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--fs-text-muted);
  font-size: 12px;
  font-family: inherit;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.breadcrumb__back:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.breadcrumb__current { font-size: 12px; color: var(--fs-accent); font-weight: 500; }
.muted-icon { color: var(--fs-text-muted); }

/* Form */
.expert-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 10px 10px;
}

/* Section headers */
.section-header {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  padding: 8px 0 2px;
  border-bottom: 1px solid var(--fs-border);
  margin-bottom: 4px;
}
.section-icon { color: var(--fs-accent); flex-shrink: 0; }

/* Form rows */
.form-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  align-items: center;
  gap: 12px;
}
.form-row--top { align-items: start; padding-top: 2px; }
.form-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--fs-text-muted);
}
.required { color: var(--fs-neg, #e57373); }
.field-wrap { display: flex; flex-direction: column; gap: 4px; }
.field-error { font-size: 11px; color: var(--fs-neg, #e57373); }
.field-hint  { font-size: 11px; color: var(--fs-text-muted); }
.field-narrow { max-width: 220px; }

/* Inputs */
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
.fs-textarea     { resize: vertical; min-height: 72px; }
.fs-mono         { font-family: var(--fs-font-mono); }

/* Env table */
.env-table { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.env-header {
  display: grid;
  grid-template-columns: 1fr 1fr 28px;
  gap: 6px;
  padding: 0 2px 2px;
}
.env-header__key,
.env-header__val {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
}
.env-row    { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; align-items: center; }
.env-input  { padding: 5px 8px; font-size: 12px; }

/* Volume table */
.vol-table { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.vol-header {
  display: grid;
  grid-template-columns: 1fr 1.2fr 100px 1fr 28px;
  gap: 6px;
  padding: 0 2px 2px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
}
.vol-row    { display: grid; grid-template-columns: 1fr 1.2fr 100px 1fr 28px; gap: 6px; align-items: center; }
.vol-input  { padding: 5px 8px; font-size: 12px; }
.vol-select { padding: 5px 8px; font-size: 12px; appearance: auto; cursor: pointer; }

/* Toggle */
.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}
.toggle-input { display: none; }
.toggle-track {
  position: relative;
  width: 34px;
  height: 18px;
  border-radius: 9px;
  background: var(--fs-border);
  border: 1px solid var(--fs-border);
  transition: background var(--fs-ease), border-color var(--fs-ease);
  flex-shrink: 0;
}
.toggle-input:checked ~ .toggle-track {
  background: var(--fs-accent);
  border-color: var(--fs-accent);
}
.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  transition: transform var(--fs-ease);
}
.toggle-input:checked ~ .toggle-track .toggle-thumb {
  transform: translateX(16px);
}
.toggle-label { font-size: 12px; color: var(--fs-text-muted); }

/* Add buttons */
.add-btn { align-self: flex-start; padding: 4px 10px; font-size: 11.5px; margin-top: 2px; }

/* Icon buttons */
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  color: var(--fs-text-muted);
  transition: color var(--fs-ease), background var(--fs-ease);
}
.icon-btn--danger:hover { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

/* Inline messages */
.inline-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 8px 10px;
  border-radius: 4px;
}
.inline-msg--error {
  color: var(--fs-neg, #e57373);
  background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent);
}

/* Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--fs-border);
  margin-top: 4px;
}

/* Buttons */
.fs-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 4px;
  font-size: 12.5px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease), filter var(--fs-ease);
}
.fs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fs-btn--primary { background: var(--fs-accent); color: #fff; border-color: var(--fs-accent); }
.fs-btn--primary:hover:not(:disabled) { filter: brightness(1.1); }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.fs-btn--ghost:hover:not(:disabled) {
  color: var(--fs-text-primary);
  background: var(--fs-bg-hover);
  border-color: var(--fs-border-bright, var(--fs-border));
}

/* Success state */
.success-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px 40px;
  text-align: center;
}
.success-icon  { color: var(--fs-pos, #4caf50); }
.success-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--fs-text-primary); }
.success-sub   { margin: 0; font-size: 12.5px; color: var(--fs-text-muted); }
.success-actions { margin-top: 8px; display: flex; gap: 8px; }
</style>
