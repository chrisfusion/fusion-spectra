<script setup lang="ts">
import { TIME_WINDOWS } from '@/utils/listQuery'

// "since" filter of the shared list parameters — a duration back from now.
defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <select
    class="tw-select"
    :value="modelValue"
    title="Time window"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-for="w in TIME_WINDOWS" :key="w.value" :value="w.value">{{ w.label }}</option>
  </select>
</template>

<style scoped>
.tw-select {
  background: var(--fs-bg-surface);
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  color: var(--fs-text-primary);
  font-size: 12.5px;
  padding: 6px 8px;
  font-family: inherit;
  cursor: pointer;
}
</style>
