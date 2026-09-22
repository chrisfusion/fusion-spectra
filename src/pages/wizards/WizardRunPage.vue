<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import CronPicker from '@/components/CronPicker.vue'
import TagChipInput from '@/components/TagChipInput.vue'
import * as wizardApi from '@/api/wizardApi'
import { wizardDisplayMeta, wizardTitleOverrides } from '@/data/wizardDisplayMeta'
import type { WizardFieldDisplayMeta } from '@/data/wizardDisplayMeta'

// Generic wizard-run page: renders its Setup form from a WizardDefinition's own parameter
// schema (fusion-wizard backend), instead of one hand-written page per wizard. A definition
// needs zero frontend code to get a working wizard here; wizardDisplayMeta.ts is only for
// polishing a specific definition's labels/widgets/conditional fields.

const route  = useRoute()
const router = useRouter()
const defName = route.params.definition as string

type ProgressStatus = 'pending' | 'running' | 'done' | 'error'

const step       = ref<1 | 2 | 3>(1)
const stepLabels = ['Setup', 'Provisioning', 'Done'] as const

const definition = ref<wizardApi.WizardDefinition | null>(null)
const loadError  = ref<string | null>(null)
const loading    = ref(true)

// ─── Setup form state ────────────────────────────────────────────────────────

const fields       = reactive<Record<string, string | string[] | boolean>>({})
const fieldErrors  = reactive<Record<string, string | null>>({})

function defaultValueFor(p: wizardApi.WizardParameter): string | string[] | boolean {
  if (p.default !== undefined && p.default !== null) {
    if (p.type === 'stringList') return Array.isArray(p.default) ? p.default as string[] : []
    if (p.type === 'boolean')    return Boolean(p.default)
    return String(p.default)
  }
  if (p.type === 'stringList') return []
  if (p.type === 'boolean')    return false
  return ''
}

function resetFields() {
  if (!definition.value) return
  for (const p of definition.value.spec.parameters) {
    fields[p.name]      = defaultValueFor(p)
    fieldErrors[p.name] = null
  }
}

async function loadDefinition() {
  loading.value   = true
  loadError.value = null
  try {
    definition.value = await wizardApi.getDefinition(defName)
    resetFields()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load this wizard'
  } finally {
    loading.value = false
  }
}
onMounted(loadDefinition)

