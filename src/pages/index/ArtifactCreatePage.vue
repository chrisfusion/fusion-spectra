<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import JsonEditor from '@/components/JsonEditor.vue'
import * as indexApi from '@/api/indexApi'
import { formatSize } from '@/utils/format'

const router = useRouter()

// ─── Wizard state ─────────────────────────────────────────────────────────────

const step = ref<1 | 2 | 3>(1)

// ─── Step 1: Artifact ─────────────────────────────────────────────────────────

const fullName    = ref('')
const description = ref('')
const nameError    = ref<string | null>(null)
const checkingName = ref(false)

function validateName(): boolean {
  if (!fullName.value.trim()) {
    nameError.value = 'Full name is required'
    return false
  }
  nameError.value = null
  return true
}

async function goToStep2() {
  if (!validateName()) return
  checkingName.value = true
  try {
    const page = await indexApi.listArtifacts({ name: fullName.value.trim(), pageSize: 5 })
    const exists = page.items.some(a => a.fullName === fullName.value.trim())
    if (exists) {
      nameError.value = 'An artifact with this name already exists'
      return
    }
  } catch {
    // network error during check — allow proceeding; submit will surface the real error
  } finally {
    checkingName.value = false
  }
  step.value = 2
}

// ─── Step 2: Version ──────────────────────────────────────────────────────────

const version      = ref('')
const versionError = ref<string | null>(null)
const config       = ref('')
const configValid  = ref(true)

const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/

function validateVersion(): boolean {
  if (!version.value.trim()) {
    versionError.value = 'Version is required'
    return false
  }
  if (!SEMVER_RE.test(version.value.trim())) {
    versionError.value = 'Must be semver format: 1.0.0'
    return false
  }
  versionError.value = null
  return true
}

function goToStep3() {
  if (validateVersion() && configValid.value) step.value = 3
}

// ─── Step 3: Files ────────────────────────────────────────────────────────────

const files          = ref<File[]>([])
const fileInput      = ref<HTMLInputElement | null>(null)
const dragOver       = ref(false)
const dupWarning     = ref<string | null>(null)

function openFilePicker() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  addFiles(Array.from(input.files ?? []))
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  addFiles(Array.from(e.dataTransfer?.files ?? []))
}

function addFiles(incoming: File[]) {
  dupWarning.value = null
  const existing = new Set(files.value.map(f => f.name))
  const skipped: string[] = []
  for (const f of incoming) {
    if (existing.has(f.name)) {
      skipped.push(f.name)
    } else {
      files.value.push(f)
      existing.add(f.name)
    }
  }
  if (skipped.length) {
    dupWarning.value = `Skipped ${skipped.length} duplicate name${skipped.length > 1 ? 's' : ''}: ${skipped.join(', ')}`
  }
}

function removeFile(index: number) {
  files.value.splice(index, 1)
}


// ─── Submit ───────────────────────────────────────────────────────────────────

const submitting      = ref(false)
const submitError     = ref<string | null>(null)
const submitStatus    = ref('')
const createdId       = ref<number | null>(null)

async function submit() {
  submitting.value  = true
  submitError.value = null
  createdId.value   = null

  try {
    submitStatus.value = 'Creating artifact…'
    const artifact = await indexApi.createArtifact({
      fullName:    fullName.value.trim(),
      description: description.value.trim() || undefined,
    })
    createdId.value = artifact.id

    submitStatus.value = 'Creating version…'
    const ver = await indexApi.createVersion(artifact.id, {
      version: version.value.trim(),
      config:  config.value.trim() || undefined,
    })

    if (files.value.length > 0) {
      for (let i = 0; i < files.value.length; i++) {
        submitStatus.value = `Uploading file ${i + 1} of ${files.value.length}…`
        await indexApi.uploadFile(artifact.id, ver.version, files.value[i])
      }
    }

    router.push(`/fusion-index/artifacts/${artifact.id}`)
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Creation failed'
  } finally {
    submitting.value = false
    submitStatus.value = ''
  }
}

// ─── Step label helper ────────────────────────────────────────────────────────

const stepLabels = ['Artifact', 'Version', 'Files'] as const

