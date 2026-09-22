<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import CronPicker from '@/components/CronPicker.vue'
import TagChipInput from '@/components/TagChipInput.vue'
import * as wizardApi from '@/api/wizardApi'
import { wizardDisplayMeta, wizardTitleOverrides } from '@/data/wizardDisplayMeta'
import type { WizardFieldDisplayMeta } from '@/data/wizardDisplayMeta'

type ObjectRow = Record<string, string>

// Generic wizard-create page: renders its Setup form from a WizardDefinition's own parameter
// schema (fusion-wizard backend), instead of one hand-written page per wizard. A definition
// needs zero frontend code to get a working wizard here; wizardDisplayMeta.ts is only for
// polishing a specific definition's labels/widgets/conditional fields. On submit, this page's
// only job is to create the run and hand off to WizardRunDetailPage.vue (/wizards/runs/:name),
// which is the one place that polls/renders progress — used both right after creation and when
// revisiting a run later, so navigating away and back never loses track of it.

const route  = useRoute()
const router = useRouter()
const defName = route.params.definition as string

const definition = ref<wizardApi.WizardDefinition | null>(null)
const loadError  = ref<string | null>(null)
const loading    = ref(true)
const creating   = ref(false)
const createError = ref<string | null>(null)

// ─── Setup form state ────────────────────────────────────────────────────────

const fields       = reactive<Record<string, string | string[] | boolean | ObjectRow[]>>({})
const fieldErrors  = reactive<Record<string, string | null>>({})

// 'objectRows' widget state: the pending "add row" key input, per objectList param.
const newRowKey      = reactive<Record<string, string>>({})
const newRowKeyError = reactive<Record<string, string | null>>({})

function defaultValueFor(p: wizardApi.WizardParameter): string | string[] | boolean | ObjectRow[] {
  if (p.default !== undefined && p.default !== null) {
    if (p.type === 'stringList') return Array.isArray(p.default) ? p.default as string[] : []
    if (p.type === 'objectList') return Array.isArray(p.default) ? p.default as ObjectRow[] : []
    if (p.type === 'boolean')    return Boolean(p.default)
    return String(p.default)
  }
  if (p.type === 'stringList' || p.type === 'objectList') return []
  if (p.type === 'boolean')    return false
  return ''
}

function resetFields() {
  if (!definition.value) return
  for (const p of definition.value.spec.parameters) {
    fields[p.name]      = defaultValueFor(p)
    fieldErrors[p.name] = null
    newRowKey[p.name]      = ''
    newRowKeyError[p.name] = null
  }
}

function addRow(p: wizardApi.WizardParameter) {
  const val = (newRowKey[p.name] ?? '').trim()
  newRowKeyError[p.name] = null
  if (!val) return
  if (p.pattern) {
    try {
      if (!new RegExp(p.pattern).test(val)) {
        newRowKeyError[p.name] = `Must match pattern: ${p.pattern}`
        return
      }
    } catch { /* a bad pattern on the definition itself isn't this form's problem */ }
  }
  const rows = fields[p.name] as ObjectRow[]
  if (rows.some(r => r.key === val)) {
    newRowKeyError[p.name] = 'Already added'
    return
  }
  const row: ObjectRow = { key: val }
  for (const rf of metaFor(p.name).rowFields ?? []) {
    row[rf.key] = rf.widget === 'select' ? (rf.options?.[0]?.value ?? '') : ''
  }
  rows.push(row)
  newRowKey[p.name] = ''
}
function removeRow(p: wizardApi.WizardParameter, key: string) {
  fields[p.name] = (fields[p.name] as ObjectRow[]).filter(r => r.key !== key)
}
function onNewRowKeydown(e: KeyboardEvent, p: wizardApi.WizardParameter) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addRow(p)
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
  if (p.type === 'objectList') return 'objectRows'
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
    const empty = p.type === 'stringList' || p.type === 'objectList'
      ? (v as unknown[]).length === 0
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
    if (p.type === 'stringList' || p.type === 'objectList') { out[p.name] = v; continue }
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

