<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string[]
  placeholder?: string
  disabled?: boolean
}>(), {
  placeholder: 'Add tag…',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [tags: string[]]
}>()

const inputVal   = ref('')
const inputError = ref<string | null>(null)
const inputEl    = ref<HTMLInputElement | null>(null)

const TAG_RE = /^[a-zA-Z0-9-]+$/

function tryAdd() {
  const val = inputVal.value.trim().replace(/,+$/, '')
  if (!val) return
  if (!TAG_RE.test(val)) {
    inputError.value = 'Alphanumeric and hyphens only'
    return
  }
  if (val.length > 64) {
    inputError.value = 'Max 64 characters'
    return
  }
  if (props.modelValue.includes(val)) {
    inputError.value = 'Already added'
    return
  }
  emit('update:modelValue', [...props.modelValue, val])
  inputVal.value   = ''
  inputError.value = null
}

function removeTag(tag: string) {
  emit('update:modelValue', props.modelValue.filter(t => t !== tag))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    tryAdd()
  } else if (e.key === 'Backspace' && inputVal.value === '') {
    if (props.modelValue.length > 0) {
      emit('update:modelValue', props.modelValue.slice(0, -1))
    }
  } else if (e.key === 'Escape') {
    inputVal.value   = ''
    inputError.value = null
  }
}
</script>

<template>
  <div
    class="tci"
    :class="{ 'tci--disabled': disabled, 'tci--error': !!inputError }"
    @click="inputEl?.focus()"
  >
    <div class="tci__track">
      <span v-for="tag in modelValue" :key="tag" class="tci__chip fs-mono">
        {{ tag }}
        <button
          type="button"
          class="tci__chip-x"
          :disabled="disabled"
          @click.stop="removeTag(tag)"
          title="Remove"
        ><q-icon name="mdi-close" size="10px" /></button>
      </span>
      <input
        ref="inputEl"
        v-model="inputVal"
        class="tci__input"
        :placeholder="modelValue.length === 0 ? placeholder : ''"
        :disabled="disabled"
        @keydown="onKeydown"
      />
    </div>
    <span v-if="inputError" class="tci__error">{{ inputError }}</span>
  </div>
</template>

<style scoped>
.tci {
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  background: var(--fs-bg-input, var(--fs-bg-hover));
  transition: border-color var(--fs-ease);
  cursor: text;
}
.tci:focus-within { border-color: var(--fs-accent); }
.tci--error       { border-color: var(--fs-neg, #e57373); }
.tci--disabled    { opacity: 0.5; pointer-events: none; }

.tci__track {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  min-height: 36px;
}

.tci__chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px 2px 7px;
  border-radius: 3px;
  font-size: 11.5px;
  background: color-mix(in srgb, var(--fs-pos, #4caf50) 15%, transparent);
  color: var(--fs-pos, #4caf50);
  border: 1px solid color-mix(in srgb, var(--fs-pos, #4caf50) 35%, transparent);
  white-space: nowrap;
}

.tci__chip-x {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  display: flex;
  align-items: center;
  opacity: 0.7;
  line-height: 1;
  transition: opacity var(--fs-ease);
}
.tci__chip-x:hover { opacity: 1; }

.tci__input {
  flex: 1;
  min-width: 80px;
  background: none;
  border: none;
  outline: none;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--fs-text-primary);
  padding: 0;
}
.tci__input::placeholder { color: var(--fs-text-muted); font-size: 12px; }

.tci__error {
  display: block;
  font-size: 11px;
  color: var(--fs-neg, #e57373);
  padding: 0 10px 6px;
}
</style>
