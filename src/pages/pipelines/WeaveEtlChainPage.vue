<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as weaveApi from '@/api/weaveApi'
import { getEtlStorageClass } from '@/config/runtime'

const router = useRouter()

interface EnvRow { key: string; value: string }

// ─── Wizard state ─────────────────────────────────────────────────────────────

const step       = ref<1 | 2 | 3>(1)
const stepLabels = ['Identity', 'Pipeline', 'Review'] as const

// ─── Step 1: chain name ───────────────────────────────────────────────────────

const chainName      = ref('')
const chainNameError = ref<string | null>(null)

const K8S_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/

function validateStep1(): boolean {
  const n = chainName.value.trim()
  if (!n) { chainNameError.value = 'Name is required'; return false }
  if (!K8S_NAME_RE.test(n)) {
    chainNameError.value = 'Lowercase letters, digits and hyphens only; must start and end with alphanumeric'
    return false
  }
  if (n.length > 253) { chainNameError.value = 'Max 253 characters'; return false }
  chainNameError.value = null
  return true
}

// ─── Step 2: ETL stages + storage ────────────────────────────────────────────

const jobTemplates      = ref<weaveApi.WeaveJobTemplate[]>([])
const loadingTemplates  = ref(false)
const loadTemplateError = ref<string | null>(null)

// Extract
const includeExtract      = ref(true)
const extractTemplate     = ref('')
const extractTemplateErr  = ref<string | null>(null)
const extractEnv          = ref<EnvRow[]>([])

// Transform
const includeTransform     = ref(true)
const transformTemplate    = ref('')
const transformTemplateErr = ref<string | null>(null)
const transformEnv         = ref<EnvRow[]>([])

// Load
const includeLoad     = ref(true)
const loadTemplate    = ref('')
const loadTemplateErr = ref<string | null>(null)
const loadEnv         = ref<EnvRow[]>([])

// Shared storage
const includeStorage = ref(false)
const storageSize    = ref('1Gi')
const storageSizeErr = ref<string | null>(null)

const noStagesErr = ref<string | null>(null)

async function loadTemplates() {
  loadingTemplates.value  = true
  loadTemplateError.value = null
  try {
    const list = await weaveApi.listJobTemplates()
    jobTemplates.value = list.items ?? []
  } catch (e) {
    loadTemplateError.value = e instanceof Error ? e.message : 'Failed to load templates'
  } finally {
    loadingTemplates.value = false
  }
}

function goToStep2() {
  if (validateStep1()) {
    loadTemplates()
    step.value = 2
  }
}

function validateStep2(): boolean {
  let ok = true
  noStagesErr.value = null

  if (!includeExtract.value && !includeTransform.value && !includeLoad.value) {
    noStagesErr.value = 'At least one stage must be enabled'
    return false
  }

  if (includeExtract.value && !extractTemplate.value) {
    extractTemplateErr.value = 'Select a job template or disable this stage'
    ok = false
  } else {
    extractTemplateErr.value = null
  }

  if (includeTransform.value && !transformTemplate.value) {
    transformTemplateErr.value = 'Select a job template or disable this stage'
    ok = false
  } else {
    transformTemplateErr.value = null
  }

  if (includeLoad.value && !loadTemplate.value) {
    loadTemplateErr.value = 'Select a job template or disable this stage'
    ok = false
  } else {
    loadTemplateErr.value = null
  }

  if (includeStorage.value && !storageSize.value.trim()) {
    storageSizeErr.value = 'PVC size is required (e.g. 1Gi)'
    ok = false
  } else {
    storageSizeErr.value = null
  }

  return ok
}

function goToStep3() {
  if (validateStep2()) step.value = 3
}

// ─── Submit ───────────────────────────────────────────────────────────────────

const submitting   = ref(false)
const submitError  = ref<string | null>(null)
const createdChain = ref<weaveApi.WeaveChain | null>(null)