async function startWizard() {
  if (!validateSetup()) return
  creating.value    = true
  createError.value = null
  try {
    const created = await wizardApi.createRun({ definition: defName, parameters: buildParameters() })
    router.push(`/wizards/runs/${encodeURIComponent(created.name)}`)
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Failed to start the wizard'
  } finally {
    creating.value = false
  }
}

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

        <div class="form-body">

          <template v-for="p in definition.spec.parameters" :key="p.name">
            <div v-if="isVisible(p)" class="form-row" :class="{ 'form-row--top': widgetFor(p) === 'tags' || widgetFor(p) === 'textarea' || widgetFor(p) === 'objectRows' }">
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

                <template v-else-if="widgetFor(p) === 'objectRows'">
                  <div class="entry-add">
                    <input
                      v-model="newRowKey[p.name]"
                      class="fs-input fs-mono"
                      :placeholder="metaFor(p.name).keyPlaceholder"
                      @keydown="onNewRowKeydown($event, p)"
                    />
                    <button class="fs-btn fs-btn--ghost" type="button" @click="addRow(p)">
                      <q-icon name="mdi-plus" size="14px" /> Add
                    </button>
                  </div>
                  <span v-if="newRowKeyError[p.name]" class="field-error">{{ newRowKeyError[p.name] }}</span>

                  <div v-for="row in (fields[p.name] as ObjectRow[])" :key="row.key" class="entry-row">
                    <div class="entry-row__head">
                      <span class="entry-row__file fs-mono">{{ row.key }}</span>
                      <template v-for="rf in (metaFor(p.name).rowFields ?? [])" :key="rf.key">
                        <div v-if="rf.widget === 'select'" class="kind-toggle kind-toggle--sm">
                          <button
                            v-for="o in rf.options" :key="o.value"
                            class="kind-btn" :class="{ 'kind-btn--active': row[rf.key] === o.value }"
                            type="button" @click="row[rf.key] = o.value"
                          >{{ o.label }}</button>
                        </div>
                      </template>
                      <button class="entry-row__remove" type="button" title="Remove" @click="removeRow(p, row.key)">
                        <q-icon name="mdi-close" size="14px" />
                      </button>
                    </div>
                    <template v-for="rf in (metaFor(p.name).rowFields ?? [])" :key="`${rf.key}-sub`">
                      <CronPicker
                        v-if="rf.widget === 'cron' && (!rf.showIf || row[rf.showIf.field] === rf.showIf.equals)"
                        v-model="row[rf.key]"
                      />
                    </template>
                  </div>
                </template>

                <span v-if="fieldErrors[p.name]" class="field-error">{{ fieldErrors[p.name] }}</span>
                <span v-else-if="helpFor(p) && widgetFor(p) !== 'checkbox'" class="field-hint">{{ helpFor(p) }}</span>
              </div>
            </div>
          </template>

          <div v-if="createError" class="inline-msg inline-msg--error">
            <q-icon name="mdi-alert-circle-outline" size="13px" />
            {{ createError }}
          </div>

          <div class="form-actions">
            <button class="fs-btn fs-btn--primary" :disabled="creating" @click="startWizard">
              <q-spinner v-if="creating" size="14px" />
              <template v-else>Create <q-icon name="mdi-arrow-right" size="14px" /></template>
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

/* Form layout */
.form-body { display: flex; flex-direction: column; gap: 16px; padding: 16px 10px 10px; }

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

/* objectRows widget: add-row input + repeatable per-entry rows */
.entry-add { display: flex; gap: 8px; }
.entry-add .fs-input { flex: 1; }
.entry-row {
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px 12px; border: 1px solid var(--fs-border); border-radius: 5px;
  margin-top: 8px;
}
.entry-row__head { display: flex; align-items: center; gap: 10px; }
.entry-row__file { flex: 1; font-size: 12.5px; color: var(--fs-text-primary); }
.entry-row__remove {
  background: none; border: none; cursor: pointer; padding: 2px;
  color: var(--fs-text-muted); display: flex; align-items: center;
  transition: color var(--fs-ease);
}
.entry-row__remove:hover { color: var(--fs-neg, #e57373); }

.kind-toggle { display: flex; border: 1px solid var(--fs-border); border-radius: 4px; overflow: hidden; width: fit-content; }
.kind-toggle--sm .kind-btn { padding: 4px 10px; font-size: 11px; }
.kind-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px; font-size: 12px; font-family: inherit; font-weight: 500;
  cursor: pointer; background: var(--fs-bg-hover); border: none;
  border-right: 1px solid var(--fs-border); color: var(--fs-text-muted);
  transition: background var(--fs-ease), color var(--fs-ease);
}
.kind-btn:last-child { border-right: none; }
.kind-btn:hover { color: var(--fs-text-primary); }
.kind-btn--active { background: var(--fs-accent); color: #fff; }

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
</style>
