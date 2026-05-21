<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as monitorApi from '@/api/weaveMonitorApi'
import { listWeaveChains } from '@/api/weaveApi'
import type { WeaveChain } from '@/api/weaveApi'

const router = useRouter()
const $q     = useQuasar()

// ─── State ─────────────────────────────────────────────────────────────────────

const step         = ref(1)
const submitting   = ref(false)
const chainsLoading = ref(false)
const chainsError  = ref<string | null>(null)
const chains       = ref<WeaveChain[]>([])

// form fields
const selectedChain  = ref<WeaveChain | null>(null)
const selectedStep   = ref('')
const artifactName   = ref('')
const tag            = ref('stable')
const ingressHost    = ref('')

// validation
const artifactError = ref<string | null>(null)
const stepError     = ref<string | null>(null)

// ─── Derived ───────────────────────────────────────────────────────────────────

const deploySteps = computed(() =>
  (selectedChain.value?.spec.steps ?? []).filter(s => s.stepKind === 'Deploy')
)

const generatedName = computed(() => {
  if (!artifactName.value) return ''
  const base = artifactName.value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
  return base
})

const previewName = computed(() => {
  if (!generatedName.value) return '(enter artifact name)'
  return `${generatedName.value}-<suffix>`
})

watch(selectedChain, () => {
  selectedStep.value = ''
  stepError.value = null
})

// ─── Load ──────────────────────────────────────────────────────────────────────

async function loadChains() {
  chainsLoading.value = true
  chainsError.value   = null
  try {
    const list = await listWeaveChains()
    chains.value = list.items
  } catch (e) {
    chainsError.value = e instanceof Error ? e.message : 'Failed to load chains'
  } finally {
    chainsLoading.value = false
  }
}

onMounted(loadChains)

// ─── Navigation ────────────────────────────────────────────────────────────────

function validateStep1(): boolean {
  let ok = true
  stepError.value    = null
  artifactError.value = null

  if (!selectedChain.value) { ok = false }
  if (!selectedStep.value) { stepError.value = 'Select a deploy step'; ok = false }
  if (!artifactName.value.trim()) { artifactError.value = 'Artifact name is required'; ok = false }
  if (artifactName.value && !/^[a-zA-Z0-9._-]+$/.test(artifactName.value)) {
    artifactError.value = 'Use letters, digits, dots, hyphens, underscores'
    ok = false
  }
  if (!tag.value.trim()) { ok = false }
  return ok
}

function nextStep() {
  if (validateStep1()) step.value = 2
}

function prevStep() {
  step.value = 1
}

// ─── Submit ────────────────────────────────────────────────────────────────────

