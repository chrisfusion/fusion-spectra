<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import ChainDagView from '@/components/ChainDagView.vue'
import * as weaveApi from '@/api/weaveApi'

const router = useRouter()

const K8S_NAME_RE  = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/
const stepLabels   = ['Identity', 'Pipeline', 'Review'] as const
const step         = ref<1 | 2 | 3>(1)

// ─── Step 1: Identity ─────────────────────────────────────────────────────────

const chainName         = ref('')
const chainNameError    = ref<string | null>(null)
const failurePolicy     = ref<'' | 'StopAll' | 'ContinueOthers' | 'RetryFailed'>('')
const concurrencyPolicy = ref<'' | 'Wait' | 'Forbid'>('')
const includeStorage    = ref(false)
const storageSize       = ref('1Gi')
const storageSizeError  = ref<string | null>(null)
const storageClass      = ref('')

function validateStep1(): boolean {
  let ok = true
  const n = chainName.value.trim()
  if (!n) {
    chainNameError.value = 'Name is required'
    ok = false
  } else if (!K8S_NAME_RE.test(n)) {
    chainNameError.value = 'Lowercase letters, digits and hyphens only; must start and end with alphanumeric'
    ok = false
  } else if (n.length > 253) {
    chainNameError.value = 'Max 253 characters'
    ok = false
  } else {
    chainNameError.value = null
  }
  if (includeStorage.value && !storageSize.value.trim()) {
    storageSizeError.value = 'PVC size is required (e.g. 1Gi)'
    ok = false
  } else {
    storageSizeError.value = null
  }
  return ok
}

function goToStep2() {
  if (validateStep1()) {
    if (jobTemplates.value.length === 0 && serviceTemplates.value.length === 0) {
      loadAllTemplates()
    }
    step.value = 2
  }
}

// ─── Step 2: Pipeline ─────────────────────────────────────────────────────────

interface EnvRow  { uid: number; key: string; value: string }
interface StepRow {
  uid:                number
  name:               string
  nameError:          string | null
  stepKind:           'Job' | 'Deploy'
  templateName:       string
  templateError:      string | null
  dependsOn:          string[]
  runOnSuccess:       boolean
  runOnFailure:       boolean
  producesOutput:     boolean
  consumesOutputFrom: string[]
  envRows:            EnvRow[]
  expanded:           boolean
}

let _uid = 0

const chainSteps      = ref<StepRow[]>([])
const stepListError   = ref<string | null>(null)

const jobTemplates      = ref<weaveApi.WeaveJobTemplate[]>([])
const serviceTemplates  = ref<weaveApi.WeaveServiceTemplate[]>([])
const loadingTemplates  = ref(false)
const loadTemplateError = ref<string | null>(null)

async function loadAllTemplates() {
  loadingTemplates.value  = true
  loadTemplateError.value = null
  try {
    const [jobs, svcs] = await Promise.all([
      weaveApi.listJobTemplates(),
      weaveApi.listServiceTemplates(),
    ])
    jobTemplates.value     = jobs.items ?? []
    serviceTemplates.value = svcs.items ?? []
  } catch (e) {
    loadTemplateError.value = e instanceof Error ? e.message : 'Failed to load templates'
  } finally {
    loadingTemplates.value = false
  }
}

function addStep() {
  const idx = chainSteps.value.length + 1
  chainSteps.value = [...chainSteps.value, {
    uid:                ++_uid,
    name:               `step-${idx}`,
    nameError:          null,
    stepKind:           'Job',
    templateName:       '',
    templateError:      null,
    dependsOn:          [],
    runOnSuccess:       true,
    runOnFailure:       false,
    producesOutput:     false,
    consumesOutputFrom: [],
    envRows:            [],
    expanded:           true,
  }]
}

function removeStep(i: number) {
  const removedName = chainSteps.value[i].name.trim()
  chainSteps.value = chainSteps.value.filter((_, idx) => idx !== i)
  if (removedName) {
    for (const s of chainSteps.value) {
      s.dependsOn          = s.dependsOn.filter(d => d !== removedName)
      s.consumesOutputFrom = s.consumesOutputFrom.filter(d => d !== removedName)
    }
  }
}

function handleNameInput(idx: number, newName: string) {
  const oldName = chainSteps.value[idx].name
  chainSteps.value[idx].name = newName
  if (oldName !== newName) {
    for (let i = 0; i < chainSteps.value.length; i++) {
      if (i === idx) continue
      const s = chainSteps.value[i]
      s.dependsOn          = s.dependsOn.map(d => d === oldName ? newName : d)
      s.consumesOutputFrom = s.consumesOutputFrom.map(d => d === oldName ? newName : d)
    }
  }
}

