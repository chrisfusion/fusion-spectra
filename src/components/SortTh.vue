<script setup lang="ts">
import { computed } from 'vue'

// Sortable table header cell for useListQuery lists: `current` is the list's sort ("name",
// "-created"). The <th> is the root element, so the parent table's scoped th styles still apply.
const props = defineProps<{ sortKey: string; current: string }>()
defineEmits<{ sort: [] }>()

const active = computed(() => props.current === props.sortKey || props.current === '-' + props.sortKey)
const icon   = computed(() => !active.value ? 'mdi-swap-vertical' : props.current.startsWith('-') ? 'mdi-arrow-down' : 'mdi-arrow-up')
</script>

<template>
  <th class="sort-th" :class="{ 'sort-th--active': active }" @click="$emit('sort')">
    <span class="sort-th__inner">
      <slot />
      <q-icon :name="icon" size="12px" class="sort-th__icon" />
    </span>
  </th>
</template>

<style scoped>
.sort-th { cursor: pointer; user-select: none; white-space: nowrap; }
.sort-th:hover { color: var(--fs-text-primary); }
.sort-th__inner { display: inline-flex; align-items: center; gap: 3px; }
.sort-th__icon { opacity: 0.35; }
.sort-th--active { color: var(--fs-accent); }
.sort-th--active .sort-th__icon { opacity: 1; }
</style>
