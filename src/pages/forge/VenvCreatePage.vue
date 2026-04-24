<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as forgeApi from '@/api/forgeApi'
import { formatSize } from '@/utils/format'

const router = useRouter()

// ─── Wizard state ─────────────────────────────────────────────────────────────

const step = ref<1 | 2>(1)

// ─── Step 1: Package info ─────────────────────────────────────────────────────

const name        = ref('')
const version     = ref('')
const description = ref('')
const nameError    = ref<string | null>(null)
const versionError = ref<string | null>(null)

const NAME_RE   = /^[a-zA-Z0-9_-]+$/
const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/

function validateStep1(): boolean {
  let ok = true
  if (!name.value.trim()) {
    nameError.value = 'Name is required'
    ok = false
  } else if (!NAME_RE.test(name.value.trim())) {
    nameError.value = 'Only letters, digits, hyphens and underscores'
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
  return ok
}

function goToStep2() {
  if (validateStep1()) step.value = 2
}

// ─── Step 2: Requirements file ────────────────────────────────────────────────

const reqFile   = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const dragOver  = ref(false)
const fileError = ref<string | null>(null)

const validating  = ref(false)
const validResult = ref<forgeApi.ValidationResult | null>(null)

const MAX_REQ_BYTES = 100 * 1024

function openFilePicker() { fileInput.value?.click() }

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (f) setFile(f)
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const f = e.dataTransfer?.files[0]
  if (f) setFile(f)
}

function setFile(f: File) {
  fileError.value  = null
  validResult.value = null
  if (f.size === 0) {
    fileError.value = 'File must not be empty'
    return
  }
  if (f.size > MAX_REQ_BYTES) {
    fileError.value = `File too large — max ${formatSize(MAX_REQ_BYTES)}`
    return
  }
  reqFile.value = f
}

function removeFile() {
  reqFile.value    = null
  validResult.value = null
  fileError.value  = null
}

function buildFormData(): FormData {
  const fd = new FormData()
  fd.append('name',         name.value.trim())
  fd.append('version',      version.value.trim())
  if (description.value.trim()) fd.append('description', description.value.trim())
  fd.append('requirements', reqFile.value!)
  return fd
}

async function validate() {
  if (!reqFile.value) { fileError.value = 'Select a requirements.txt first'; return }
  validating.value  = true
  validResult.value = null
  fileError.value   = null
  try {
    validResult.value = await forgeApi.validateVenv(buildFormData())
  } catch (e) {
    fileError.value = e instanceof Error ? e.message : 'Validation request failed'
  } finally {
    validating.value = false
  }
}

// ─── Submit ───────────────────────────────────────────────────────────────────

const submitting   = ref(false)
const submitError  = ref<string | null>(null)
const createdBuild = ref<forgeApi.VenvBuild | null>(null)

async function submit() {
  if (!reqFile.value) { fileError.value = 'Select a requirements.txt first'; return }
  submitting.value  = true
  submitError.value = null
  try {
    createdBuild.value = await forgeApi.createVenv(buildFormData())
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Submission failed'
  } finally {
    submitting.value = false
  }
}

function createAnother() {
  name.value        = ''
  version.value     = ''
  description.value = ''
  reqFile.value     = null
  validResult.value = null
  fileError.value   = null
  submitError.value = null
  createdBuild.value = null
  step.value        = 1
}

