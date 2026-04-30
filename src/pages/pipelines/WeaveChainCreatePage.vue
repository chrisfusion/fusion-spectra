<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as weaveApi from '@/api/weaveApi'

const router = useRouter()

// ─── Wizard state ─────────────────────────────────────────────────────────────

const step = ref<1 | 2 | 3>(1)

const stepLabels = ['Identity', 'Step', 'Overrides'] as const

// ─── Step 1: chain name ───────────────────────────────────────────────────────

const chainName      = ref('')
const chainNameError = ref<string | null>(null)

const K8S_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/

function validateStep1(): boolean {
  const n = chainName.value.trim()
  if (!n) {
    chainNameError.value = 'Name is required'
    return false
  }
  if (!K8S_NAME_RE.test(n)) {
    chainNameError.value = 'Lowercase letters, digits and hyphens only; must start and end with alphanumeric'
    return false
  }
  if (n.length > 253) {
    chainNameError.value = 'Max 253 characters'
    return false
  }
  chainNameError.value = null
  return true
}

function goToStep2() {
  if (validateStep1()) {
    loadTemplatesForKind(stepKind.value)
    step.value = 2
  }
}

// ─── Step 2: step kind + template picker ──────────────────────────────────────

const stepName      = ref('step-1')
const stepNameError = ref<string | null>(null)
const stepKind      = ref<'Job' | 'Deploy'>('Job')

const jobTemplates     = ref<weaveApi.WeaveJobTemplate[]>([])
const serviceTemplates = ref<weaveApi.WeaveServiceTemplate[]>([])
const loadingTemplates = ref(false)
const loadTemplateError = ref<string | null>(null)
const selectedTemplate = ref('')
const templateError    = ref<string | null>(null)

async function loadTemplatesForKind(kind: 'Job' | 'Deploy') {
  loadingTemplates.value  = true
  loadTemplateError.value = null
  selectedTemplate.value  = ''
  try {
    if (kind === 'Job') {
      const res = await weaveApi.listJobTemplates()
      jobTemplates.value = res.items ?? []
    } else {
      const res = await weaveApi.listServiceTemplates()
      serviceTemplates.value = res.items ?? []
    }
  } catch (e) {
    loadTemplateError.value = e instanceof Error ? e.message : 'Failed to load templates'
  } finally {
    loadingTemplates.value = false
  }
}

watch(stepKind, kind => loadTemplatesForKind(kind))

function validateStep2(): boolean {
  let ok = true
  const sn = stepName.value.trim()
  if (!sn) {
    stepNameError.value = 'Step name is required'
    ok = false
  } else if (!K8S_NAME_RE.test(sn)) {
    stepNameError.value = 'Lowercase letters, digits and hyphens only'
    ok = false
  } else {
    stepNameError.value = null
  }
  if (!selectedTemplate.value) {
    templateError.value = 'Select a template'
    ok = false
  } else {
    templateError.value = null
  }
  return ok
}

function goToStep3() {
  if (validateStep2()) step.value = 3
}

// ─── Step 3: env overrides ────────────────────────────────────────────────────

interface EnvRow { key: string; value: string }
const envRows = ref<EnvRow[]>([{ key: '', value: '' }])

function addEnvRow() {
  envRows.value = [...envRows.value, { key: '', value: '' }]
}
function removeEnvRow(i: number) {
  const rows = envRows.value.filter((_, idx) => idx !== i)
  envRows.value = rows.length > 0 ? rows : [{ key: '', value: '' }]
}

// ─── Submit ───────────────────────────────────────────────────────────────────

const submitting    = ref(false)
const submitError   = ref<string | null>(null)
const createdChain  = ref<weaveApi.WeaveChain | null>(null)

function buildSpec(): weaveApi.WeaveChainSpec {
  const chainStep: weaveApi.WeaveChainStep = {
    name:     stepName.value.trim(),
    stepKind: stepKind.value,
  }

  if (stepKind.value === 'Job') {
    chainStep.jobTemplateRef = { name: selectedTemplate.value }
  } else {
    chainStep.serviceTemplateRef = { name: selectedTemplate.value }
  }

  const overrides = envRows.value
    .filter(r => r.key.trim())
    .map(r => ({ name: r.key.trim(), value: r.value }))
  if (overrides.length) chainStep.envOverrides = overrides

  return { steps: [chainStep] }
}