function metaFor(name: string): WizardFieldDisplayMeta {
  return wizardDisplayMeta[defName]?.[name] ?? {}
}
function labelFor(p: wizardApi.WizardParameter): string {
  return metaFor(p.name).label
    ?? p.name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase())
}
function helpFor(p: wizardApi.WizardParameter): string | undefined {
  return metaFor(p.name).help ?? (p.description || undefined)
}
function widgetFor(p: wizardApi.WizardParameter): NonNullable<WizardFieldDisplayMeta['widget']> {
  const w = metaFor(p.name).widget
  if (w) return w
  if (p.type === 'stringList') return 'tags'
  if (p.type === 'boolean')    return 'checkbox'
  return 'text'
}
function isVisible(p: wizardApi.WizardParameter): boolean {
  const showIf = metaFor(p.name).showIf
  if (!showIf) return true
  return fields[showIf.field] === showIf.equals
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateSetup(): boolean {
  if (!definition.value) return false
  let ok = true
  for (const p of definition.value.spec.parameters) {
    fieldErrors[p.name] = null
    if (!isVisible(p)) continue
    const v = fields[p.name]
    const empty = p.type === 'stringList'
      ? (v as string[]).length === 0
      : typeof v === 'string' && v.trim() === ''
    if (p.required && empty) {
      fieldErrors[p.name] = 'Required'
      ok = false
      continue
    }
    if (p.pattern && typeof v === 'string' && v.trim() !== '') {
      try {
        if (!new RegExp(p.pattern).test(v.trim())) {
          fieldErrors[p.name] = `Must match pattern: ${p.pattern}`
          ok = false
        }
      } catch { /* a bad pattern on the definition itself isn't this form's problem */ }
    }
  }
  return ok
}

function buildParameters(): Record<string, unknown> {
  if (!definition.value) return {}
  const out: Record<string, unknown> = {}
  for (const p of definition.value.spec.parameters) {
    if (!isVisible(p)) continue
    const v = fields[p.name]
    if (p.type === 'stringList') { out[p.name] = v; continue }
    if (p.type === 'boolean')    { out[p.name] = Boolean(v); continue }
    if (p.type === 'number') {
      const n = Number(v)
      if (!Number.isNaN(n) && v !== '') out[p.name] = n
      continue
    }
    if (typeof v === 'string' && v.trim() !== '') out[p.name] = v.trim()
  }
  return out
}

// ─── Provisioning ───────────────────────────────────────────────────────────

const runName        = ref<string | null>(null)
const run             = ref<wizardApi.WizardRun | null>(null)
const provisionError  = ref<string | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null
let cancelled = false
onUnmounted(() => { cancelled = true; stopPolling() })

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

const FAILED_PHASES: wizardApi.RunPhase[] = ['Failed', 'RollbackFailed']

async function pollRun() {
  if (!runName.value || cancelled) return
  try {
    const r = await wizardApi.getRun(runName.value)
    if (cancelled) return
    run.value = r
    if (r.status.phase === 'Ready') {
      stopPolling()
      step.value = 3
    } else if (r.status.phase && FAILED_PHASES.includes(r.status.phase)) {
      stopPolling()
      provisionError.value = r.status.message || `The run ${r.status.phase.toLowerCase()}.`
    } else if (r.status.phase === 'RolledBack') {
      stopPolling()
      provisionError.value = 'The run was rolled back.'
    }
  } catch (e) {
    stopPolling()
    provisionError.value = e instanceof Error ? e.message : 'Failed to check run status'
  }
}

async function startWizard() {
  if (!validateSetup()) return
  step.value            = 2
  provisionError.value  = null
  run.value             = null
  try {
    const created = await wizardApi.createRun({ definition: defName, parameters: buildParameters() })
    if (cancelled) return
    runName.value = created.name
    run.value     = created
    pollTimer     = setInterval(pollRun, 2000)
    await pollRun()
  } catch (e) {
    provisionError.value = e instanceof Error ? e.message : 'Failed to start the wizard'
  }
}

async function retry() {
  if (!runName.value) return
  provisionError.value = null
  try {
    await wizardApi.retryRun(runName.value)
    pollTimer = setInterval(pollRun, 2000)
    await pollRun()
  } catch (e) {
    provisionError.value = e instanceof Error ? e.message : 'Retry failed'
  }
}

async function rollback() {
  if (!runName.value) return
  try {
    await wizardApi.rollbackRun(runName.value)
    provisionError.value = null
    pollTimer = setInterval(pollRun, 2000)
    await pollRun()
  } catch (e) {
    provisionError.value = e instanceof Error ? e.message : 'Rollback failed'
  }
}

function createAnother() {
  step.value            = 1
  runName.value          = null
  run.value              = null
  provisionError.value   = null
  resetFields()
}

// ─── Progress list ──────────────────────────────────────────────────────────

const STEP_TYPE_LABEL: Record<string, string> = {
  gitWatcher:  'GitOps watcher',
  waitBuild:   'Building artifact',
  tag:         'Assigning tag',
  jobTemplate: 'Job blueprint',
  chain:       'Run blueprint (chain)',
  trigger:     'Trigger',
  batchTrigger: 'BatchCron trigger',
}
function stepLabel(name: string, type?: string, item?: string): string {
  const base = (type && STEP_TYPE_LABEL[type]) || name
  return item ? `${base} — ${item}` : base
}

const STEP_PHASE_TO_PROGRESS: Record<string, ProgressStatus> = {
  Pending: 'pending', Running: 'running', Succeeded: 'done',
  Failed: 'error', RolledBack: 'error', RollbackFailed: 'error',
}

interface ProgressItem { key: string, label: string, status: ProgressStatus, detail?: string }

const progress = computed<ProgressItem[]>(() => {
  if (run.value?.status.steps?.length) {
    return run.value.status.steps.map(s => ({
      key:    s.key,
      label:  stepLabel(s.name, s.type, s.item),
      status: (s.phase ? STEP_PHASE_TO_PROGRESS[s.phase] : 'pending') ?? 'pending',
      detail: s.message,
    }))
  }
  return (definition.value?.spec.steps ?? []).map(s => ({
    key: s.name, label: stepLabel(s.name, s.type), status: 'pending' as ProgressStatus,
  }))
})

const STATUS_ICON: Record<ProgressStatus, string> = {
  pending: 'mdi-circle-outline',
  running: 'mdi-loading',
  done:    'mdi-check-circle-outline',
  error:   'mdi-alert-circle-outline',
}

// ─── Done step ──────────────────────────────────────────────────────────────

const chainName = computed(() => run.value?.status.steps?.find(s => s.type === 'chain')?.outputs?.name)
const TRIGGER_STEP_TYPES = new Set(['trigger', 'batchTrigger'])
const triggerNames = computed(() =>
  (run.value?.status.steps ?? [])
    .filter(s => s.type && TRIGGER_STEP_TYPES.has(s.type) && s.outputs?.name)
    .map(s => s.outputs!.name))

const shortTitle = computed(() =>
  wizardTitleOverrides[defName] ?? defName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
const pageTitle = computed(() => `${shortTitle.value} Wizard`)
const pageDescription = computed(() => definition.value?.spec.description)
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
      <span class="breadcrumb__current">{{ shortTitle }}</span>
    </div>

    <CanvasPanel :title="pageTitle" icon="mdi-creation" :wide="true" :loading="loading" :error="loadError" @refresh="loadDefinition">

      <template v-if="definition">

        <p v-if="pageDescription" class="wizard-desc">{{ pageDescription }}</p>

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

          <template v-for="p in definition.spec.parameters" :key="p.name">
            <div v-if="isVisible(p)" class="form-row" :class="{ 'form-row--top': widgetFor(p) === 'tags' || widgetFor(p) === 'textarea' }">
              <label class="form-label">
                {{ labelFor(p) }} <span v-if="p.required" class="required">*</span>
              </label>
              <div class="field-wrap">

                <input
                  v-if="widgetFor(p) === 'text'"
                  v-model="(fields[p.name] as string)"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': fieldErrors[p.name] }"
                  :placeholder="metaFor(p.name).placeholder"
                />

                <textarea
                  v-else-if="widgetFor(p) === 'textarea'"
                  v-model="(fields[p.name] as string)"
                  class="fs-input fs-mono fs-textarea"
                  :class="{ 'fs-input--error': fieldErrors[p.name] }"
                  rows="10"
                  :placeholder="metaFor(p.name).placeholder"
                ></textarea>

                <select
                  v-else-if="widgetFor(p) === 'select'"
                  v-model="(fields[p.name] as string)"
                  class="fs-input fs-select"
                >
                  <option v-for="o in metaFor(p.name).options" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>

                <CronPicker
                  v-else-if="widgetFor(p) === 'cron'"
                  v-model="(fields[p.name] as string)"
                />

                <TagChipInput
                  v-else-if="widgetFor(p) === 'tags'"
                  v-model="(fields[p.name] as string[])"
                />

                <label v-else-if="widgetFor(p) === 'checkbox'" class="checkbox-row">
                  <input type="checkbox" v-model="(fields[p.name] as unknown as boolean)" />
                  <span>{{ helpFor(p) }}</span>
                </label>

                <span v-if="fieldErrors[p.name]" class="field-error">{{ fieldErrors[p.name] }}</span>
                <span v-else-if="helpFor(p) && widgetFor(p) !== 'checkbox'" class="field-hint">{{ helpFor(p) }}</span>
              </div>
            </div>
          </template>

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
              <span v-if="item.detail" class="progress-item__detail">{{ item.detail }}</span>
            </div>
          </div>

          <div v-if="provisionError" class="inline-msg inline-msg--error">
            <q-icon name="mdi-alert-circle-outline" size="13px" />
            {{ provisionError }}
          </div>

          <div v-if="provisionError" class="form-actions">
            <button class="fs-btn fs-btn--ghost" @click="rollback">
              <q-icon name="mdi-undo-variant" size="14px" /> Roll Back
            </button>
            <button class="fs-btn fs-btn--primary" @click="retry">
              <q-icon name="mdi-refresh" size="14px" /> Retry
            </button>
          </div>

        </div>

        <!-- ── Step 3: Done ── -->
        <div v-else class="success-body">
          <q-icon name="mdi-check-circle-outline" size="48px" class="success-icon" />
          <p class="success-title">Ready</p>
          <p class="success-sub">
            <span class="fs-mono">{{ runName }}</span> finished provisioning.
          </p>
          <div class="success-actions">
            <button
              v-if="chainName"
              class="fs-btn fs-btn--ghost"
              @click="router.push(`/pipelines/weave/chains/${encodeURIComponent(chainName)}`)"
            >
              <q-icon name="mdi-link-chain" size="14px" /> View Chain
            </button>
            <button
              v-for="t in triggerNames" :key="t"
              class="fs-btn fs-btn--ghost"
              @click="router.push('/pipelines/weave/triggers')"
            >
              <q-icon name="mdi-lightning-bolt-outline" size="14px" /> View Trigger — {{ t }}
            </button>
            <button class="fs-btn fs-btn--primary" @click="createAnother">
              <q-icon name="mdi-plus" size="14px" /> Create Another
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
  display: flex; align-items: center; gap: 5px;
  background: none; border: none; padding: 4px 8px; border-radius: 4px;
  cursor: pointer; color: var(--fs-text-muted); font-size: 12px; font-family: inherit;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.breadcrumb__back:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.breadcrumb__current { font-size: 12px; color: var(--fs-accent); font-weight: 500; }
.muted-icon { color: var(--fs-text-muted); }
.fs-mono { font-family: var(--fs-font-mono); }
.wizard-desc { margin: 0; padding: 4px 10px 0; font-size: 12px; color: var(--fs-text-muted); line-height: 1.5; }

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
.fs-select { cursor: pointer; }
.fs-textarea { resize: vertical; min-height: 140px; }

.checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--fs-text-primary); cursor: pointer; }

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
.progress-item__detail { font-size: 11px; color: var(--fs-text-muted); margin-left: auto; }

/* Info / inline messages */
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