const canSubmit = computed(() => !submitting.value)
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/fusion-index/artifacts')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Artifact List
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">Create Artifact</span>
    </div>

    <!-- Wizard panel -->
    <CanvasPanel
      title="Create Artifact"
      icon="mdi-upload-outline"
      :wide="true"
    >
      <!-- Step indicator -->
      <div class="wizard-steps">
        <div
          v-for="(label, i) in stepLabels"
          :key="label"
          class="wizard-step"
          :class="{
            'wizard-step--active':    step === i + 1,
            'wizard-step--done':      step > i + 1,
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

      <!-- ── Step 1: Artifact ── -->
      <div v-if="step === 1" class="form-body">
        <div class="form-row">
          <label class="form-label">Full name <span class="required">*</span></label>
          <div class="field-wrap">
            <input
              v-model="fullName"
              class="fs-input"
              :class="{ 'fs-input--error': nameError }"
              placeholder="org/artifact-name"
              @keydown.enter.prevent="goToStep2"
            />
            <span v-if="nameError" class="field-error">{{ nameError }}</span>
          </div>
        </div>
        <div class="form-row">
          <label class="form-label">Description</label>
          <textarea
            v-model="description"
            class="fs-input fs-textarea"
            placeholder="Optional description"
            rows="3"
          />
        </div>
        <div class="form-actions">
          <button class="fs-btn fs-btn--primary" :disabled="checkingName" @click="goToStep2">
            <q-spinner v-if="checkingName" size="13px" color="white" />
            <template v-else>Next <q-icon name="mdi-arrow-right" size="14px" /></template>
          </button>
        </div>
      </div>

      <!-- ── Step 2: Version ── -->
      <div v-else-if="step === 2" class="form-body">
        <div class="form-row">
          <label class="form-label">Version <span class="required">*</span></label>
          <div class="field-wrap">
            <input
              v-model="version"
              class="fs-input fs-mono"
              :class="{ 'fs-input--error': versionError }"
              placeholder="1.0.0"
              @keydown.enter="goToStep3"
            />
            <span v-if="versionError" class="field-error">{{ versionError }}</span>
          </div>
        </div>
        <div class="form-row form-row--top">
          <label class="form-label">Config <span class="optional">optional</span></label>
          <div class="field-wrap">
            <JsonEditor
              v-model="config"
              placeholder='{ "key": "value" }'
              @valid="configValid = $event"
            />
            <span v-if="!configValid" class="field-error">Invalid JSON</span>
          </div>
        </div>
        <div class="form-actions">
          <button class="fs-btn fs-btn--ghost" @click="step = 1">
            <q-icon name="mdi-arrow-left" size="14px" />
            Back
          </button>
          <button class="fs-btn fs-btn--primary" @click="goToStep3">
            Next
            <q-icon name="mdi-arrow-right" size="14px" />
          </button>
        </div>
      </div>

      <!-- ── Step 3: Files ── -->
      <div v-else class="form-body">

        <!-- Drop zone -->
        <div
          class="drop-zone"
          :class="{ 'drop-zone--over': dragOver }"
          @click="openFilePicker"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="onDrop"
        >
          <q-icon name="mdi-cloud-upload-outline" size="32px" class="drop-zone__icon" />
          <p class="drop-zone__text">Drop files here or <span class="drop-zone__link">browse</span></p>
          <p class="drop-zone__hint">Multiple files supported</p>
        </div>
        <input
          ref="fileInput"
          type="file"
          multiple
          style="display:none"
          @change="onFileChange"
        />

        <!-- Duplicate file warning -->
        <div v-if="dupWarning" class="dup-warning">
          <q-icon name="mdi-information-outline" size="13px" />
          {{ dupWarning }}
        </div>

        <!-- File list -->
        <div v-if="files.length" class="file-list">
          <div
            v-for="(f, i) in files"
            :key="f.name"
            class="file-item"
          >
            <q-icon name="mdi-file-outline" size="15px" class="file-item__icon" />
            <span class="file-item__name fs-mono">{{ f.name }}</span>
            <span class="file-item__size muted-text">{{ formatSize(f.size) }}</span>
            <button class="file-item__remove" @click="removeFile(i)" title="Remove">
              <q-icon name="mdi-close" size="13px" />
            </button>
          </div>
        </div>

        <!-- Error -->
        <div v-if="submitError" class="submit-error">
          <q-icon name="mdi-alert-circle-outline" size="14px" />
          <span>{{ submitError }}</span>
          <button
            v-if="createdId !== null"
            class="submit-error__link"
            @click="router.push(`/fusion-index/artifacts/${createdId}`)"
          >
            Go to artifact →
          </button>
        </div>

        <!-- Status -->
        <div v-if="submitting" class="submit-status">
          <q-spinner size="13px" color="grey-5" />
          {{ submitStatus }}
        </div>

        <div class="form-actions">
          <button class="fs-btn fs-btn--ghost" :disabled="submitting" @click="step = 2">
            <q-icon name="mdi-arrow-left" size="14px" />
            Back
          </button>
          <button
            class="fs-btn fs-btn--primary"
            :disabled="!canSubmit"
            @click="submit"
          >
            <q-spinner v-if="submitting" size="13px" color="white" />
            <q-icon v-else name="mdi-check" size="14px" />
            {{ submitting ? 'Creating…' : 'Create Artifact' }}
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