async function submit() {
  submitting.value  = true
  submitError.value = null
  try {
    createdChain.value = await weaveApi.createWeaveChain({
      metadata: { name: chainName.value.trim() },
      spec:     buildSpec(),
    })
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Creation failed'
  } finally {
    submitting.value = false
  }
}

function createAnother() {
  chainName.value      = ''
  chainNameError.value = null
  stepName.value       = 'step-1'
  stepNameError.value  = null
  stepKind.value       = 'Job'
  selectedTemplate.value = ''
  templateError.value  = null
  envRows.value        = [{ key: '', value: '' }]
  submitError.value    = null
  createdChain.value   = null
  step.value           = 1
}
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/pipelines/weave/chains')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Weave Chains
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">Single Job/Service Wizard</span>
    </div>

    <CanvasPanel title="Single Job/Service Wizard" icon="mdi-plus-circle-outline" :wide="true">

      <!-- ── Success state ── -->
      <div v-if="createdChain" class="success-body">
        <q-icon name="mdi-check-circle-outline" size="48px" class="success-icon" />
        <p class="success-title">Chain created</p>
        <p class="success-sub">
          <span class="fs-mono">{{ createdChain.metadata.name }}</span>
          was submitted — validation runs asynchronously.
        </p>
        <div class="success-actions">
          <button class="fs-btn fs-btn--ghost" @click="router.push('/pipelines/weave/chains')">
            <q-icon name="mdi-format-list-bulleted" size="14px" />
            View Chains
          </button>
          <button class="fs-btn fs-btn--primary" @click="createAnother">
            <q-icon name="mdi-plus" size="14px" />
            Create Another
          </button>
        </div>
      </div>

      <!-- ── Wizard ── -->
      <template v-else>

        <!-- Step indicator -->
        <div class="wizard-steps">
          <div
            v-for="(label, i) in stepLabels"
            :key="label"
            class="wizard-step"
            :class="{
              'wizard-step--active': step === i + 1,
              'wizard-step--done':   step > i + 1,
            }"
          >
            <div class="wizard-step__dot">
              <q-icon v-if="step > i + 1" name="mdi-check" size="11px" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="wizard-step__label">{{ label }}</span>
            <div v-if="i < stepLabels.length - 1" class="wizard-step__line" />
          </div>
        </div>

        <!-- ── Step 1: Identity ── -->
        <div v-if="step === 1" class="form-body">

          <div class="form-row">
            <label class="form-label">Chain name <span class="required">*</span></label>
            <div class="field-wrap">
              <input
                v-model="chainName"
                class="fs-input fs-mono"
                :class="{ 'fs-input--error': chainNameError }"
                placeholder="my-chain"
                @keydown.enter.prevent="goToStep2"
              />
              <span v-if="chainNameError" class="field-error">{{ chainNameError }}</span>
              <span v-else class="field-hint">Lowercase, alphanumeric and hyphens; used as the Kubernetes resource name</span>
            </div>
          </div>

          <div class="form-actions">
            <button class="fs-btn fs-btn--primary" @click="goToStep2">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>

        </div>

        <!-- ── Step 2: Step ── -->
        <div v-else-if="step === 2" class="form-body">

          <div class="form-row">
            <label class="form-label">Step name <span class="required">*</span></label>
            <div class="field-wrap">
              <input
                v-model="stepName"
                class="fs-input fs-mono"
                :class="{ 'fs-input--error': stepNameError }"
                placeholder="step-1"
              />
              <span v-if="stepNameError" class="field-error">{{ stepNameError }}</span>
              <span v-else class="field-hint">Unique identifier for this step within the chain</span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Step kind <span class="required">*</span></label>
            <div class="field-wrap">
              <div class="kind-toggle">
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': stepKind === 'Job' }"
                  @click="stepKind = 'Job'"
                >
                  <q-icon name="mdi-briefcase-outline" size="14px" />
                  Job
                </button>
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': stepKind === 'Deploy' }"
                  @click="stepKind = 'Deploy'"
                >
                  <q-icon name="mdi-server-outline" size="14px" />
                  Service
                </button>
              </div>
              <span class="field-hint">
                Job runs a batch workload to completion; Service creates a long-running service
              </span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Template <span class="required">*</span></label>
            <div class="field-wrap">
              <div v-if="loadingTemplates" class="picker-loading">
                <q-spinner size="14px" /> Loading templates…
              </div>
              <div v-else-if="loadTemplateError" class="picker-error">
                <q-icon name="mdi-alert-circle-outline" size="13px" />
                {{ loadTemplateError }}
                <button class="retry-link" @click="loadTemplatesForKind(stepKind)">Retry</button>
              </div>
              <template v-else>
                <select
                  v-model="selectedTemplate"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': templateError }"
                >
                  <option value="" disabled>— select a {{ stepKind === 'Job' ? 'job' : 'service' }} template —</option>
                  <option
                    v-for="t in (stepKind === 'Job' ? jobTemplates : serviceTemplates)"
                    :key="t.metadata.name"
                    :value="t.metadata.name"
                  >
                    {{ t.metadata.name }}
                  </option>
                </select>
                <span v-if="templateError" class="field-error">{{ templateError }}</span>
                <span v-else-if="(stepKind === 'Job' ? jobTemplates : serviceTemplates).length === 0" class="field-hint warn-hint">
                  <q-icon name="mdi-alert-outline" size="11px" />
                  No {{ stepKind === 'Job' ? 'job' : 'service' }} templates found — create one first
                </span>
                <span v-else class="field-hint">
                  {{ (stepKind === 'Job' ? jobTemplates : serviceTemplates).length }}
                  {{ stepKind === 'Job' ? 'job' : 'service' }} template{{ (stepKind === 'Job' ? jobTemplates : serviceTemplates).length !== 1 ? 's' : '' }} available
                </span>
              </template>
            </div>
          </div>

          <div class="form-actions">
            <button class="fs-btn fs-btn--ghost" @click="step = 1">
              <q-icon name="mdi-arrow-left" size="14px" /> Back
            </button>
            <button class="fs-btn fs-btn--primary" :disabled="loadingTemplates" @click="goToStep3">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>

        </div>

        <!-- ── Step 3: Overrides ── -->
        <div v-else class="form-body">

          <div class="section-title">Environment variable overrides</div>

          <div class="form-row form-row--top">
            <label class="form-label">Env overrides</label>
            <div class="field-wrap">
              <div class="env-table">
                <div class="env-header">
                  <span class="env-header__key">Key</span>
                  <span class="env-header__val">Value</span>
                </div>
                <div
                  v-for="(row, i) in envRows"
                  :key="i"
                  class="env-row"
                >
                  <input
                    v-model="row.key"
                    class="fs-input fs-mono env-input"
                    placeholder="MY_VAR"
                  />
                  <input
                    v-model="row.value"
                    class="fs-input fs-mono env-input"
                    placeholder="value"
                  />
                  <button class="icon-btn icon-btn--danger" title="Remove" @click="removeEnvRow(i)">
                    <q-icon name="mdi-close" size="13px" />
                  </button>
                </div>
              </div>
              <button class="fs-btn fs-btn--ghost add-env-btn" @click="addEnvRow">
                <q-icon name="mdi-plus" size="13px" />
                Add variable
              </button>
              <span class="field-hint">
                These override or extend the env vars defined in the referenced template
              </span>
            </div>
          </div>

          <!-- Summary box -->
          <div class="summary-box">
            <div class="summary-box__title">
              <q-icon name="mdi-information-outline" size="13px" />
              Chain summary
            </div>
            <ul class="summary-list">
              <li><span class="sum-key">chain name</span> <span class="sum-val fs-mono">{{ chainName }}</span></li>
              <li><span class="sum-key">step name</span>  <span class="sum-val fs-mono">{{ stepName }}</span></li>
              <li><span class="sum-key">step kind</span>  <span class="sum-val fs-mono">{{ stepKind === 'Deploy' ? 'Service' : stepKind }}</span></li>
              <li><span class="sum-key">template</span>   <span class="sum-val fs-mono">{{ selectedTemplate }}</span></li>
            </ul>
          </div>

          <!-- Submit error -->
          <div v-if="submitError" class="inline-msg inline-msg--error">
            <q-icon name="mdi-alert-circle-outline" size="13px" />
            {{ submitError }}
          </div>

          <div class="form-actions">
            <button class="fs-btn fs-btn--ghost" :disabled="submitting" @click="step = 2">
              <q-icon name="mdi-arrow-left" size="14px" /> Back
            </button>
            <button class="fs-btn fs-btn--primary" :disabled="submitting" @click="submit">
              <q-spinner v-if="submitting" size="13px" color="white" />
              <q-icon v-else name="mdi-check-outline" size="14px" />
              {{ submitting ? 'Creating…' : 'Create Chain' }}
            </button>
          </div>

        </div>

      </template>
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
.breadcrumb__back:hover {
  color: var(--fs-text-primary);
  background: var(--fs-bg-hover);
}
.breadcrumb__current { font-size: 12px; color: var(--fs-accent); font-weight: 500; }
.muted-icon { color: var(--fs-text-muted); }

