<script setup lang="ts">
import type { ManagedByFilterValue } from '@/utils/managedBy'

defineProps<{ modelValue: ManagedByFilterValue }>()
defineEmits<{ 'update:modelValue': [ManagedByFilterValue] }>()
</script>

<template>
  <select
    class="mb-filter"
    :value="modelValue"
    title="Filter by owner"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value as ManagedByFilterValue)"
  >
    <option value="">All owners</option>
    <option value="manual">Manual</option>
    <option value="wizard">Wizard</option>
    <option value="none">Unlabeled</option>
  </select>
</template>

<style scoped>
.mb-filter {
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