const stepLabels = ['Package Info', 'Requirements'] as const
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
      <span class="breadcrumb__current">Create Venv</span>
    </div>

    <CanvasPanel title="Create Venv Build" icon="mdi-plus-circle-outline" :wide="true">

      <!-- ── Success state ── -->
      <div v-if="createdBuild" class="success-body">
        <q-icon name="mdi-check-circle-outline" size="48px" class="success-icon" />
        <p class="success-title">Build submitted</p>
        <p class="success-sub">
          <span class="fs-mono">{{ createdBuild.name }}:{{ createdBuild.version }}</span>
          &mdash; build #{{ createdBuild.id }} is queued.
        </p>
        <div class="success-actions">
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

        <!-- ── Step 1: Package info ── -->
        <div v-if="step === 1" class="form-body">

          <div class="form-row">
            <label class="form-label">Name <span class="required">*</span></label>
            <div class="field-wrap">
              <input
                v-model="name"
                class="fs-input fs-mono"
                :class="{ 'fs-input--error': nameError }"
                placeholder="my-package"
                @keydown.enter.prevent="goToStep2"
              />
              <span v-if="nameError" class="field-error">{{ nameError }}</span>
              <span v-else class="field-hint">Letters, digits, hyphens and underscores only</span>
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
                @keydown.enter.prevent="goToStep2"
              />
              <span v-if="versionError" class="field-error">{{ versionError }}</span>
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

          <div class="form-actions">
            <button class="fs-btn fs-btn--primary" @click="goToStep2">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>

        </div>

        <!-- ── Step 2: Requirements ── -->
        <div v-else class="form-body">

          <!-- Drop zone (no file yet) -->
          <div v-if="!reqFile">
            <div
              class="drop-zone"
              :class="{ 'drop-zone--over': dragOver }"
              @click="openFilePicker"
              @dragover.prevent="dragOver = true"
              @dragleave="dragOver = false"
              @drop.prevent="onDrop"
            >
              <q-icon name="mdi-cloud-upload-outline" size="32px" class="drop-zone__icon" />
              <p class="drop-zone__text">
                Drop <span class="drop-zone__em">requirements.txt</span> here or
                <span class="drop-zone__link">browse</span>
              </p>
              <p class="drop-zone__hint">Plain text · max 100 KB</p>
            </div>
          </div>

          <!-- File selected card -->
          <div v-else class="file-card">
            <q-icon name="mdi-file-document-outline" size="18px" class="file-card__icon" />
            <div class="file-card__meta">
              <span class="file-card__name fs-mono">{{ reqFile.name }}</span>
              <span class="file-card__size">{{ formatSize(reqFile.size) }}</span>
            </div>
            <button class="file-card__remove" title="Remove" @click="removeFile">
              <q-icon name="mdi-close" size="13px" />
            </button>
          </div>

          <input
            ref="fileInput"
            type="file"
            accept=".txt,text/plain"
            style="display:none"
            @change="onFileChange"
          />

          <!-- File / validation error -->
          <div v-if="fileError" class="inline-msg inline-msg--error">
            <q-icon name="mdi-alert-circle-outline" size="13px" />
            {{ fileError }}
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
              <span v-if="validResult.valid">Requirements are valid</span>
              <span v-else>{{ validResult.violations.length }} violation{{ validResult.violations.length !== 1 ? 's' : '' }} found</span>
            </div>
            <div v-if="validResult.violations.length" class="violation-list">
              <div v-for="(v, i) in validResult.violations" :key="i" class="violation">
                <span v-if="v.line" class="violation__line fs-mono">L{{ v.line }}</span>
                <span class="violation__content fs-mono">{{ v.content }}</span>
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
              v-if="reqFile"
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
  background: var(--fs-bg-panel);
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
.field-error {
  font-size: 11px;
  color: var(--fs-neg, #e57373);
}
.field-hint {
  font-size: 11px;
  color: var(--fs-text-muted);
}

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
.fs-input:focus      { border-color: var(--fs-accent); }
.fs-input--error     { border-color: var(--fs-neg, #e57373); }
.fs-textarea         { resize: vertical; min-height: 72px; }
.fs-mono             { font-family: var(--fs-font-mono); }

/* Drop zone */
.drop-zone {
  border: 1.5px dashed var(--fs-border);
  border-radius: 6px;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: border-color var(--fs-ease), background var(--fs-ease);
  text-align: center;
}
.drop-zone:hover,
.drop-zone--over {
  border-color: var(--fs-accent);
  background: var(--fs-bg-hover);
}
.drop-zone__icon { color: var(--fs-text-muted); transition: color var(--fs-ease); }
.drop-zone:hover .drop-zone__icon,
.drop-zone--over .drop-zone__icon { color: var(--fs-accent); }
.drop-zone__text {
  margin: 0;
  font-size: 12.5px;
  color: var(--fs-text-primary);
}
.drop-zone__em   { font-family: var(--fs-font-mono); font-weight: 600; }
.drop-zone__link { color: var(--fs-accent); }
.drop-zone__hint {
  margin: 0;
  font-size: 11px;
  color: var(--fs-text-muted);
}

/* File card (selected file) */
.file-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 5px;
  border: 1px solid var(--fs-border);
  background: var(--fs-bg-hover);
}
.file-card__icon { color: var(--fs-accent); flex-shrink: 0; }
.file-card__meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.file-card__name {
  font-size: 12.5px;
  color: var(--fs-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-card__size {
  font-size: 11px;
  color: var(--fs-text-muted);
}
.file-card__remove {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  color: var(--fs-text-muted);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.file-card__remove:hover {
  color: var(--fs-neg, #e57373);
  background: var(--fs-bg-panel);
}

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
  gap: 0;
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
.violation__msg {
  color: var(--fs-neg, #e57373);
  flex: 1;
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
