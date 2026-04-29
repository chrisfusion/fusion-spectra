<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as weaveApi from '@/api/weaveApi'

const router = useRouter()

// ─── Wizard state ─────────────────────────────────────────────────────────────

const step = ref<1 | 2 | 3>(1)
const stepLabels = ['Identity', 'Activation', 'Parameters'] as const

// ─── Step 1: trigger name + chain picker ──────────────────────────────────────

const triggerName      = ref('')
const triggerNameError = ref<string | null>(null)
const selectedChain    = ref('')
const chainError       = ref<string | null>(null)

const chains             = ref<weaveApi.WeaveChain[]>([])
const loadingChains      = ref(false)
const loadChainError     = ref<string | null>(null)

const K8S_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/

async function loadChains() {
  loadingChains.value  = true
  loadChainError.value = null
  try {
    const res = await weaveApi.listWeaveChains()
    chains.value = res.items ?? []
  } catch (e) {
    loadChainError.value = e instanceof Error ? e.message : 'Failed to load chains'
  } finally {
    loadingChains.value = false
  }
}

function validateStep1(): boolean {
  let ok = true
  const n = triggerName.value.trim()
  if (!n) {
    triggerNameError.value = 'Name is required'
    ok = false
  } else if (!K8S_NAME_RE.test(n)) {
    triggerNameError.value = 'Lowercase letters, digits and hyphens only; must start and end with alphanumeric'
    ok = false
  } else if (n.length > 253) {
    triggerNameError.value = 'Max 253 characters'
    ok = false
  } else {
    triggerNameError.value = null
  }
  if (!selectedChain.value) {
    chainError.value = 'Select a chain'
    ok = false
  } else {
    chainError.value = null
  }
  return ok
}

function goToStep2() {
  if (validateStep1()) step.value = 2
}

// ─── Step 2: trigger type + conditional fields ────────────────────────────────

const triggerType  = ref<'OnDemand' | 'Cron' | 'Webhook'>('OnDemand')
const schedule     = ref('')
const scheduleError = ref<string | null>(null)
const webhookPath  = ref('/trigger/')
const webhookPathError = ref<string | null>(null)
const webhookSecret = ref('')

// Minimal cron expression format check (5 or 6 fields)
const CRON_RE = /^(\S+\s+){4}\S+(\s+\S+)?$/

watch(triggerType, () => {
  scheduleError.value    = null
  webhookPathError.value = null
})

function validateStep2(): boolean {
  let ok = true
  if (triggerType.value === 'Cron') {
    const s = schedule.value.trim()
    if (!s) {
      scheduleError.value = 'Schedule is required'
      ok = false
    } else if (!CRON_RE.test(s)) {
      scheduleError.value = 'Must be a valid cron expression, e.g. "*/5 * * * *"'
      ok = false
    } else {
      scheduleError.value = null
    }
  }
  if (triggerType.value === 'Webhook') {
    const p = webhookPath.value.trim()
    if (!p || !p.startsWith('/')) {
      webhookPathError.value = 'Path must start with /'
      ok = false
    } else if (p.length < 2) {
      webhookPathError.value = 'Path must be at least 2 characters'
      ok = false
    } else {
      webhookPathError.value = null
    }
  }
  return ok
}

function goToStep3() {
  if (validateStep2()) step.value = 3
}

// ─── Step 3: parameter overrides ─────────────────────────────────────────────

interface EnvRow { key: string; value: string }
const paramRows = ref<EnvRow[]>([{ key: '', value: '' }])

function addParamRow() {
  paramRows.value = [...paramRows.value, { key: '', value: '' }]
}
function removeParamRow(i: number) {
  const rows = paramRows.value.filter((_, idx) => idx !== i)
  paramRows.value = rows.length > 0 ? rows : [{ key: '', value: '' }]
}

// ─── Submit ───────────────────────────────────────────────────────────────────

const submitting      = ref(false)
const submitError     = ref<string | null>(null)
const createdTrigger  = ref<weaveApi.WeaveTrigger | null>(null)

function buildSpec(): weaveApi.WeaveTriggerSpec {
  const spec: weaveApi.WeaveTriggerSpec = {
    chainRef: { name: selectedChain.value },
    type:     triggerType.value,
  }

  if (triggerType.value === 'Cron') {
    spec.schedule = schedule.value.trim()
  }

  if (triggerType.value === 'Webhook') {
    spec.webhook = { path: webhookPath.value.trim() }
    if (webhookSecret.value.trim()) {
      spec.webhook.secretRef = { name: webhookSecret.value.trim() }
    }
  }

  const overrides = paramRows.value
    .filter(r => r.key.trim())
    .map(r => ({ name: r.key.trim(), value: r.value }))
  if (overrides.length) spec.parameterOverrides = overrides

  return spec
}

