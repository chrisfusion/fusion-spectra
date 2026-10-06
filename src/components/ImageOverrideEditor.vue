<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ImageOverride } from '@/api/weaveApi'
import { validateImage } from '@/utils/imagePolicy'
import { useImageOverrideOptions } from '@/composables/useImageOverrideOptions'

interface Row {
  uid:    number
  step:   string
  image:  string
  policy: '' | 'Always' | 'IfNotPresent' | 'Never'
  error:  string | null
}

const props = defineProps<{
  modelValue: ImageOverride[]
  // Steps an override may target (caller filters by kind, e.g. Job-only for triggers).
  steps:      string[]
}>()
const emit = defineEmits<{ 'update:modelValue': [ImageOverride[]] }>()

const { allowedPrefixes } = useImageOverrideOptions()

let _uid = 0
const rows = ref<Row[]>(props.modelValue.map(toRow))

function toRow(o: ImageOverride): Row {
  return { uid: ++_uid, step: o.stepName, image: o.image, policy: o.imagePullPolicy ?? '', error: null }
}

function emitRows() {
  emit('update:modelValue', rows.value
    .filter(r => r.step && r.image.trim())
    .map(r => ({
      stepName: r.step,
      image:    r.image.trim(),
      ...(r.policy ? { imagePullPolicy: r.policy } : {}),
    })))
}

// Dropping rows whose step vanished from the allowed list (chain switched).
watch(() => props.steps, steps => {
  const next = rows.value.filter(r => !r.step || steps.includes(r.step))
  if (next.length !== rows.value.length) { rows.value = next; emitRows() }
})

function addRow() {
  const used = new Set(rows.value.map(r => r.step))
  rows.value = [...rows.value, { uid: ++_uid, step: props.steps.find(s => !used.has(s)) ?? '', image: '', policy: '', error: null }]
}

function removeRow(uid: number) {
  rows.value = rows.value.filter(r => r.uid !== uid)
  emitRows()
}

function update(r: Row, patch: Partial<Row>) {
  rows.value = rows.value.map(x => x.uid === r.uid ? { ...x, ...patch, error: null } : x)
  emitRows()
}

// Validates every row, showing inline errors; returns true when the list is submittable.
function validate(): boolean {
  const seen = new Set<string>()
  let ok = true
  rows.value = rows.value.map(r => {
    let error: string | null = null
    if (!r.step) error = 'Select a step'
    else if (seen.has(r.step)) error = 'Each step may appear only once'
    else error = validateImage(r.image, allowedPrefixes.value)
    seen.add(r.step)
    if (error) ok = false
    return { ...r, error }
  })
  return ok
}

defineExpose({ validate })
</script>

<template>
  <div class="ioe">
    <p v-if="allowedPrefixes !== null && allowedPrefixes.length === 0" class="ioe-error">
      Image overrides are disabled on this cluster (no allowed image prefixes configured).
    </p>
    <p v-else-if="allowedPrefixes?.length" class="ioe-hint">
      Allowed prefixes: <code v-for="p in allowedPrefixes" :key="p" class="ioe-code">{{ p }}</code>
      — images need an explicit tag (not <code class="ioe-code">latest</code>) or a digest.
    </p>

    <div v-for="r in rows" :key="r.uid" class="ioe-row">
      <select class="ioe-input ioe-step" :value="r.step" @change="update(r, { step: ($event.target as HTMLSelectElement).value })">
        <option value="" disabled>Step…</option>
        <option v-for="s in steps" :key="s" :value="s">{{ s }}</option>
      </select>
      <input
        class="ioe-input ioe-image"
        :value="r.image"
        placeholder="registry/name:1.2.3"
        @input="update(r, { image: ($event.target as HTMLInputElement).value })"
      />
      <select class="ioe-input ioe-policy" :value="r.policy" @change="update(r, { policy: ($event.target as HTMLSelectElement).value as Row['policy'] })">
        <option value="">Pull policy: default</option>
        <option value="IfNotPresent">IfNotPresent</option>
        <option value="Always">Always</option>
        <option value="Never">Never</option>
      </select>
      <button type="button" class="ioe-remove" title="Remove" @click="removeRow(r.uid)">
        <q-icon name="mdi-close" size="14px" />
      </button>
      <p v-if="r.error" class="ioe-error ioe-row-error">{{ r.error }}</p>
    </div>

    <button type="button" class="ioe-add" :disabled="steps.length === 0" @click="addRow">
      <q-icon name="mdi-plus" size="14px" /> Add image override
    </button>
  </div>
</template>

<style scoped>
.ioe { display: flex; flex-direction: column; gap: 8px; }
.ioe-row {
  display: grid;
  grid-template-columns: 150px 1fr 170px 28px;
  gap: 6px;
  align-items: center;
}
.ioe-input {
  background: var(--fs-bg-surface);
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  color: var(--fs-text-primary);
  font-size: 13px;
  padding: 6px 8px;
  min-width: 0;
  outline: none;
  font-family: inherit;
}
.ioe-input:focus { border-color: var(--fs-accent); }
.ioe-image { font-family: var(--fs-font-mono); font-size: 12px; }
.ioe-remove {
  background: transparent;
  border: none;
  color: var(--fs-text-muted);
  cursor: pointer;
}
.ioe-remove:hover { color: var(--fs-neg, #e57373); }
.ioe-add {
  align-self: flex-start;
  background: transparent;
  border: 1px dashed var(--fs-border);
  border-radius: 4px;
  color: var(--fs-text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 5px 10px;
  font-family: inherit;
}
.ioe-add:hover:not(:disabled) { color: var(--fs-accent); border-color: var(--fs-accent); }
.ioe-add:disabled { opacity: 0.4; cursor: not-allowed; }
.ioe-hint, .ioe-error { font-size: 11.5px; margin: 0; line-height: 1.5; }
.ioe-hint { color: var(--fs-text-muted); }
.ioe-error { color: var(--fs-neg, #e57373); }
.ioe-row-error { grid-column: 1 / -1; }
.ioe-code {
  font-family: var(--fs-font-mono);
  font-size: 11px;
  background: color-mix(in srgb, var(--fs-accent) 10%, transparent);
  color: var(--fs-accent);
  padding: 1px 5px;
  border-radius: 3px;
  margin-right: 4px;
}
</style>