/* Wizard step indicator */
.wizard-steps {
  display: flex;
  align-items: center;
  padding: 16px 10px 24px;
  gap: 0;
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
.wizard-step--done  .wizard-step__label {
  color: var(--fs-text-primary);
}
.wizard-step__line {
  flex: 1;
  height: 1px;
  background: var(--fs-border);
  margin: 0 8px;
}

/* Form body */
.form-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 10px 10px;
}

.form-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: start;
  gap: 12px;
}

.form-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  padding-top: 8px;
}

.required  { color: var(--fs-neg, #e57373); }
.optional  { color: var(--fs-text-muted); font-size: 9.5px; letter-spacing: 0.04em; text-transform: lowercase; font-weight: 400; }
.form-row--top { align-items: start; }

.field-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

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
.fs-input:focus { border-color: var(--fs-accent); }
.fs-input--error { border-color: var(--fs-neg, #e57373); }
.fs-textarea { resize: vertical; min-height: 72px; }

.field-error {
  font-size: 11px;
  color: var(--fs-neg, #e57373);
}

/* Drop zone */
.drop-zone {
  border: 1.5px dashed var(--fs-border);
  border-radius: 6px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: border-color var(--fs-ease), background var(--fs-ease);
  text-align: center;
}
.drop-zone:hover,
.drop-zone--over {
  border-color: var(--fs-accent);
  background: var(--fs-bg-hover);
}
.drop-zone__icon { color: var(--fs-text-muted); }
.drop-zone--over .drop-zone__icon,
.drop-zone:hover .drop-zone__icon { color: var(--fs-accent); }
.drop-zone__text {
  font-size: 12.5px;
  color: var(--fs-text-primary);
  margin: 0;
}
.drop-zone__link { color: var(--fs-accent); }
.drop-zone__hint {
  font-size: 11px;
  color: var(--fs-text-muted);
  margin: 0;
}

/* File list */
.file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  background: var(--fs-bg-hover);
  font-size: 12px;
}
.file-item__icon { color: var(--fs-text-muted); flex-shrink: 0; }
.file-item__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fs-text-primary);
}
.file-item__size { flex-shrink: 0; font-size: 11px; }
.file-item__remove {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  color: var(--fs-text-muted);
  display: flex;
  align-items: center;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.file-item__remove:hover {
  color: var(--fs-neg, #e57373);
  background: var(--fs-bg-panel);
}

/* Duplicate file warning */
.dup-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--fs-warn, #ffa726);
  padding: 6px 10px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--fs-warn, #ffa726) 10%, transparent);
}

/* Submit feedback */
.submit-error {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--fs-neg, #e57373);
  padding: 8px 10px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent);
}
.submit-error__link {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  color: var(--fs-accent);
  text-decoration: underline;
  padding: 0;
  white-space: nowrap;
}
.submit-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--fs-text-muted);
  padding: 4px 0;
}

/* Action row */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

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
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease);
}
.fs-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.fs-btn--primary {
  background: var(--fs-accent);
  color: #fff;
  border-color: var(--fs-accent);
}
.fs-btn--primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.fs-btn--ghost {
  background: transparent;
  color: var(--fs-text-muted);
  border-color: var(--fs-border);
}
.fs-btn--ghost:hover:not(:disabled) {
  color: var(--fs-text-primary);
  background: var(--fs-bg-hover);
  border-color: var(--fs-border-bright);
}

.muted-text { color: var(--fs-text-muted); }
.muted-icon { color: var(--fs-text-muted); }
.fs-mono    { font-family: var(--fs-font-mono); }
</style>