async function submit() {
  submitting.value  = true
  submitError.value = null
  try {
    createdTrigger.value = await weaveApi.createWeaveTrigger({
      metadata: { name: triggerName.value.trim() },
      spec:     buildSpec(),
    })
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Creation failed'
  } finally {
    submitting.value = false
  }
}

function createAnother() {
  triggerName.value      = ''
  triggerNameError.value = null
  selectedChain.value    = ''
  chainError.value       = null
  triggerType.value      = 'OnDemand'
  schedule.value         = ''
  scheduleError.value    = null
  webhookPath.value      = '/trigger/'
  webhookPathError.value = null
  webhookSecret.value    = ''
  paramRows.value        = [{ key: '', value: '' }]
  submitError.value      = null
  createdTrigger.value   = null
  step.value             = 1
}

// Load chains on mount
loadChains()
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/pipelines/weave/triggers')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Weave Triggers
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">Create Trigger</span>
    </div>

    <CanvasPanel title="Create Weave Trigger" icon="mdi-plus-circle-outline" :wide="true">

      <!-- ── Success state ── -->
      <div v-if="createdTrigger" class="success-body">
        <q-icon name="mdi-check-circle-outline" size="48px" class="success-icon" />
        <p class="success-title">Trigger created</p>
        <p class="success-sub">
          <span class="fs-mono">{{ createdTrigger.metadata.name }}</span>
          is now registered and will activate chain
          <span class="fs-mono">{{ createdTrigger.spec.chainRef.name }}</span>.
        </p>
        <div class="success-actions">
          <button class="fs-btn fs-btn--ghost" @click="router.push('/pipelines/weave/triggers')">
            <q-icon name="mdi-format-list-bulleted" size="14px" />
            View Triggers
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
            <label class="form-label">Trigger name <span class="required">*</span></label>
            <div class="field-wrap">
              <input
                v-model="triggerName"
                class="fs-input fs-mono"
                :class="{ 'fs-input--error': triggerNameError }"
                placeholder="my-trigger"
                @keydown.enter.prevent="goToStep2"
              />
              <span v-if="triggerNameError" class="field-error">{{ triggerNameError }}</span>
              <span v-else class="field-hint">Lowercase, alphanumeric and hyphens; used as the Kubernetes resource name</span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Chain <span class="required">*</span></label>
            <div class="field-wrap">
              <div v-if="loadingChains" class="picker-loading">
                <q-spinner size="14px" /> Loading chains…
              </div>
              <div v-else-if="loadChainError" class="picker-error">
                <q-icon name="mdi-alert-circle-outline" size="13px" />
                {{ loadChainError }}
                <button class="retry-link" @click="loadChains">Retry</button>
              </div>
              <template v-else>
                <select
                  v-model="selectedChain"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': chainError }"
                >
                  <option value="" disabled>— select a chain —</option>
                  <option v-for="c in chains" :key="c.metadata.name" :value="c.metadata.name">
                    {{ c.metadata.name }}
                  </option>
                </select>
                <span v-if="chainError" class="field-error">{{ chainError }}</span>
                <span v-else-if="chains.length === 0" class="field-hint warn-hint">
                  <q-icon name="mdi-alert-outline" size="11px" />
                  No chains found — create one first
                </span>
                <span v-else class="field-hint">{{ chains.length }} chain{{ chains.length !== 1 ? 's' : '' }} available</span>
              </template>
            </div>
          </div>

          <div class="form-actions">
            <button class="fs-btn fs-btn--primary" :disabled="loadingChains" @click="goToStep2">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>

        </div>

        <!-- ── Step 2: Activation ── -->
        <div v-else-if="step === 2" class="form-body">

          <div class="form-row">
            <label class="form-label">Type <span class="required">*</span></label>
            <div class="field-wrap">
              <div class="kind-toggle">
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': triggerType === 'OnDemand' }"
                  @click="triggerType = 'OnDemand'"
                >
                  <q-icon name="mdi-hand-back-right-outline" size="14px" />
                  OnDemand
                </button>
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': triggerType === 'Cron' }"
                  @click="triggerType = 'Cron'"
                >
                  <q-icon name="mdi-clock-outline" size="14px" />
                  Cron
                </button>
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': triggerType === 'Webhook' }"
                  @click="triggerType = 'Webhook'"
                >
                  <q-icon name="mdi-webhook" size="14px" />
                  Webhook
                </button>
              </div>
              <span class="field-hint">
                <template v-if="triggerType === 'OnDemand'">Fired manually via annotation or API</template>
                <template v-else-if="triggerType === 'Cron'">Fires on a cron schedule</template>
                <template v-else>Fires on an incoming HTTP POST</template>
              </span>
            </div>
          </div>

          <!-- Cron: schedule -->
          <div v-if="triggerType === 'Cron'" class="form-row">
            <label class="form-label">Schedule <span class="required">*</span></label>
            <div class="field-wrap">
              <input
                v-model="schedule"
                class="fs-input fs-mono"
                :class="{ 'fs-input--error': scheduleError }"
                placeholder="*/5 * * * *"
              />
              <span v-if="scheduleError" class="field-error">{{ scheduleError }}</span>
              <span v-else class="field-hint">Standard cron expression (minute hour day month weekday)</span>
            </div>
          </div>

          <!-- Webhook: path + optional secret -->
          <template v-if="triggerType === 'Webhook'">
            <div class="form-row">
              <label class="form-label">Path <span class="required">*</span></label>
              <div class="field-wrap">
                <input
                  v-model="webhookPath"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': webhookPathError }"
                  placeholder="/trigger/my-chain"
                />
                <span v-if="webhookPathError" class="field-error">{{ webhookPathError }}</span>
                <span v-else class="field-hint">URL path the webhook server listens on; must start with /</span>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Secret ref</label>
              <div class="field-wrap">
                <input
                  v-model="webhookSecret"
                  class="fs-input fs-mono"
                  placeholder="my-webhook-secret"
                />
                <span class="field-hint">Name of a Kubernetes Secret with a "token" key for bearer auth; leave blank for unauthenticated</span>
              </div>
            </div>
          </template>

          <div class="form-actions">
            <button class="fs-btn fs-btn--ghost" @click="step = 1">
              <q-icon name="mdi-arrow-left" size="14px" /> Back
            </button>
            <button class="fs-btn fs-btn--primary" @click="goToStep3">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>

        </div>

        <!-- ── Step 3: Parameters ── -->
        <div v-else class="form-body">

          <div class="section-title">Parameter overrides</div>

          <div class="form-row form-row--top">
            <label class="form-label">Overrides</label>
            <div class="field-wrap">
              <div class="env-table">
                <div class="env-header">
                  <span class="env-header__key">Key</span>
                  <span class="env-header__val">Value</span>
                </div>
                <div
                  v-for="(row, i) in paramRows"
                  :key="i"
                  class="env-row"
                >
                  <input
                    v-model="row.key"
                    class="fs-input fs-mono env-input"
                    placeholder="MY_PARAM"
                  />
                  <input
                    v-model="row.value"
                    class="fs-input fs-mono env-input"
                    placeholder="value"
                  />
                  <button class="icon-btn icon-btn--danger" title="Remove" @click="removeParamRow(i)">
                    <q-icon name="mdi-close" size="13px" />
                  </button>
                </div>
              </div>
              <button class="fs-btn fs-btn--ghost add-env-btn" @click="addParamRow">
                <q-icon name="mdi-plus" size="13px" />
                Add parameter
              </button>
              <span class="field-hint">Injected into every WeaveRun created by this trigger, on top of per-step env vars</span>
            </div>
          </div>

          <!-- Summary box -->
          <div class="summary-box">
            <div class="summary-box__title">
              <q-icon name="mdi-information-outline" size="13px" />
              Trigger summary
            </div>
            <ul class="summary-list">
              <li><span class="sum-key">trigger name</span> <span class="sum-val fs-mono">{{ triggerName }}</span></li>
              <li><span class="sum-key">chain</span>        <span class="sum-val fs-mono">{{ selectedChain }}</span></li>
              <li><span class="sum-key">type</span>         <span class="sum-val fs-mono">{{ triggerType }}</span></li>
              <li v-if="triggerType === 'Cron'"><span class="sum-key">schedule</span> <span class="sum-val fs-mono">{{ schedule }}</span></li>
              <li v-if="triggerType === 'Webhook'"><span class="sum-key">path</span>  <span class="sum-val fs-mono">{{ webhookPath }}</span></li>
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
              {{ submitting ? 'Creating…' : 'Create Trigger' }}
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