/* Wizard step indicator */
.wizard-steps {
  display: flex;
  align-items: center;
  padding: 16px 10px 24px;
}
.wizard-step {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.wizard-step:last-child { flex: none; }
.wizard-step__dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
  border: 1.5px solid var(--fs-border);
  color: var(--fs-text-muted);
  background: var(--fs-bg-panel);
  transition: border-color var(--fs-ease), background var(--fs-ease), color var(--fs-ease);
}
.wizard-step--active .wizard-step__dot { border-color: var(--fs-accent); background: var(--fs-accent); color: #fff; }
.wizard-step--done   .wizard-step__dot { border-color: var(--fs-pos, #4caf50); background: var(--fs-pos, #4caf50); color: #fff; }
.wizard-step__label {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--fs-text-muted);
  white-space: nowrap;
  transition: color var(--fs-ease);
}
.wizard-step--active .wizard-step__label,
.wizard-step--done   .wizard-step__label { color: var(--fs-text-primary); }
.wizard-step__line {
  flex: 1;
  height: 1px;
  background: var(--fs-border);
  margin: 0 8px;
}

/* Form layout */
.form-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 10px 10px;
}
.form-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: center;
  gap: 12px;
}
.form-row--top { align-items: start; padding-top: 4px; }
.form-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  padding-top: 8px;
}
.required { color: var(--fs-neg, #e57373); }
.field-wrap { display: flex; flex-direction: column; gap: 4px; }
.field-error { font-size: 11px; color: var(--fs-neg, #e57373); }
.field-hint  { font-size: 11px; color: var(--fs-text-muted); }
.warn-hint   { color: var(--fs-warn, #ff9800); display: flex; align-items: center; gap: 4px; }

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
.fs-input:focus   { border-color: var(--fs-accent); }
.fs-input--error  { border-color: var(--fs-neg, #e57373); }
.fs-mono { font-family: var(--fs-font-mono); }

/* Step kind toggle */
.kind-toggle {
  display: flex;
  gap: 6px;
}
.kind-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--fs-border);
  background: transparent;
  color: var(--fs-text-muted);
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease);
}
.kind-btn:hover { background: var(--fs-bg-hover); color: var(--fs-text-primary); }
.kind-btn--active {
  border-color: var(--fs-accent);
  background: color-mix(in srgb, var(--fs-accent) 12%, transparent);
  color: var(--fs-accent);
}

/* Template picker states */
.picker-loading,
.picker-error {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--fs-text-muted);
  padding: 8px 0;
}
.picker-error { color: var(--fs-neg, #e57373); }
.retry-link {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fs-accent);
  font-size: 12px;
  padding: 0;
  text-decoration: underline;
}

/* Section title */
.section-title {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  padding: 0 2px 4px;
  border-bottom: 1px solid var(--fs-border);
}

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
.env-row {
  display: grid;
  grid-template-columns: 1fr 1fr 28px;
  gap: 6px;
  align-items: center;
}
.env-input { padding: 5px 8px; font-size: 12px; }

.add-env-btn {
  align-self: flex-start;
  padding: 4px 10px;
  font-size: 11.5px;
  margin-top: 2px;
}

/* Summary box */
.summary-box {
  background: var(--fs-bg-hover);
  border: 1px solid var(--fs-border);
  border-radius: 5px;
  padding: 10px 14px;
}
.summary-box__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--fs-text-muted);
  margin-bottom: 8px;
}
.summary-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.summary-list li { display: flex; align-items: baseline; gap: 8px; font-size: 11.5px; }
.sum-key {
  font-family: var(--fs-font-mono);
  color: var(--fs-accent);
  min-width: 100px;
  font-size: 11px;
}
.sum-val { color: var(--fs-text-muted); }

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

/* Action bar */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
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
.fs-btn--primary {
  background: var(--fs-accent);
  color: #fff;
  border-color: var(--fs-accent);
}
.fs-btn--primary:hover:not(:disabled) { filter: brightness(1.1); }
.fs-btn--ghost {
  background: transparent;
  color: var(--fs-text-muted);
  border-color: var(--fs-border);
}
.fs-btn--ghost:hover:not(:disabled) {
  color: var(--fs-text-primary);
  background: var(--fs-bg-hover);
  border-color: var(--fs-border-bright, var(--fs-border));
}

/* Icon button */
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
