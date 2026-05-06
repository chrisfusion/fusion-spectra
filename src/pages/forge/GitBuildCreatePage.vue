<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as forgeApi from '@/api/forgeApi'

const router = useRouter()

// ─── Wizard state ─────────────────────────────────────────────────────────────

const step       = ref<1 | 2>(1)
const stepLabels = ['Repository', 'Review & Submit'] as const

// ─── Step 1: Repository config ────────────────────────────────────────────────

type MetadataSource = 'manual' | 'version' | 'full'

const repoUrl        = ref('')
const repoRef        = ref('')
const metadataSource = ref<MetadataSource>('manual')
const name           = ref('')
const version        = ref('')
const description    = ref('')
const entrypointFile = ref('')
const projectDir     = ref('')

const repoUrlError  = ref<string | null>(null)
const nameError     = ref<string | null>(null)
const versionError  = ref<string | null>(null)
const projectDirErr = ref<string | null>(null)

const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/
const URL_RE    = /^https:\/\/.+/

function validateStep1(): boolean {
  let ok = true

  if (!repoUrl.value.trim()) {
    repoUrlError.value = 'Repository URL is required'
    ok = false
  } else if (!URL_RE.test(repoUrl.value.trim())) {
    repoUrlError.value = 'Must be an HTTPS URL'
    ok = false
  } else {
    repoUrlError.value = null
  }

  if (!name.value.trim()) {
    nameError.value = 'Name is required'
    ok = false
  } else {
    nameError.value = null
  }

  if (!version.value.trim()) {
    versionError.value = 'Version is required'
    ok = false
  } else if (!SEMVER_RE.test(version.value.trim())) {
    versionError.value = 'Must be semver: 1.0.0'
    ok = false
  } else {
    versionError.value = null
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

function buildPayload(): forgeApi.GitBuildPayload {
  const p: forgeApi.GitBuildPayload = {
    repo_url:        repoUrl.value.trim(),
    name:            name.value.trim(),
    version:         version.value.trim(),
    metadata_source: metadataSource.value,
  }
  if (repoRef.value.trim())        p.repo_ref        = repoRef.value.trim()
  if (description.value.trim())    p.description     = description.value.trim()
  if (entrypointFile.value.trim()) p.entrypoint_file = entrypointFile.value.trim()
  if (projectDir.value.trim())     p.project_dir     = projectDir.value.trim()
  return p
}

function goToStep2() {
  if (validateStep1()) step.value = 2
}

// ─── Step 2: Review & Submit ──────────────────────────────────────────────────

const validating  = ref(false)
const validResult = ref<forgeApi.ValidationResult | null>(null)
const validateErr = ref<string | null>(null)

async function validate() {
  validating.value  = true
  validResult.value = null
  validateErr.value = null
  try {
    validResult.value = await forgeApi.validateGitBuild(buildPayload())
  } catch (e) {
    validateErr.value = e instanceof Error ? e.message : 'Validation request failed'
  } finally {
    validating.value = false
  }
}

const submitting   = ref(false)
const submitError  = ref<string | null>(null)
const createdBuild = ref<forgeApi.GitBuild | null>(null)

async function submit() {
  submitting.value  = true
  submitError.value = null
  try {
    createdBuild.value = await forgeApi.createGitBuild(buildPayload())
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Submission failed'
  } finally {
    submitting.value = false
  }
}

function createAnother() {
  repoUrl.value        = ''
  repoRef.value        = ''
  metadataSource.value = 'manual'
  name.value           = ''
  version.value        = ''
  description.value    = ''
  entrypointFile.value = ''
  projectDir.value     = ''
  validResult.value    = null
  submitError.value    = null
  createdBuild.value   = null
  step.value           = 1
}

// ─── Review summary ───────────────────────────────────────────────────────────

const META_LABEL: Record<MetadataSource, string> = {
  manual:  'Manual (name + version provided)',
  version: 'From pyproject.toml (version only)',
  full:    'From pyproject.toml (name + version)',
}
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/forge')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Forge
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">Git Build</span>
    </div>

    <CanvasPanel title="Create Git Build" icon="mdi-git" :wide="true">

      <!-- ── Success state ── -->
      <div v-if="createdBuild" class="success-body">
        <q-icon name="mdi-check-circle-outline" size="48px" class="success-icon" />
        <p class="success-title">Build submitted</p>
        <p class="success-sub">
          <span class="fs-mono">{{ createdBuild.name }}:{{ createdBuild.version }}</span>
          &mdash; build #{{ createdBuild.id }} is queued.
        </p>
        <div class="success-actions">
          <button class="fs-btn fs-btn--ghost" @click="router.push('/forge/venvs')">
            <q-icon name="mdi-list-box-outline" size="14px" />
            View Builds
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

        <!-- ── Step 1: Repository config ── -->
        <div v-if="step === 1" class="form-body">

          <div class="form-row">
            <label class="form-label">Repo URL <span class="required">*</span></label>
            <div class="field-wrap">
              <input
                v-model="repoUrl"
                class="fs-input fs-mono"
                :class="{ 'fs-input--error': repoUrlError }"
                placeholder="https://github.com/org/repo"
              />
              <span v-if="repoUrlError" class="field-error">{{ repoUrlError }}</span>
              <span v-else class="field-hint">HTTPS git URL</span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Ref</label>
            <div class="field-wrap">
              <input
                v-model="repoRef"
                class="fs-input fs-mono"
                placeholder="main"
              />
              <span class="field-hint">Branch or tag (default: main)</span>
            </div>
          </div>

          <div class="form-row form-row--top">
            <label class="form-label">Metadata <span class="required">*</span></label>
            <div class="field-wrap">
              <div class="kind-toggle">
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': metadataSource === 'manual' }"
                  @click="metadataSource = 'manual'"
                >Manual</button>
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': metadataSource === 'version' }"
                  @click="metadataSource = 'version'"
                >From pyproject (version)</button>
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': metadataSource === 'full' }"
                  @click="metadataSource = 'full'"
                >From pyproject (full)</button>
              </div>
              <span class="field-hint">
                <template v-if="metadataSource === 'manual'">Name and version are used as-is</template>
                <template v-else-if="metadataSource === 'version'">Name is used as-is; version is read from pyproject.toml</template>
                <template v-else>Name and version are read from pyproject.toml; provided values used as fallback</template>
              </span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Name <span class="required">*</span></label>
            <div class="field-wrap">
              <input
                v-model="name"
                class="fs-input fs-mono"
                :class="{ 'fs-input--error': nameError }"
                placeholder="my-package"
              />
              <span v-if="nameError" class="field-error">{{ nameError }}</span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Version <span class="required">*</span></label>
            <div class="field-wrap">
              <input
                v-model="version"
                class="fs-input fs-mono"
                :class="{ 'fs-input--error': versionError }"
                placeholder="1.0.0"
              />
              <span v-if="versionError" class="field-error">{{ versionError }}</span>
              <span v-if="metadataSource !== 'manual' && !versionError" class="field-hint">Overridden by pyproject.toml if found</span>
            </div>
          </div>

          <div class="form-row form-row--top">
            <label class="form-label">Description</label>
            <textarea
              v-model="description"
              class="fs-input fs-textarea"
              placeholder="Optional description"
              rows="3"
            />
          </div>

          <div class="form-row">
            <label class="form-label">Entrypoint</label>
            <div class="field-wrap">
              <input
                v-model="entrypointFile"
                class="fs-input fs-mono"
                placeholder="main.py"
              />
              <span class="field-hint">Python entrypoint filename at repo root (optional)</span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Project Dir</label>
            <div class="field-wrap">
              <input
                v-model="projectDir"
                class="fs-input fs-mono"
                :class="{ 'fs-input--error': projectDirErr }"
                placeholder="services/myapp"
              />
              <span v-if="projectDirErr" class="field-error">{{ projectDirErr }}</span>
              <span v-else class="field-hint">Monorepo subdirectory — relative path, no .. (optional)</span>
            </div>
          </div>

          <div class="form-actions">
            <button class="fs-btn fs-btn--primary" @click="goToStep2">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>

        </div>

        <!-- ── Step 2: Review & Submit ── -->
        <div v-else class="form-body">

          <div class="review-table">
            <div class="review-row">
              <span class="review-key">Repo URL</span>
              <span class="review-val fs-mono">{{ repoUrl }}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Ref</span>
              <span class="review-val fs-mono">{{ repoRef || 'main' }}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Metadata</span>
              <span class="review-val">{{ META_LABEL[metadataSource] }}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Name</span>
              <span class="review-val fs-mono">{{ name }}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Version</span>
              <span class="review-val fs-mono">{{ version }}</span>
            </div>
            <div v-if="description" class="review-row">
              <span class="review-key">Description</span>
              <span class="review-val">{{ description }}</span>
            </div>
            <div v-if="entrypointFile" class="review-row">
              <span class="review-key">Entrypoint</span>
              <span class="review-val fs-mono">{{ entrypointFile }}</span>
            </div>
            <div v-if="projectDir" class="review-row">
              <span class="review-key">Project Dir</span>
              <span class="review-val fs-mono">{{ projectDir }}</span>
            </div>
          </div>

          <!-- Validate error -->
          <div v-if="validateErr" class="inline-msg inline-msg--error">
            <q-icon name="mdi-alert-circle-outline" size="13px" />
            {{ validateErr }}
          </div>

          <!-- Validation result -->
          <div
            v-if="validResult"
            class="valid-result"
            :class="validResult.valid ? 'valid-result--ok' : 'valid-result--fail'"
          >
            <div class="valid-result__header">
              <q-icon
                :name="validResult.valid ? 'mdi-check-circle-outline' : 'mdi-close-circle-outline'"
                size="14px"
              />
              <span v-if="validResult.valid">Configuration is valid</span>
              <span v-else>{{ validResult.violations.length }} violation{{ validResult.violations.length !== 1 ? 's' : '' }} found</span>
            </div>
            <div v-if="validResult.violations.length" class="violation-list">
              <div v-for="(v, i) in validResult.violations" :key="i" class="violation">
                <span v-if="v.line" class="violation__line fs-mono">L{{ v.line }}</span>
                <span v-if="v.content" class="violation__content fs-mono">{{ v.content }}</span>
                <span class="violation__msg">{{ v.message }}</span>
              </div>
            </div>
          </div>

          <!-- Submit error -->
          <div v-if="submitError" class="inline-msg inline-msg--error">
            <q-icon name="mdi-alert-circle-outline" size="13px" />
            {{ submitError }}
          </div>

          <div class="form-actions">
            <button class="fs-btn fs-btn--ghost" :disabled="submitting || validating" @click="step = 1">
              <q-icon name="mdi-arrow-left" size="14px" /> Back
            </button>
            <button
              class="fs-btn fs-btn--ghost"
              :disabled="validating || submitting"
              @click="validate"
            >
              <q-spinner v-if="validating" size="13px" />
              <q-icon v-else name="mdi-check-outline" size="14px" />
              {{ validating ? 'Validating…' : 'Validate' }}
            </button>
            <button
              class="fs-btn fs-btn--primary"
              :disabled="submitting || validating"
              @click="submit"
            >
              <q-spinner v-if="submitting" size="13px" color="white" />
              <q-icon v-else name="mdi-send-outline" size="14px" />
              {{ submitting ? 'Submitting…' : 'Submit Build' }}
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
.breadcrumb__current {
  font-size: 12px;
  color: var(--fs-accent);
  font-weight: 500;
}
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
  background: var(--fs-bg-elevated);
  transition: border-color var(--fs-ease), background var(--fs-ease), color var(--fs-ease);
}
.wizard-step--active .wizard-step__dot {
  border-color: var(--fs-accent);
  background: var(--fs-accent);
  color: #fff;
}
.wizard-step--done .wizard-step__dot {
  border-color: var(--fs-pos, #4caf50);
  background: var(--fs-pos, #4caf50);
  color: #fff;
}
.wizard-step__label {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--fs-text-muted);
  white-space: nowrap;
  transition: color var(--fs-ease);
}
.wizard-step--active .wizard-step__label,
.wizard-step--done  .wizard-step__label { color: var(--fs-text-primary); }
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
.form-row--top { align-items: start; }
.form-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  padding-top: 8px;
}
.required { color: var(--fs-neg, #e57373); }

.field-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field-error { font-size: 11px; color: var(--fs-neg, #e57373); }
.field-hint  { font-size: 11px; color: var(--fs-text-muted); }

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

/* Metadata source toggle */
.kind-toggle {
  display: flex;
  gap: 0;
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  overflow: hidden;
  width: fit-content;
}
.kind-btn {
  padding: 6px 14px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  background: var(--fs-bg-hover);
  border: none;
  border-right: 1px solid var(--fs-border);
  color: var(--fs-text-muted);
  transition: background var(--fs-ease), color var(--fs-ease);
}
.kind-btn:last-child { border-right: none; }
.kind-btn:hover { color: var(--fs-text-primary); }
.kind-btn--active {
  background: var(--fs-accent);
  color: #fff;
}

/* Review table */
.review-table {
  border: 1px solid var(--fs-border);
  border-radius: 5px;
  overflow: hidden;
}
.review-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--fs-border);
  font-size: 12.5px;
}
.review-row:last-child { border-bottom: none; }
.review-key {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  padding-top: 1px;
}
.review-val { color: var(--fs-text-primary); word-break: break-all; }

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

/* Validation result */
.valid-result {
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid var(--fs-border);
}
.valid-result--ok   { border-color: var(--fs-pos, #4caf50); }
.valid-result--fail { border-color: var(--fs-neg, #e57373); }

.valid-result__header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
}
.valid-result--ok   .valid-result__header { color: var(--fs-pos, #4caf50); background: color-mix(in srgb, var(--fs-pos, #4caf50) 8%, transparent); }
.valid-result--fail .valid-result__header { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 8%, transparent); }

.violation-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--fs-border);
}
.violation {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 12px;
  font-size: 11.5px;
  border-bottom: 1px solid var(--fs-border);
}
.violation:last-child { border-bottom: none; }
.violation__line {
  flex-shrink: 0;
  font-size: 10.5px;
  color: var(--fs-text-muted);
  background: var(--fs-bg-hover);
  padding: 1px 5px;
  border-radius: 3px;
}
.violation__content {
  flex-shrink: 0;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fs-text-primary);
}
.violation__msg { color: var(--fs-neg, #e57373); flex: 1; }

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
.success-icon { color: var(--fs-pos, #4caf50); }
.success-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--fs-text-primary);
}
.success-sub {
  margin: 0;
  font-size: 12.5px;
  color: var(--fs-text-muted);
}
.success-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}
</style>