function setStepKind(idx: number, kind: 'Job' | 'Deploy') {
  if (chainSteps.value[idx].stepKind !== kind) {
    chainSteps.value[idx].stepKind     = kind
    chainSteps.value[idx].templateName  = ''
    chainSteps.value[idx].templateError = null
  }
}

function toggleDependsOn(stepIdx: number, dep: string) {
  const s = chainSteps.value[stepIdx]
  if (s.dependsOn.includes(dep)) {
    s.dependsOn          = s.dependsOn.filter(d => d !== dep)
    s.consumesOutputFrom = s.consumesOutputFrom.filter(d => d !== dep)
  } else {
    s.dependsOn = [...s.dependsOn, dep]
  }
}

function toggleConsumesFrom(stepIdx: number, dep: string) {
  const s = chainSteps.value[stepIdx]
  if (s.consumesOutputFrom.includes(dep)) {
    s.consumesOutputFrom = s.consumesOutputFrom.filter(d => d !== dep)
  } else {
    s.consumesOutputFrom = [...s.consumesOutputFrom, dep]
  }
}

function toggleProducesOutput(idx: number) {
  const s = chainSteps.value[idx]
  s.producesOutput = !s.producesOutput
  if (!s.producesOutput) {
    const name = s.name.trim()
    if (name) {
      for (const other of chainSteps.value) {
        other.consumesOutputFrom = other.consumesOutputFrom.filter(d => d !== name)
      }
    }
  }
}

function hasCycle(): boolean {
  const adj = new Map<string, string[]>()
  for (const s of chainSteps.value) {
    if (s.name.trim()) adj.set(s.name.trim(), [])
  }
  for (const s of chainSteps.value) {
    const sn = s.name.trim()
    if (!sn) continue
    for (const dep of s.dependsOn) {
      if (adj.has(dep)) adj.get(dep)!.push(sn)
    }
  }
  const visited = new Set<string>()
  const inStack = new Set<string>()
  function dfs(node: string): boolean {
    visited.add(node)
    inStack.add(node)
    for (const next of adj.get(node) ?? []) {
      if (!visited.has(next) && dfs(next)) return true
      if (inStack.has(next)) return true
    }
    inStack.delete(node)
    return false
  }
  for (const [n] of adj) {
    if (!visited.has(n) && dfs(n)) return true
  }
  return false
}

function validateStep2(): boolean {
  let ok = true
  stepListError.value = null

  if (chainSteps.value.length === 0) {
    stepListError.value = 'Add at least one step'
    return false
  }

  const seen = new Set<string>()
  for (const s of chainSteps.value) {
    const n = s.name.trim()
    if (!n) {
      s.nameError = 'Step name is required'
      s.expanded  = true
      ok = false
    } else if (!K8S_NAME_RE.test(n)) {
      s.nameError = 'Lowercase letters, digits and hyphens only; must start and end with alphanumeric'
      s.expanded  = true
      ok = false
    } else if (seen.has(n)) {
      s.nameError = 'Step name must be unique within the chain'
      s.expanded  = true
      ok = false
    } else {
      s.nameError = null
      seen.add(n)
    }
    if (!s.templateName) {
      s.templateError = 'Select a template'
      s.expanded      = true
      ok = false
    } else {
      s.templateError = null
    }
  }

  if (ok && hasCycle()) {
    stepListError.value = 'Dependency graph contains a cycle — review dependsOn edges'
    ok = false
  }

  return ok
}

function goToStep3() {
  if (validateStep2()) step.value = 3
}

function templatesFor(kind: 'Job' | 'Deploy') {
  return kind === 'Job' ? jobTemplates.value : serviceTemplates.value
}

// ─── Live DAG preview ─────────────────────────────────────────────────────────

const previewSteps = computed<weaveApi.WeaveChainStep[]>(() =>
  chainSteps.value
    .filter(s => s.name.trim())
    .map(s => {
      const ws: weaveApi.WeaveChainStep = { name: s.name.trim(), stepKind: s.stepKind }
      if (s.stepKind === 'Job'    && s.templateName) ws.jobTemplateRef     = { name: s.templateName }
      if (s.stepKind === 'Deploy' && s.templateName) ws.serviceTemplateRef = { name: s.templateName }
      const validDeps = s.dependsOn.filter(d => chainSteps.value.some(st => st.name.trim() === d))
      if (validDeps.length) {
        ws.dependsOn    = validDeps
        ws.runOnSuccess = s.runOnSuccess
        ws.runOnFailure = s.runOnFailure
      }
      if (s.producesOutput) ws.producesOutput = true
      const validConsumes = s.consumesOutputFrom.filter(d =>
        chainSteps.value.some(st => st.name.trim() === d && st.producesOutput)
      )
      if (validConsumes.length) ws.consumesOutputFrom = validConsumes
      const env = s.envRows.filter(r => r.key.trim()).map(r => ({ name: r.key.trim(), value: r.value }))
      if (env.length) ws.envOverrides = env
      return ws
    })
)