function makeName(): string {
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${generatedName.value}-${suffix}`
}

async function submit() {
  submitting.value = true
  const runName = makeName()
  try {
    await monitorApi.createServiceRun({
      metadata: { name: runName },
      spec: {
        chainRef: { name: selectedChain.value!.metadata.name },
        stepOverrides: [{
          stepName:     selectedStep.value,
          artifactName: artifactName.value.trim(),
          tag:          tag.value.trim(),
          ...(ingressHost.value.trim() ? { ingressHost: ingressHost.value.trim() } : {}),
        }],
      },
    })
    $q.notify({ type: 'positive', message: `Service instance ${runName} created` })
    router.push(`/pipelines/services/${runName}`)
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Create failed' })
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-grid">
    <CanvasPanel
      title="Launch Service Instance"
      icon="mdi-plus-circle-outline"
      :wide="true"
      :loading="chainsLoading"
      :error="chainsError ?? undefined"
      @refresh="loadChains"
    >
      <!-- Step indicators -->
      <div class="step-bar">
        <div class="step-dot" :class="{ active: step >= 1, done: step > 1 }">
          <q-icon v-if="step > 1" name="mdi-check" size="12px" />
          <span v-else>1</span>
        </div>
        <div class="step-line" :class="{ done: step > 1 }" />
        <div class="step-dot" :class="{ active: step >= 2 }">
          <span>2</span>
        </div>
        <span class="step-label">{{ step === 1 ? 'Configure' : 'Review & Launch' }}</span>
      </div>

      <!-- Step 1: Configure -->
      <div v-if="step === 1" class="form-body">
        <div class="form-section">
          <label class="form-label">Chain <span class="req">*</span></label>
          <select
            v-model="selectedChain"
            class="fs-select"
          >
            <option :value="null" disabled>Select a chain…</option>
            <option v-for="c in chains" :key="c.metadata.name" :value="c">{{ c.metadata.name }}</option>
          </select>
          <p class="form-hint">The WeaveChain that defines the service deployment DAG.</p>
        </div>

        <div class="form-section">
          <label class="form-label">Deploy Step <span class="req">*</span></label>
          <select
            v-model="selectedStep"
            class="fs-select"
            :disabled="!selectedChain"
          >
            <option value="" disabled>{{ selectedChain ? 'Select a deploy step…' : 'Select a chain first' }}</option>
            <option v-for="s in deploySteps" :key="s.name" :value="s.name">{{ s.name }}</option>
          </select>
          <p v-if="stepError" class="form-error">{{ stepError }}</p>
          <p v-else-if="selectedChain && deploySteps.length === 0" class="form-error">
            This chain has no Deploy-kind steps.
          </p>
          <p v-else class="form-hint">The Deploy-kind step that will host this service instance.</p>
        </div>

        <div class="form-section">
          <label class="form-label">Artifact Name <span class="req">*</span></label>
          <input
            v-model="artifactName"
            class="fs-input"
            placeholder="e.g. app.my-service"
            @input="artifactError = null"
          />
          <p v-if="artifactError" class="form-error">{{ artifactError }}</p>
          <p v-else class="form-hint">
            Full artifact name in Fusion Index. Run name will be derived from this:
            <code class="inline-code">{{ previewName }}</code>
          </p>
        </div>

        <div class="form-section">
          <label class="form-label">Tag <span class="req">*</span></label>
          <input
            v-model="tag"
            class="fs-input"
            placeholder="stable"
          />
          <p class="form-hint">Mutable tag to track (e.g. <code class="inline-code">stable</code>, <code class="inline-code">canary</code>). The operator polls for tag changes every 60s.</p>
        </div>

        <div class="form-section">
          <label class="form-label">Ingress Host <span class="opt">(optional)</span></label>
          <input
            v-model="ingressHost"
            class="fs-input"
            placeholder="e.g. my-service.example.com"
          />
          <p class="form-hint">FQDN for the Ingress rule. Leave blank to skip Ingress creation.</p>
        </div>

        <div class="form-actions">
          <button class="fs-btn fs-btn--ghost" @click="router.push('/pipelines/services')">Cancel</button>
          <button class="fs-btn fs-btn--primary" @click="nextStep">Next →</button>
        </div>
      </div>

      <!-- Step 2: Review -->
      <div v-if="step === 2" class="form-body">
        <p class="review-intro">Review the configuration before launching.</p>

        <table class="review-table">
          <tbody>
            <tr>
              <td class="review-label">Chain</td>
              <td class="review-value fs-mono">{{ selectedChain?.metadata.name }}</td>
            </tr>
            <tr>
              <td class="review-label">Deploy Step</td>
              <td class="review-value fs-mono">{{ selectedStep }}</td>
            </tr>
            <tr>
              <td class="review-label">Artifact Name</td>
              <td class="review-value fs-mono">{{ artifactName }}</td>
            </tr>
            <tr>
              <td class="review-label">Tag</td>
              <td class="review-value fs-mono">{{ tag }}</td>
            </tr>
            <tr v-if="ingressHost">
              <td class="review-label">Ingress Host</td>
              <td class="review-value fs-mono">{{ ingressHost }}</td>
            </tr>
            <tr>
              <td class="review-label">Run Name</td>
              <td class="review-value">
                <span class="fs-mono">{{ generatedName }}-</span><span class="name-suffix">xxxx</span>
                <span class="form-hint" style="margin-left:6px">(random suffix appended at creation)</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="form-actions">
          <button class="fs-btn fs-btn--ghost" :disabled="submitting" @click="prevStep">← Back</button>
          <button class="fs-btn fs-btn--primary" :disabled="submitting" @click="submit">
            <q-spinner v-if="submitting" size="14px" style="margin-right:6px" />
            {{ submitting ? 'Launching…' : 'Launch Service' }}
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

/* Step bar */
.step-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 24px;
}
.step-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--fs-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--fs-text-muted);
  flex-shrink: 0;
  transition: border-color var(--fs-ease), background var(--fs-ease), color var(--fs-ease);
}
.step-dot.active { border-color: var(--fs-accent); color: var(--fs-accent); }
.step-dot.done   { border-color: var(--fs-pos, #81c784); background: var(--fs-pos, #81c784); color: #fff; }
.step-line {
  flex: 0 0 32px;
  height: 2px;
  background: var(--fs-border);
  transition: background var(--fs-ease);
}
.step-line.done { background: var(--fs-pos, #81c784); }
.step-label {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fs-accent);
}

/* Form */
.form-body { display: flex; flex-direction: column; gap: 0; }

.form-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 18px;
  max-width: 520px;
}
.form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--fs-text-primary);
}
.req  { color: var(--fs-neg, #e57373); margin-left: 2px; }
.opt  { color: var(--fs-text-muted); font-weight: 400; font-size: 11px; }

.fs-input, .fs-select {
  background: var(--fs-bg-surface);
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  color: var(--fs-text-primary);
  font-size: 13px;
  padding: 7px 10px;
  width: 100%;
  box-sizing: border-box;
  outline: none;
  transition: border-color var(--fs-ease);
  font-family: inherit;
}
.fs-input:focus, .fs-select:focus { border-color: var(--fs-accent); }
.fs-select { cursor: pointer; }
.fs-select:disabled { opacity: 0.5; cursor: not-allowed; }

.form-hint {
  font-size: 11.5px;
  color: var(--fs-text-muted);
  margin: 0;
  line-height: 1.5;
}
.form-error {
  font-size: 11.5px;
  color: var(--fs-neg, #e57373);
  margin: 0;
}

.inline-code {
  font-family: var(--fs-font-mono);
  font-size: 11px;
  background: color-mix(in srgb, var(--fs-accent) 10%, transparent);
  color: var(--fs-accent);
  padding: 1px 5px;
  border-radius: 3px;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  justify-content: flex-end;
  max-width: 520px;
}

/* Review table */
.review-intro {
  font-size: 12.5px;
  color: var(--fs-text-muted);
  margin: 0 0 16px 0;
}
.review-table {
  border-collapse: collapse;
  font-size: 13px;
  max-width: 600px;
  width: 100%;
  margin-bottom: 24px;
}
.review-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--fs-border);
  vertical-align: top;
}
.review-table tr:last-child td { border-bottom: none; }
.review-label {
  color: var(--fs-text-muted);
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  width: 140px;
}
.review-value { color: var(--fs-text-primary); }
.name-suffix { color: var(--fs-text-muted); font-family: var(--fs-font-mono); }

/* Buttons */
.fs-btn {
  display: inline-flex;
  align-items: center;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  padding: 7px 16px;
  cursor: pointer;
  transition: opacity var(--fs-ease), background var(--fs-ease);
  font-family: inherit;
}
.fs-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fs-btn--primary { background: var(--fs-accent); color: #fff; }
.fs-btn--primary:hover:not(:disabled) { opacity: 0.85; }
.fs-btn--ghost {
  background: transparent;
  color: var(--fs-text-muted);
  border: 1px solid var(--fs-border);
}
.fs-btn--ghost:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }

.fs-mono { font-family: var(--fs-font-mono); }
</style>
