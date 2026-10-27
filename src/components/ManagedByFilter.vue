<script setup lang="ts">
import type { ManagedByFilterValue } from '@/utils/managedBy'

// Client-side lists filter on the managed-by label ("Unlabeled" = no label). serverSide lists
// send the value as the shared `source` list parameter instead, which knows "gitops" (applied
// by Flux) but cannot express "no label".
defineProps<{ modelValue: ManagedByFilterValue; serverSide?: boolean }>()
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
    <option v-if="serverSide" value="gitops">GitOps</option>
    <option v-else value="none">Unlabeled</option>
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