.wizard-steps { display: flex; align-items: center; padding: 16px 10px 24px; }
.wizard-step { display: flex; align-items: center; gap: 8px; flex: 1; }
.wizard-step:last-child { flex: none; }
.wizard-step__dot {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; flex-shrink: 0;
  border: 1.5px solid var(--fs-border);
  color: var(--fs-text-muted); background: var(--fs-bg-panel);
  transition: border-color var(--fs-ease), background var(--fs-ease), color var(--fs-ease);
}
.wizard-step--active .wizard-step__dot { border-color: var(--fs-accent); background: var(--fs-accent); color: #fff; }
.wizard-step--done   .wizard-step__dot { border-color: var(--fs-pos, #4caf50); background: var(--fs-pos, #4caf50); color: #fff; }
.wizard-step__label { font-size: 11.5px; font-weight: 500; color: var(--fs-text-muted); white-space: nowrap; transition: color var(--fs-ease); }
.wizard-step--active .wizard-step__label,
.wizard-step--done   .wizard-step__label { color: var(--fs-text-primary); }
.wizard-step__line { flex: 1; height: 1px; background: var(--fs-border); margin: 0 8px; }

.form-body { display: flex; flex-direction: column; gap: 20px; padding: 0 10px 10px; }
.form-row { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 12px; }
.form-row--top { align-items: start; padding-top: 4px; }
.form-label {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted); padding-top: 8px;
}
.required { color: var(--fs-neg, #e57373); }
.field-wrap { display: flex; flex-direction: column; gap: 4px; }
.field-error { font-size: 11px; color: var(--fs-neg, #e57373); }
.field-hint  { font-size: 11px; color: var(--fs-text-muted); }
.warn-hint   { color: var(--fs-warn, #ff9800); display: flex; align-items: center; gap: 4px; }

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
.fs-mono { font-family: var(--fs-font-mono); }

.kind-toggle { display: flex; gap: 6px; }
.kind-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 4px; font-size: 12px;
  font-family: inherit; font-weight: 500; cursor: pointer;
  border: 1px solid var(--fs-border); background: transparent;
  color: var(--fs-text-muted);
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease);
}
.kind-btn:hover { background: var(--fs-bg-hover); color: var(--fs-text-primary); }
.kind-btn--active {
  border-color: var(--fs-accent);
  background: color-mix(in srgb, var(--fs-accent) 12%, transparent);
  color: var(--fs-accent);
}

.picker-loading,
.picker-error {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--fs-text-muted); padding: 8px 0;
}
.picker-error { color: var(--fs-neg, #e57373); }
.retry-link {
  background: none; border: none; cursor: pointer;
  color: var(--fs-accent); font-size: 12px; padding: 0; text-decoration: underline;
}

.section-title {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted);
  padding: 0 2px 4px; border-bottom: 1px solid var(--fs-border);
}

.env-table { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.env-header { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; padding: 0 2px 2px; }
.env-header__key,
.env-header__val {
  font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--fs-text-muted);
}
.env-row { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; align-items: center; }
.env-input { padding: 5px 8px; font-size: 12px; }
.add-env-btn { align-self: flex-start; padding: 4px 10px; font-size: 11.5px; margin-top: 2px; }

.summary-box {
  background: var(--fs-bg-hover); border: 1px solid var(--fs-border);
  border-radius: 5px; padding: 10px 14px;
}
.summary-box__title {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; color: var(--fs-text-muted); margin-bottom: 8px;
}
.summary-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.summary-list li { display: flex; align-items: baseline; gap: 8px; font-size: 11.5px; }
.sum-key { font-family: var(--fs-font-mono); color: var(--fs-accent); min-width: 100px; font-size: 11px; }
.sum-val { color: var(--fs-text-muted); }

.inline-msg {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; padding: 8px 10px; border-radius: 4px;
}
.inline-msg--error {
  color: var(--fs-neg, #e57373);
  background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent);
}

.form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

.fs-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 16px; border-radius: 4px; font-size: 12.5px;
  font-family: inherit; font-weight: 500; cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease), filter var(--fs-ease);
}
.fs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fs-btn--primary { background: var(--fs-accent); color: #fff; border-color: var(--fs-accent); }
.fs-btn--primary:hover:not(:disabled) { filter: brightness(1.1); }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.fs-btn--ghost:hover:not(:disabled) {
  color: var(--fs-text-primary); background: var(--fs-bg-hover);
  border-color: var(--fs-border-bright, var(--fs-border));
}

.icon-btn {
  background: none; border: none; cursor: pointer; padding: 4px 6px;
  border-radius: 3px; display: inline-flex; align-items: center;
  color: var(--fs-text-muted); transition: color var(--fs-ease), background var(--fs-ease);
}
.icon-btn--danger:hover { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

.success-body {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 48px 24px 40px; text-align: center;
}
.success-icon  { color: var(--fs-pos, #4caf50); }
.success-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--fs-text-primary); }
.success-sub   { margin: 0; font-size: 12.5px; color: var(--fs-text-muted); }
.success-actions { margin-top: 8px; display: flex; gap: 8px; }
</style>