function buildSpec(): weaveApi.WeaveChainSpec {
  const stages = [
    { name: 'extract',   include: includeExtract.value,   template: extractTemplate.value,   env: extractEnv.value   },
    { name: 'transform', include: includeTransform.value, template: transformTemplate.value, env: transformEnv.value },
    { name: 'load',      include: includeLoad.value,      template: loadTemplate.value,      env: loadEnv.value      },
  ]

  const steps: weaveApi.WeaveChainStep[] = []
  let prev: string | null = null

  for (const stage of stages) {
    if (!stage.include) continue
    const chainStep: weaveApi.WeaveChainStep = {
      name:           stage.name,
      stepKind:       'Job',
      jobTemplateRef: { name: stage.template },
    }
    if (prev) chainStep.dependsOn = [prev]
    const overrides = stage.env
      .filter(r => r.key.trim())
      .map(r => ({ name: r.key.trim(), value: r.value }))
    if (overrides.length) chainStep.envOverrides = overrides
    steps.push(chainStep)
    prev = stage.name
  }

  const spec: weaveApi.WeaveChainSpec = { steps }
  if (includeStorage.value) {
    const sc = getEtlStorageClass()
    spec.sharedStorage = { size: storageSize.value.trim(), ...(sc ? { storageClassName: sc } : {}) }
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
  chainName.value          = ''
  chainNameError.value     = null
  includeExtract.value     = true
  extractTemplate.value    = ''
  extractTemplateErr.value = null
  extractEnv.value         = []
  includeTransform.value   = true
  transformTemplate.value  = ''
  transformTemplateErr.value = null
  transformEnv.value       = []
  includeLoad.value        = true
  loadTemplate.value       = ''
  loadTemplateErr.value    = null
  loadEnv.value            = []
  includeStorage.value     = false
  storageSize.value        = '1Gi'
  storageSizeErr.value     = null
  noStagesErr.value        = null
  submitError.value        = null
  createdChain.value       = null
  step.value               = 1
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
      <span class="breadcrumb__current">ETL Wizard</span>
    </div>

    <CanvasPanel title="ETL Wizard" icon="mdi-database-sync" :wide="true">

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
                placeholder="my-etl-chain"
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

        <!-- ── Step 2: Pipeline ── -->
        <div v-else-if="step === 2" class="form-body">

          <!-- Loading / error -->
          <div v-if="loadingTemplates" class="picker-loading">
            <q-spinner size="14px" /> Loading templates…
          </div>
          <div v-else-if="loadTemplateError" class="picker-error">
            <q-icon name="mdi-alert-circle-outline" size="13px" />
            {{ loadTemplateError }}
            <button class="retry-link" @click="loadTemplates">Retry</button>
          </div>

          <template v-else>
            <p class="pipeline-desc">
              Configure each ETL stage. All stages are optional but at least one must be enabled.
              Steps run sequentially in order: Extract → Transform → Load.
            </p>

            <!-- No-stages error -->
            <div v-if="noStagesErr" class="inline-msg inline-msg--error">
              <q-icon name="mdi-alert-circle-outline" size="13px" />
              {{ noStagesErr }}
            </div>

            <!-- ── Extract ── -->
            <div class="stage-card" :class="{ 'stage-card--disabled': !includeExtract }">
              <div class="stage-header">
                <div class="stage-header__left">
                  <span class="stage-icon stage-icon--job">
                    <q-icon name="mdi-database-export-outline" size="14px" />
                  </span>
                  <span class="stage-title">Extract</span>
                  <span class="stage-badge stage-badge--optional">optional</span>
                </div>
                <label class="toggle-label">
                  <input
                    type="checkbox"
                    class="toggle-input"
                    :checked="includeExtract"
                    @change="includeExtract = !includeExtract; extractTemplate = ''; extractTemplateErr = null"
                  />
                  <span class="toggle-track"><span class="toggle-thumb" /></span>
                </label>
              </div>
              <div v-if="includeExtract" class="stage-body">
                <label class="stage-field-label">Job Template <span class="required">*</span></label>
                <select
                  v-model="extractTemplate"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': extractTemplateErr }"
                >
                  <option value="" disabled>— select a job template —</option>
                  <option v-for="t in jobTemplates" :key="t.metadata.name" :value="t.metadata.name">
                    {{ t.metadata.name }}
                  </option>
                </select>
                <span v-if="extractTemplateErr" class="field-error">{{ extractTemplateErr }}</span>
                <span v-else-if="jobTemplates.length === 0" class="field-hint warn-hint">
                  <q-icon name="mdi-alert-outline" size="11px" /> No job templates found
                </span>
                <span class="step-name-hint">Step name: <code>extract</code></span>

                <label class="stage-field-label env-label">Env Overrides</label>
                <div class="env-table">
                  <div v-if="extractEnv.length" class="env-header">
                    <span class="env-header__key">Key</span>
                    <span class="env-header__val">Value</span>
                  </div>
                  <div v-for="(row, i) in extractEnv" :key="i" class="env-row">
                    <input v-model="row.key"   class="fs-input fs-mono env-input" placeholder="MY_VAR" />
                    <input v-model="row.value" class="fs-input env-input"         placeholder="value" />
                    <button class="icon-btn icon-btn--danger" title="Remove" @click="extractEnv.splice(i, 1)">
                      <q-icon name="mdi-close" size="13px" />
                    </button>
                  </div>
                </div>
                <button class="fs-btn fs-btn--ghost add-env-btn" @click="extractEnv.push({ key: '', value: '' })">
                  <q-icon name="mdi-plus" size="13px" /> Add variable
                </button>
              </div>
            </div>

            <!-- Arrow -->
            <div class="pipeline-arrow">
              <div class="pipeline-arrow__line" :class="{ 'pipeline-arrow__line--dim': !includeExtract || !includeTransform }" />
              <q-icon
                name="mdi-arrow-down" size="14px"
                :class="includeExtract && includeTransform ? 'arrow-icon' : 'arrow-icon--dim'"
              />
            </div>

            <!-- ── Transform ── -->
            <div class="stage-card" :class="{ 'stage-card--disabled': !includeTransform }">
              <div class="stage-header">
                <div class="stage-header__left">
                  <span class="stage-icon stage-icon--smoke">
                    <q-icon name="mdi-cog-outline" size="14px" />
                  </span>
                  <span class="stage-title">Transform</span>
                  <span class="stage-badge stage-badge--optional">optional</span>
                </div>
                <label class="toggle-label">
                  <input
                    type="checkbox"
                    class="toggle-input"
                    :checked="includeTransform"
                    @change="includeTransform = !includeTransform; transformTemplate = ''; transformTemplateErr = null"
                  />
                  <span class="toggle-track"><span class="toggle-thumb" /></span>
                </label>
              </div>
              <div v-if="includeTransform" class="stage-body">
                <label class="stage-field-label">Job Template <span class="required">*</span></label>
                <select
                  v-model="transformTemplate"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': transformTemplateErr }"
                >
                  <option value="" disabled>— select a job template —</option>
                  <option v-for="t in jobTemplates" :key="t.metadata.name" :value="t.metadata.name">
                    {{ t.metadata.name }}
                  </option>
                </select>
                <span v-if="transformTemplateErr" class="field-error">{{ transformTemplateErr }}</span>
                <span v-else-if="jobTemplates.length === 0" class="field-hint warn-hint">
                  <q-icon name="mdi-alert-outline" size="11px" /> No job templates found
                </span>
                <span class="step-name-hint">Step name: <code>transform</code></span>

                <label class="stage-field-label env-label">Env Overrides</label>
                <div class="env-table">
                  <div v-if="transformEnv.length" class="env-header">
                    <span class="env-header__key">Key</span>
                    <span class="env-header__val">Value</span>
                  </div>
                  <div v-for="(row, i) in transformEnv" :key="i" class="env-row">
                    <input v-model="row.key"   class="fs-input fs-mono env-input" placeholder="MY_VAR" />
                    <input v-model="row.value" class="fs-input env-input"         placeholder="value" />
                    <button class="icon-btn icon-btn--danger" title="Remove" @click="transformEnv.splice(i, 1)">
                      <q-icon name="mdi-close" size="13px" />
                    </button>
                  </div>
                </div>
                <button class="fs-btn fs-btn--ghost add-env-btn" @click="transformEnv.push({ key: '', value: '' })">
                  <q-icon name="mdi-plus" size="13px" /> Add variable
                </button>
              </div>
            </div>

            <!-- Arrow -->
            <div class="pipeline-arrow">
              <div class="pipeline-arrow__line" :class="{ 'pipeline-arrow__line--dim': !includeTransform || !includeLoad }" />
              <q-icon
                name="mdi-arrow-down" size="14px"
                :class="includeTransform && includeLoad ? 'arrow-icon' : 'arrow-icon--dim'"
              />
            </div>

            <!-- ── Load ── -->
            <div class="stage-card" :class="{ 'stage-card--disabled': !includeLoad }">
              <div class="stage-header">
                <div class="stage-header__left">
                  <span class="stage-icon stage-icon--deploy">
                    <q-icon name="mdi-database-import-outline" size="14px" />
                  </span>
                  <span class="stage-title">Load</span>
                  <span class="stage-badge stage-badge--optional">optional</span>
                </div>
                <label class="toggle-label">
                  <input
                    type="checkbox"
                    class="toggle-input"
                    :checked="includeLoad"
                    @change="includeLoad = !includeLoad; loadTemplate = ''; loadTemplateErr = null"
                  />
                  <span class="toggle-track"><span class="toggle-thumb" /></span>
                </label>
              </div>
              <div v-if="includeLoad" class="stage-body">
                <label class="stage-field-label">Job Template <span class="required">*</span></label>
                <select
                  v-model="loadTemplate"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': loadTemplateErr }"
                >
                  <option value="" disabled>— select a job template —</option>
                  <option v-for="t in jobTemplates" :key="t.metadata.name" :value="t.metadata.name">
                    {{ t.metadata.name }}
                  </option>
                </select>
                <span v-if="loadTemplateErr" class="field-error">{{ loadTemplateErr }}</span>
                <span v-else-if="jobTemplates.length === 0" class="field-hint warn-hint">
                  <q-icon name="mdi-alert-outline" size="11px" /> No job templates found
                </span>
                <span class="step-name-hint">Step name: <code>load</code></span>

                <label class="stage-field-label env-label">Env Overrides</label>
                <div class="env-table">
                  <div v-if="loadEnv.length" class="env-header">
                    <span class="env-header__key">Key</span>
                    <span class="env-header__val">Value</span>
                  </div>
                  <div v-for="(row, i) in loadEnv" :key="i" class="env-row">
                    <input v-model="row.key"   class="fs-input fs-mono env-input" placeholder="MY_VAR" />
                    <input v-model="row.value" class="fs-input env-input"         placeholder="value" />
                    <button class="icon-btn icon-btn--danger" title="Remove" @click="loadEnv.splice(i, 1)">
                      <q-icon name="mdi-close" size="13px" />
                    </button>
                  </div>
                </div>
                <button class="fs-btn fs-btn--ghost add-env-btn" @click="loadEnv.push({ key: '', value: '' })">
                  <q-icon name="mdi-plus" size="13px" /> Add variable
                </button>
              </div>
            </div>

            <!-- ── Shared storage ── -->
            <div class="stage-card" :class="{ 'stage-card--disabled': !includeStorage }">
              <div class="stage-header">
                <div class="stage-header__left">
                  <span class="stage-icon stage-icon--storage">
                    <q-icon name="mdi-harddisk" size="14px" />
                  </span>
                  <span class="stage-title">Shared Storage</span>
                  <span class="stage-badge stage-badge--optional">optional</span>
                </div>
                <label class="toggle-label">
                  <input
                    type="checkbox"
                    class="toggle-input"
                    :checked="includeStorage"
                    @change="includeStorage = !includeStorage; storageSizeErr = null"
                  />
                  <span class="toggle-track"><span class="toggle-thumb" /></span>
                </label>
              </div>
              <div v-if="includeStorage" class="stage-body">
                <label class="stage-field-label">PVC Size <span class="required">*</span></label>
                <input
                  v-model="storageSize"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': storageSizeErr }"
                  placeholder="1Gi"
                />
                <span v-if="storageSizeErr" class="field-error">{{ storageSizeErr }}</span>
                <span v-else class="field-hint">e.g. 500Mi, 1Gi, 10Gi — a ReadWriteMany PVC shared across all enabled steps</span>
              </div>
            </div>

          </template>

          <div class="form-actions">
            <button class="fs-btn fs-btn--ghost" @click="step = 1">
              <q-icon name="mdi-arrow-left" size="14px" /> Back
            </button>
            <button class="fs-btn fs-btn--primary" :disabled="loadingTemplates" @click="goToStep3">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>
        </div>

        <!-- ── Step 3: Review ── -->
        <div v-else class="form-body">

          <div class="section-title">Review chain</div>

          <!-- Visual pipeline -->
          <div class="review-pipeline">
            <template v-if="includeExtract">
              <div class="review-stage">
                <span class="review-stage__icon stage-icon--job">
                  <q-icon name="mdi-database-export-outline" size="13px" />
                </span>
                <div class="review-stage__text">
                  <span class="review-stage__label">Extract</span>
                  <span class="review-stage__name fs-mono">{{ extractTemplate }}</span>
                </div>
              </div>
              <q-icon v-if="includeTransform || includeLoad" name="mdi-arrow-right" size="14px" class="review-arrow" />
            </template>

            <template v-if="includeTransform">
              <div class="review-stage">
                <span class="review-stage__icon stage-icon--smoke">
                  <q-icon name="mdi-cog-outline" size="13px" />
                </span>
                <div class="review-stage__text">
                  <span class="review-stage__label">Transform</span>
                  <span class="review-stage__name fs-mono">{{ transformTemplate }}</span>
                </div>
              </div>
              <q-icon v-if="includeLoad" name="mdi-arrow-right" size="14px" class="review-arrow" />
            </template>

            <template v-if="includeLoad">
              <div class="review-stage">
                <span class="review-stage__icon stage-icon--deploy">
                  <q-icon name="mdi-database-import-outline" size="13px" />
                </span>
                <div class="review-stage__text">
                  <span class="review-stage__label">Load</span>
                  <span class="review-stage__name fs-mono">{{ loadTemplate }}</span>
                </div>
              </div>
            </template>
          </div>

          <!-- Details table -->
          <div class="review-table">
            <div class="review-row">
              <span class="review-key">chain name</span>
              <span class="review-val fs-mono">{{ chainName }}</span>
            </div>
            <div class="review-row">
              <span class="review-key">stages</span>
              <span class="review-val">
                {{ [includeExtract && 'extract', includeTransform && 'transform', includeLoad && 'load'].filter(Boolean).join(' → ') }}
              </span>
            </div>
            <div v-if="includeStorage" class="review-row">
              <span class="review-key">shared storage</span>
              <span class="review-val fs-mono">{{ storageSize }}</span>
            </div>
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

/* Wizard step indicator */
.wizard-steps { display: flex; align-items: center; padding: 16px 10px 24px; }
.wizard-step { display: flex; align-items: center; gap: 8px; flex: 1; }
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
.wizard-step__label { font-size: 11.5px; font-weight: 500; color: var(--fs-text-muted); white-space: nowrap; transition: color var(--fs-ease); }
.wizard-step--active .wizard-step__label,
.wizard-step--done   .wizard-step__label { color: var(--fs-text-primary); }
.wizard-step__line { flex: 1; height: 1px; background: var(--fs-border); margin: 0 8px; }

.form-body { display: flex; flex-direction: column; gap: 16px; padding: 0 10px 10px; }
.form-row { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 12px; }
.form-label {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted); padding-top: 8px;
}
.required { color: var(--fs-neg, #e57373); }
.field-wrap { display: flex; flex-direction: column; gap: 4px; }
.field-error { font-size: 11px; color: var(--fs-neg, #e57373); }
.field-hint  { font-size: 11px; color: var(--fs-text-muted); }
.warn-hint   { color: var(--fs-warn, #ff9800); display: flex; align-items: center; gap: 4px; }

.pipeline-desc { font-size: 12px; color: var(--fs-text-muted); margin: 0; padding: 0 2px; }

/* ── Stage cards ── */
.stage-card {
  border: 1px solid var(--fs-border);
  border-radius: 6px;
  overflow: hidden;
  transition: border-color var(--fs-ease), opacity var(--fs-ease);
}
.stage-card--disabled { opacity: 0.55; }

.stage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--fs-bg-hover);
  border-bottom: 1px solid var(--fs-border);
}
.stage-card--disabled .stage-header { border-bottom-color: transparent; }
.stage-header__left { display: flex; align-items: center; gap: 8px; }

.stage-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 5px; flex-shrink: 0;
}
.stage-icon--job     { background: color-mix(in srgb, var(--fs-accent) 14%, transparent); color: var(--fs-accent); }
.stage-icon--deploy  { background: color-mix(in srgb, var(--fs-pos, #4caf50) 14%, transparent); color: var(--fs-pos, #4caf50); }
.stage-icon--smoke   { background: color-mix(in srgb, var(--fs-warn, #ff9800) 14%, transparent); color: var(--fs-warn, #ff9800); }
.stage-icon--storage { background: color-mix(in srgb, var(--fs-text-muted) 12%, transparent); color: var(--fs-text-muted); }

.stage-title { font-size: 12.5px; font-weight: 600; color: var(--fs-text-primary); }

.stage-badge {
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
  padding: 1px 6px; border-radius: 8px;
}
.stage-badge--optional { background: color-mix(in srgb, var(--fs-text-muted) 12%, transparent); color: var(--fs-text-muted); }

.stage-body {
  display: flex; flex-direction: column; gap: 6px;
  padding: 12px 14px;
}

.stage-field-label {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--fs-text-muted);
}
.env-label { margin-top: 8px; }

.step-name-hint { font-size: 11px; color: var(--fs-text-muted); }
.step-name-hint code {
  font-family: var(--fs-font-mono);
  color: var(--fs-accent);
  background: color-mix(in srgb, var(--fs-accent) 10%, transparent);
  padding: 1px 5px; border-radius: 3px; font-size: 11px;
}

/* Toggle switch */
.toggle-label { display: flex; align-items: center; cursor: pointer; }
.toggle-input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-track {
  position: relative; width: 32px; height: 18px; border-radius: 9px;
  background: var(--fs-border); transition: background var(--fs-ease);
}
.toggle-input:checked + .toggle-track { background: var(--fs-accent); }
.toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%;
  background: #fff; transition: transform var(--fs-ease);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.toggle-input:checked + .toggle-track .toggle-thumb { transform: translateX(14px); }

/* Arrow between stages */
.pipeline-arrow {
  display: flex; flex-direction: column; align-items: center;
  padding: 2px 0; color: var(--fs-border);
}
.pipeline-arrow__line { width: 1px; height: 10px; background: var(--fs-border); }
.pipeline-arrow__line--dim { opacity: 0.35; }
.arrow-icon     { color: var(--fs-border); }
.arrow-icon--dim { color: var(--fs-border); opacity: 0.35; }

/* Env overrides table */
.env-table { display: flex; flex-direction: column; gap: 4px; margin-bottom: 2px; }
.env-header {
  display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; padding: 0 2px 2px;
}
.env-header__key,
.env-header__val {
  font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--fs-text-muted);
}
.env-row { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; align-items: center; }
.env-input { padding: 5px 8px; font-size: 12px; }
.add-env-btn { align-self: flex-start; padding: 4px 10px; font-size: 11.5px; margin-top: 2px; }

/* Icon button */
.icon-btn {
  background: none; border: none; cursor: pointer; padding: 4px 6px; border-radius: 3px;
  display: inline-flex; align-items: center; color: var(--fs-text-muted);
  transition: color var(--fs-ease), background var(--fs-ease);
}
.icon-btn--danger:hover { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

/* Loading/error states */
.picker-loading, .picker-error {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--fs-text-muted); padding: 8px 0;
}
.picker-error { color: var(--fs-neg, #e57373); }
.retry-link {
  background: none; border: none; cursor: pointer;
  color: var(--fs-accent); font-size: 12px; padding: 0; text-decoration: underline;
}

/* Review step */
.section-title {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted);
  padding: 0 2px 4px; border-bottom: 1px solid var(--fs-border);
}

.review-pipeline {
  display: flex; align-items: center; gap: 8px;
  padding: 16px 14px;
  background: var(--fs-bg-hover);
  border: 1px solid var(--fs-border);
  border-radius: 6px;
  flex-wrap: wrap;
}
.review-stage {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--fs-border);
  border-radius: 5px;
  background: var(--fs-bg-panel);
}
.review-stage__icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 4px; flex-shrink: 0;
}
.review-stage__text { display: flex; flex-direction: column; gap: 1px; }
.review-stage__label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fs-text-muted); }
.review-stage__name  { font-size: 11.5px; color: var(--fs-text-primary); }
.review-arrow { color: var(--fs-text-muted); flex-shrink: 0; }

.review-table { display: flex; flex-direction: column; gap: 6px; padding: 2px 0; }
.review-row { display: flex; gap: 12px; align-items: baseline; font-size: 12px; }
.review-key { color: var(--fs-accent); font-family: var(--fs-font-mono); font-size: 11px; min-width: 160px; }
.review-val { color: var(--fs-text-primary); }

/* Inline error */
.inline-msg {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; padding: 8px 10px; border-radius: 4px;
}
.inline-msg--error {
  color: var(--fs-neg, #e57373);
  background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent);
}

.form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

.fs-input {
  width: 100%; background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border); border-radius: 4px; padding: 7px 10px;
  font-size: 12.5px; font-family: inherit; color: var(--fs-text-primary);
  outline: none; transition: border-color var(--fs-ease); box-sizing: border-box;
}
.fs-input:focus  { border-color: var(--fs-accent); }
.fs-input--error { border-color: var(--fs-neg, #e57373); }
.fs-mono { font-family: var(--fs-font-mono); }

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

.success-body {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 48px 24px 40px; text-align: center;
}
.success-icon  { color: var(--fs-pos, #4caf50); }
.success-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--fs-text-primary); }
.success-sub   { margin: 0; font-size: 12.5px; color: var(--fs-text-muted); }
.success-actions { margin-top: 8px; display: flex; gap: 8px; }
</style>
