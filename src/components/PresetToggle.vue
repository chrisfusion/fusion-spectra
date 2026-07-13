<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: 'manual' | 'preset'
  disabled?:  boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: 'manual' | 'preset']
}>()
</script>

<template>
  <label class="toggle-wrap">
    <input
      :checked="props.modelValue === 'preset'"
      type="checkbox"
      class="toggle-input"
      :disabled="props.disabled"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked ? 'preset' : 'manual')"
    />
    <span class="toggle-track"><span class="toggle-thumb" /></span>
    <span class="toggle-label">{{ props.modelValue === 'preset' ? 'Preset' : 'Manual' }}</span>
  </label>
</template>

<style scoped>
.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  width: fit-content;
}
.toggle-input { display: none; }
.toggle-track {
  position: relative;
  width: 30px;
  height: 16px;
  border-radius: 8px;
  background: var(--fs-border);
  border: 1px solid var(--fs-border);
  transition: background var(--fs-ease), border-color var(--fs-ease);
  flex-shrink: 0;
}
.toggle-input:checked ~ .toggle-track { background: var(--fs-accent); border-color: var(--fs-accent); }
.toggle-thumb {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  transition: transform var(--fs-ease);
}
.toggle-input:checked ~ .toggle-track .toggle-thumb { transform: translateX(14px); }
.toggle-label { font-size: 11px; color: var(--fs-text-muted); }
</style>
