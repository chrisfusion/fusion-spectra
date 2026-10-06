<script setup lang="ts">
import { computed } from 'vue'
import { managedBy } from '@/utils/managedBy'

const props = defineProps<{ meta?: { labels?: Record<string, string> } }>()
const owner = computed(() => managedBy(props.meta))
</script>

<template>
  <span v-if="owner" class="mb-badge" :class="`mb-badge--${owner}`">
    {{ owner }}
    <q-tooltip :delay="400" anchor="top middle">Managed by: {{ owner }}</q-tooltip>
  </span>
  <span v-else class="mb-none">—</span>
</template>

<style scoped>
.mb-badge {
  display: inline-block;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 7px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--fs-text-muted) 14%, transparent);
  color: var(--fs-text-muted);
}
.mb-badge--wizard {
  background: color-mix(in srgb, var(--fs-accent) 14%, transparent);
  color: var(--fs-accent);
}
.mb-none { color: var(--fs-text-muted); }
</style>