// ─── Submit ───────────────────────────────────────────────────────────────────

const submitting   = ref(false)
const submitError  = ref<string | null>(null)
const createdChain = ref<weaveApi.WeaveChain | null>(null)

function buildSpec(): weaveApi.WeaveChainSpec {
  const spec: weaveApi.WeaveChainSpec = { steps: previewSteps.value }
  if (failurePolicy.value)     spec.failurePolicy     = failurePolicy.value
  if (concurrencyPolicy.value) spec.concurrencyPolicy = concurrencyPolicy.value
  if (includeStorage.value && storageSize.value.trim()) {
    spec.sharedStorage = { size: storageSize.value.trim() }
    if (storageClass.value.trim()) spec.sharedStorage.storageClassName = storageClass.value.trim()
  }
  return spec
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
  chainName.value         = ''
  chainNameError.value    = null
  failurePolicy.value     = ''
  concurrencyPolicy.value = ''
  includeStorage.value    = false
  storageSize.value       = '1Gi'
  storageSizeError.value  = null
  storageClass.value      = ''
  chainSteps.value        = []
  stepListError.value     = null
  submitError.value       = null
  createdChain.value      = null
  step.value              = 1
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
      <span class="breadcrumb__current">Advanced Chain Builder</span>
    </div>

    <CanvasPanel title="Advanced Chain Builder" icon="mdi-sitemap" :wide="true">

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

        <!-- ═══════════════════════════════ Step 1: Identity ═══════════════════════════════ -->
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

          <div class="form-row">
            <label class="form-label">Failure policy</label>
            <div class="field-wrap">
              <select v-model="failurePolicy" class="fs-input">
                <option value="">Default (StopAll)</option>
                <option value="StopAll">StopAll — cancel all pending steps</option>
                <option value="ContinueOthers">ContinueOthers — let independent steps finish</option>
                <option value="RetryFailed">RetryFailed — retry failed steps</option>
              </select>
              <span class="field-hint">How the chain reacts when a step fails</span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Concurrency</label>
            <div class="field-wrap">
              <select v-model="concurrencyPolicy" class="fs-input">
                <option value="">Default (allow)</option>
                <option value="Wait">Wait — queue new runs while one is active</option>
                <option value="Forbid">Forbid — reject new runs while one is active</option>
              </select>
              <span class="field-hint">Controls whether multiple runs of this chain can overlap</span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Shared storage</label>
            <label class="toggle-wrap">
              <input v-model="includeStorage" type="checkbox" class="toggle-input" />
              <span class="toggle-track"><span class="toggle-thumb" /></span>
              <span class="toggle-text">{{ includeStorage ? 'Enabled' : 'Disabled' }}</span>
            </label>
          </div>

          <template v-if="includeStorage">
            <div class="form-row">
              <label class="form-label">PVC size <span class="required">*</span></label>
              <div class="field-wrap">
                <input
                  v-model="storageSize"
                  class="fs-input fs-mono field-narrow"
                  :class="{ 'fs-input--error': storageSizeError }"
                  placeholder="1Gi"
                />
                <span v-if="storageSizeError" class="field-error">{{ storageSizeError }}</span>
                <span v-else class="field-hint">e.g. 500Mi, 1Gi, 10Gi — ReadWriteMany PVC shared across all steps</span>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">Storage class</label>
              <div class="field-wrap">
                <input v-model="storageClass" class="fs-input fs-mono field-narrow" placeholder="(cluster default)" />
                <span class="field-hint">StorageClassName — leave blank to use the cluster default</span>
              </div>
            </div>
          </template>

          <div class="form-actions">
            <button class="fs-btn fs-btn--primary" @click="goToStep2">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>

        </div>

        <!-- ═══════════════════════════════ Step 2: Pipeline ═══════════════════════════════ -->
        <div v-else-if="step === 2" class="step2-body">

          <!-- Template loading states -->
          <div v-if="loadingTemplates" class="picker-loading">
            <q-spinner size="14px" /> Loading templates…
          </div>
          <div v-else-if="loadTemplateError" class="picker-error">
            <q-icon name="mdi-alert-circle-outline" size="13px" />
            {{ loadTemplateError }}
            <button class="retry-link" @click="loadAllTemplates">Retry</button>
          </div>

          <template v-else>
            <!-- Split layout: step builder | DAG preview -->
            <div class="pipeline-split">

              <!-- Left: step builder -->
              <div class="steps-col">
                <button class="fs-btn fs-btn--ghost add-step-btn" @click="addStep">
                  <q-icon name="mdi-plus" size="14px" /> Add Step
                </button>

                <div v-if="chainSteps.length === 0" class="steps-empty">
                  <q-icon name="mdi-information-outline" size="14px" />
                  No steps yet — click "Add Step" to begin
                </div>

                <!-- Step cards -->
                <div
                  v-for="(s, i) in chainSteps"
                  :key="s.uid"
                  class="step-card"
                >
                  <!-- Card header -->
                  <div class="step-card__header" @click="s.expanded = !s.expanded">
                    <div class="step-card__header-left">
                      <q-icon
                        :name="s.stepKind === 'Deploy' ? 'mdi-server-outline' : 'mdi-briefcase-outline'"
                        size="13px"
                        :class="s.stepKind === 'Deploy' ? 'kind-icon--deploy' : 'kind-icon--job'"
                      />
                      <span class="step-card__name fs-mono">{{ s.name || `step ${i + 1}` }}</span>
                      <span class="step-kind-badge" :class="s.stepKind === 'Deploy' ? 'step-kind-badge--deploy' : 'step-kind-badge--job'">
                        {{ s.stepKind === 'Deploy' ? 'Service' : 'Job' }}
                      </span>
                      <span v-if="s.templateName" class="step-card__tpl">{{ s.templateName }}</span>
                    </div>
                    <div class="step-card__header-right">
                      <button class="icon-btn icon-btn--danger" title="Delete step" @click.stop="removeStep(i)">
                        <q-icon name="mdi-delete-outline" size="13px" />
                      </button>
                      <q-icon :name="s.expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="16px" class="muted-icon" />
                    </div>
                  </div>

                  <!-- Card body -->
                  <div v-if="s.expanded" class="step-card__body">

                    <!-- Name -->
                    <div class="card-row">
                      <label class="card-label">Name <span class="required">*</span></label>
                      <div class="field-wrap">
                        <input
                          :value="s.name"
                          class="fs-input fs-mono"
                          :class="{ 'fs-input--error': s.nameError }"
                          placeholder="my-step"
                          @input="handleNameInput(i, ($event.target as HTMLInputElement).value)"
                        />
                        <span v-if="s.nameError" class="field-error">{{ s.nameError }}</span>
                      </div>
                    </div>

                    <!-- Kind -->
                    <div class="card-row">
                      <label class="card-label">Kind</label>
                      <div class="kind-toggle">
                        <button class="kind-btn" :class="{ 'kind-btn--active': s.stepKind === 'Job' }" @click="setStepKind(i, 'Job')">
                          <q-icon name="mdi-briefcase-outline" size="13px" /> Job
                        </button>
                        <button class="kind-btn" :class="{ 'kind-btn--active': s.stepKind === 'Deploy' }" @click="setStepKind(i, 'Deploy')">
                          <q-icon name="mdi-server-outline" size="13px" /> Service
                        </button>
                      </div>
                    </div>

                    <!-- Template -->
                    <div class="card-row">
                      <label class="card-label">Template <span class="required">*</span></label>
                      <div class="field-wrap">
                        <select
                          v-model="s.templateName"
                          class="fs-input fs-mono"
                          :class="{ 'fs-input--error': s.templateError }"
                          @change="s.templateError = null"
                        >
                          <option value="" disabled>— select —</option>
                          <option
                            v-for="t in templatesFor(s.stepKind)"
                            :key="t.metadata.name"
                            :value="t.metadata.name"
                          >{{ t.metadata.name }}</option>
                        </select>
                        <span v-if="s.templateError" class="field-error">{{ s.templateError }}</span>
                        <span
                          v-else-if="templatesFor(s.stepKind).length === 0"
                          class="field-hint warn-hint"
                        >
                          <q-icon name="mdi-alert-outline" size="11px" />
                          No {{ s.stepKind === 'Job' ? 'job' : 'service' }} templates found
                        </span>
                      </div>
                    </div>

                    <!-- Dependencies (only when there are other steps) -->
                    <div v-if="chainSteps.length > 1" class="card-section">
                      <div class="card-section__title">
                        <q-icon name="mdi-arrow-up-circle-outline" size="12px" />
                        Dependencies
                      </div>
                      <div class="check-list">
                        <template v-for="(other, j) in chainSteps" :key="other.uid">
                          <label v-if="j !== i" class="check-item">
                            <input
                              type="checkbox"
                              :checked="s.dependsOn.includes(other.name.trim())"
                              :disabled="!other.name.trim()"
                              @change="other.name.trim() && toggleDependsOn(i, other.name.trim())"
                            />
                            <span class="check-item__label">{{ other.name || `(step ${j + 1})` }}</span>
                          </label>
                        </template>
                      </div>
                      <span v-if="s.dependsOn.length > 0" class="field-hint">
                        This step runs after: <span class="fs-mono">{{ s.dependsOn.join(', ') }}</span>
                      </span>
                    </div>

                    <!-- Execution conditions (only when dependsOn is set) -->
                    <div v-if="s.dependsOn.length > 0" class="card-section">
                      <div class="card-section__title">
                        <q-icon name="mdi-gate-or" size="12px" />
                        Execution Conditions
                      </div>
                      <div class="toggle-list">
                        <label class="toggle-item">
                          <input v-model="s.runOnSuccess" type="checkbox" class="toggle-input" />
                          <span class="toggle-track"><span class="toggle-thumb" /></span>
                          <span class="toggle-item__text">Run when upstream succeeds</span>
                        </label>
                        <label class="toggle-item">
                          <input v-model="s.runOnFailure" type="checkbox" class="toggle-input" />
                          <span class="toggle-track"><span class="toggle-thumb" /></span>
                          <span class="toggle-item__text">Run when upstream fails</span>
                        </label>
                      </div>
                    </div>

                    <!-- I/O -->
                    <div class="card-section">
                      <div class="card-section__title">
                        <q-icon name="mdi-database-arrow-right-outline" size="12px" />
                        I/O
                      </div>
                      <label class="toggle-item">
                        <input
                          type="checkbox"
                          :checked="s.producesOutput"
                          class="toggle-input"
                          @change="toggleProducesOutput(i)"
                        />
                        <span class="toggle-track"><span class="toggle-thumb" /></span>
                        <span class="toggle-item__text">Produces output (writes to shared storage)</span>
                      </label>

                      <template v-if="chainSteps.some((other, j) => j !== i && other.producesOutput && other.name.trim())">
                        <div class="card-section__sub">Consumes output from:</div>
                        <div class="check-list">
                          <template v-for="(other, j) in chainSteps" :key="other.uid">
                            <label v-if="j !== i && other.producesOutput && other.name.trim()" class="check-item">
                              <input
                                type="checkbox"
                                :checked="s.consumesOutputFrom.includes(other.name.trim())"
                                @change="toggleConsumesFrom(i, other.name.trim())"
                              />
                              <span class="check-item__label">{{ other.name }}</span>
                            </label>
                          </template>
                        </div>
                      </template>
                    </div>

                    <!-- Env overrides -->
                    <div class="card-section">
                      <div class="card-section__title">
                        <q-icon name="mdi-variable" size="12px" />
                        Env Overrides
                      </div>
                      <div v-if="s.envRows.length" class="env-table">
                        <div class="env-header">
                          <span class="env-header__key">Key</span>
                          <span class="env-header__val">Value</span>
                        </div>
                        <div v-for="(row, ri) in s.envRows" :key="row.uid" class="env-row">
                          <input v-model="row.key"   class="fs-input fs-mono env-input" placeholder="MY_VAR" />
                          <input v-model="row.value" class="fs-input env-input"         placeholder="value" />
                          <button class="icon-btn icon-btn--danger" @click="s.envRows = s.envRows.filter((_, idx) => idx !== ri)">
                            <q-icon name="mdi-close" size="13px" />
                          </button>
                        </div>
                      </div>
                      <button class="fs-btn fs-btn--ghost add-env-btn" @click="s.envRows = [...s.envRows, { uid: ++_uid, key: '', value: '' }]">
                        <q-icon name="mdi-plus" size="13px" /> Add variable
                      </button>
                    </div>

                  </div>
                </div>
              </div>

              <!-- Right: live DAG preview -->
              <div class="preview-col">
                <div class="preview-header">
                  <q-icon name="mdi-graph-outline" size="13px" class="muted-icon" />
                  Live Preview
                </div>
                <div v-if="previewSteps.length === 0" class="preview-empty">
                  <q-icon name="mdi-chart-timeline-variant" size="28px" />
                  <span>Add steps to see the pipeline graph</span>
                </div>
                <ChainDagView v-else :steps="previewSteps" />
              </div>

            </div>

            <!-- Validation errors -->
            <div v-if="stepListError" class="inline-msg inline-msg--error">
              <q-icon name="mdi-alert-circle-outline" size="13px" />
              {{ stepListError }}
            </div>

            <div class="form-actions">
              <button class="fs-btn fs-btn--ghost" @click="step = 1">
                <q-icon name="mdi-arrow-left" size="14px" /> Back
              </button>
              <button class="fs-btn fs-btn--primary" @click="goToStep3">
                Next <q-icon name="mdi-arrow-right" size="14px" />
              </button>
            </div>
          </template>

        </div>

        <!-- ═══════════════════════════════ Step 3: Review ═══════════════════════════════ -->
        <div v-else class="form-body">

          <!-- DAG -->
          <div class="review-dag">
            <div class="review-dag__title">Pipeline graph</div>
            <ChainDagView :steps="previewSteps" />
          </div>

          <!-- Chain settings summary -->
          <div class="review-section">
            <div class="review-section__title">Chain Settings</div>
            <div class="review-table">
              <div class="review-row">
                <span class="review-key">name</span>
                <span class="review-val fs-mono">{{ chainName }}</span>
              </div>
              <div class="review-row">
                <span class="review-key">failurePolicy</span>
                <span class="review-val fs-mono">{{ failurePolicy || 'default' }}</span>
              </div>
              <div class="review-row">
                <span class="review-key">concurrencyPolicy</span>
                <span class="review-val fs-mono">{{ concurrencyPolicy || 'default' }}</span>
              </div>
              <div class="review-row">
                <span class="review-key">sharedStorage</span>
                <span class="review-val fs-mono">
                  {{ includeStorage ? storageSize + (storageClass ? ' · ' + storageClass : '') : 'none' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Steps summary -->
          <div class="review-section">
            <div class="review-section__title">Steps ({{ previewSteps.length }})</div>
            <table class="steps-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Template</th>
                  <th>Depends on</th>
                  <th>Conditions</th>
                  <th>I/O</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in previewSteps" :key="s.name">
                  <td class="fs-mono">{{ s.name }}</td>
                  <td>
                    <span class="step-kind-badge" :class="s.stepKind === 'Deploy' ? 'step-kind-badge--deploy' : 'step-kind-badge--job'">
                      {{ s.stepKind === 'Deploy' ? 'Service' : 'Job' }}
                    </span>
                  </td>
                  <td class="fs-mono">{{ s.jobTemplateRef?.name ?? s.serviceTemplateRef?.name ?? '—' }}</td>
                  <td class="fs-mono">{{ s.dependsOn?.join(', ') || '—' }}</td>
                  <td class="fs-mono">
                    <template v-if="s.dependsOn?.length">
                      {{ [s.runOnSuccess && 'success', s.runOnFailure && 'failure'].filter(Boolean).join(' + ') || 'none' }}
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="fs-mono">
                    {{ [s.producesOutput && '↑ output', s.consumesOutputFrom?.length && '↓ from ' + s.consumesOutputFrom.join(',')].filter(Boolean).join(' ') || '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
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
  display: flex; align-items: center; gap: 5px;
  background: none; border: none; padding: 4px 8px; border-radius: 4px;
  cursor: pointer; color: var(--fs-text-muted); font-size: 12px; font-family: inherit;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.breadcrumb__back:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.breadcrumb__current    { font-size: 12px; color: var(--fs-accent); font-weight: 500; }
.muted-icon             { color: var(--fs-text-muted); }

/* Wizard step indicator */
.wizard-steps { display: flex; align-items: center; padding: 16px 10px 24px; }
.wizard-step  { display: flex; align-items: center; gap: 8px; flex: 1; }
.wizard-step:last-child { flex: none; }
.wizard-step__dot {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; flex-shrink: 0;
  border: 1.5px solid var(--fs-border); color: var(--fs-text-muted); background: var(--fs-bg-panel);
  transition: border-color var(--fs-ease), background var(--fs-ease), color var(--fs-ease);
}
.wizard-step--active .wizard-step__dot { border-color: var(--fs-accent); background: var(--fs-accent); color: #fff; }
.wizard-step--done   .wizard-step__dot { border-color: var(--fs-pos, #4caf50); background: var(--fs-pos, #4caf50); color: #fff; }
.wizard-step__label {
  font-size: 11.5px; font-weight: 500; color: var(--fs-text-muted); white-space: nowrap;
  transition: color var(--fs-ease);
}
.wizard-step--active .wizard-step__label,
.wizard-step--done   .wizard-step__label { color: var(--fs-text-primary); }
.wizard-step__line { flex: 1; height: 1px; background: var(--fs-border); margin: 0 8px; }

/* Step 1 / Step 3 shared form layout */
.form-body { display: flex; flex-direction: column; gap: 20px; padding: 0 10px 10px; }
.form-row  { display: grid; grid-template-columns: 150px 1fr; align-items: center; gap: 12px; }
.form-label {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted); padding-top: 2px;
}
.required    { color: var(--fs-neg, #e57373); }
.field-wrap  { display: flex; flex-direction: column; gap: 4px; }
.field-error { font-size: 11px; color: var(--fs-neg, #e57373); }
.field-hint  { font-size: 11px; color: var(--fs-text-muted); }
.warn-hint   { color: var(--fs-warn, #ff9800); display: flex; align-items: center; gap: 4px; }
.field-narrow { max-width: 200px; }

/* Inputs */
.fs-input {
  width: 100%; background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border); border-radius: 4px; padding: 7px 10px;
  font-size: 12.5px; font-family: inherit; color: var(--fs-text-primary);
  outline: none; transition: border-color var(--fs-ease); box-sizing: border-box;
}
.fs-input:focus   { border-color: var(--fs-accent); }
.fs-input--error  { border-color: var(--fs-neg, #e57373); }
.fs-mono          { font-family: var(--fs-font-mono); }

/* Toggle (step 1 style) */
.toggle-wrap {
  display: flex; align-items: center; gap: 10px;
  cursor: pointer; user-select: none;
}
.toggle-input { display: none; }
.toggle-track {
  position: relative; width: 34px; height: 18px; border-radius: 9px;
  background: var(--fs-border); border: 1px solid var(--fs-border);
  transition: background var(--fs-ease), border-color var(--fs-ease); flex-shrink: 0;
}
.toggle-input:checked ~ .toggle-track { background: var(--fs-accent); border-color: var(--fs-accent); }
.toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 12px; height: 12px; border-radius: 50%; background: #fff;
  transition: transform var(--fs-ease);
}
.toggle-input:checked ~ .toggle-track .toggle-thumb { transform: translateX(16px); }
.toggle-text { font-size: 12px; color: var(--fs-text-muted); }

/* Kind toggle buttons */
.kind-toggle { display: flex; gap: 6px; }
.kind-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 4px; font-size: 12px; font-family: inherit; font-weight: 500;
  cursor: pointer; border: 1px solid var(--fs-border); background: transparent; color: var(--fs-text-muted);
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease);
}
.kind-btn:hover       { background: var(--fs-bg-hover); color: var(--fs-text-primary); }
.kind-btn--active     { border-color: var(--fs-accent); background: color-mix(in srgb, var(--fs-accent) 12%, transparent); color: var(--fs-accent); }

/* ─── Step 2: Pipeline ─────────────────────────── */

.step2-body {
  display: flex; flex-direction: column; gap: 12px; padding: 0 10px 10px;
}

.pipeline-split {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;
  align-items: start;
}

/* Left: steps column */
.steps-col { display: flex; flex-direction: column; gap: 8px; }

.add-step-btn { align-self: flex-start; }

.steps-empty {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--fs-text-muted);
  padding: 16px 12px;
  border: 1px dashed var(--fs-border);
  border-radius: 6px;
}

/* Step card */
.step-card {
  border: 1px solid var(--fs-border);
  border-radius: 6px;
  overflow: hidden;
  transition: border-color var(--fs-ease);
}
.step-card:focus-within { border-color: var(--fs-accent); }

.step-card__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  background: var(--fs-bg-hover);
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--fs-border);
  transition: background var(--fs-ease);
}
.step-card__header:hover { background: color-mix(in srgb, var(--fs-accent) 6%, var(--fs-bg-hover)); }

.step-card__header-left  { display: flex; align-items: center; gap: 7px; min-width: 0; flex: 1; }
.step-card__header-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.step-card__name { font-size: 12.5px; font-weight: 600; color: var(--fs-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
.step-card__tpl  { font-size: 11px; color: var(--fs-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }

.kind-icon--job    { color: var(--fs-accent); flex-shrink: 0; }
.kind-icon--deploy { color: var(--fs-pos, #4caf50); flex-shrink: 0; }

.step-kind-badge {
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
  padding: 1px 6px; border-radius: 8px; flex-shrink: 0;
}
.step-kind-badge--job    { background: color-mix(in srgb, var(--fs-accent) 14%, transparent); color: var(--fs-accent); }
.step-kind-badge--deploy { background: color-mix(in srgb, var(--fs-pos, #4caf50) 14%, transparent); color: var(--fs-pos, #4caf50); }

.step-card__body {
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px 14px;
}

/* Card field rows */
.card-row { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 8px; }
.card-label {
  font-size: 10px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted);
}

/* Card sections (Dependencies, Conditions, I/O, Env) */
.card-section { display: flex; flex-direction: column; gap: 6px; }
.card-section__title {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.07em;
  text-transform: uppercase; color: var(--fs-text-muted);
  padding-bottom: 4px; border-bottom: 1px solid var(--fs-border);
}
.card-section__sub { font-size: 10.5px; color: var(--fs-text-muted); margin-top: 2px; }

/* Checkboxes */
.check-list  { display: flex; flex-wrap: wrap; gap: 6px 14px; }
.check-item  { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.check-item input[type="checkbox"] { accent-color: var(--fs-accent); width: 13px; height: 13px; cursor: pointer; flex-shrink: 0; }
.check-item input[type="checkbox"]:disabled { cursor: not-allowed; opacity: 0.45; }
.check-item__label { font-size: 12px; font-family: var(--fs-font-mono); color: var(--fs-text-primary); }

/* Toggle list (execution conditions) */
.toggle-list { display: flex; flex-direction: column; gap: 6px; }
.toggle-item {
  display: flex; align-items: center; gap: 8px;
  cursor: pointer; user-select: none;
}
.toggle-item__text { font-size: 12px; color: var(--fs-text-primary); }

/* Env table */
.env-table { display: flex; flex-direction: column; gap: 4px; margin-bottom: 4px; }
.env-header {
  display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; padding: 0 2px 2px;
}
.env-header__key,
.env-header__val {
  font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--fs-text-muted);
}
.env-row    { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; align-items: center; }
.env-input  { padding: 5px 8px; font-size: 12px; }
.add-env-btn { align-self: flex-start; padding: 4px 10px; font-size: 11.5px; margin-top: 2px; }

/* Right: DAG preview column */
.preview-col { position: sticky; top: 16px; }
.preview-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted);
  padding: 0 2px 8px; border-bottom: 1px solid var(--fs-border); margin-bottom: 8px;
}
.preview-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; height: 200px;
  color: var(--fs-text-muted); font-size: 12px; text-align: center;
  border: 1px dashed var(--fs-border); border-radius: 6px;
}

/* ─── Step 3: Review ─────────────────────────── */

.review-dag {
  display: flex; flex-direction: column; gap: 8px;
}
.review-dag__title {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted);
  padding: 0 2px 4px; border-bottom: 1px solid var(--fs-border);
}

.review-section { display: flex; flex-direction: column; gap: 8px; }
.review-section__title {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted);
  padding: 0 2px 4px; border-bottom: 1px solid var(--fs-border);
}

.review-table { display: flex; flex-direction: column; gap: 4px; }
.review-row   { display: flex; gap: 12px; align-items: baseline; font-size: 12px; }
.review-key   { color: var(--fs-accent); font-family: var(--fs-font-mono); font-size: 11px; min-width: 160px; }
.review-val   { color: var(--fs-text-primary); }

.steps-table {
  width: 100%; border-collapse: collapse; font-size: 11.5px;
}
.steps-table th {
  text-align: left; padding: 5px 8px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--fs-text-muted); border-bottom: 1px solid var(--fs-border);
}
.steps-table td {
  padding: 6px 8px; border-bottom: 1px solid var(--fs-border); color: var(--fs-text-primary);
  vertical-align: middle;
}
.steps-table tbody tr:last-child td { border-bottom: none; }
.steps-table tbody tr:hover td { background: var(--fs-bg-hover); }

/* ─── Shared ─────────────────────────── */

/* Picker states */
.picker-loading, .picker-error {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--fs-text-muted); padding: 12px 10px;
}
.picker-error { color: var(--fs-neg, #e57373); }
.retry-link {
  background: none; border: none; cursor: pointer;
  color: var(--fs-accent); font-size: 12px; padding: 0; text-decoration: underline;
}

/* Inline messages */
.inline-msg {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; padding: 8px 10px; border-radius: 4px;
}
.inline-msg--error {
  color: var(--fs-neg, #e57373);
  background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent);
}

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
.fs-btn--ghost:hover:not(:disabled) {
  color: var(--fs-text-primary); background: var(--fs-bg-hover);
  border-color: var(--fs-border-bright, var(--fs-border));
}

/* Icon button */
.icon-btn {
  background: none; border: none; cursor: pointer; padding: 4px 6px; border-radius: 3px;
  display: inline-flex; align-items: center; color: var(--fs-text-muted);
  transition: color var(--fs-ease), background var(--fs-ease);
}
.icon-btn--danger:hover { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

/* Success state */
.success-body {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 48px 24px 40px; text-align: center;
}
.success-icon  { color: var(--fs-pos, #4caf50); }
.success-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--fs-text-primary); }
.success-sub   { margin: 0; font-size: 12.5px; color: var(--fs-text-muted); }
.success-actions { margin-top: 8px; display: flex; gap: 8px; }
</style>
