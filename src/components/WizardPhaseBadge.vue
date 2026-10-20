<script setup lang="ts">
import { RUN_PHASE_LABEL, type RunPhase } from '@/api/wizardApi'

defineProps<{ phase?: RunPhase }>()
</script>

<template>
  <span class="phase-badge" :class="`phase-badge--${phase?.toLowerCase()}`">
    {{ phase ? RUN_PHASE_LABEL[phase] ?? phase : 'Unknown' }}
  </span>
</template>

<style scoped>
.phase-badge {
  display: inline-flex; align-items: center; gap: 4px; width: fit-content;
  padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
}
.phase-badge--pending        { color: var(--fs-text-muted); background: color-mix(in srgb, var(--fs-text-muted) 10%, transparent); }
.phase-badge--running        { color: var(--fs-accent);     background: color-mix(in srgb, var(--fs-accent) 10%, transparent); }
.phase-badge--ready          { color: var(--fs-pos, #4caf50); background: color-mix(in srgb, var(--fs-pos, #4caf50) 10%, transparent); }
.phase-badge--failed         { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }
.phase-badge--rollingback    { color: var(--fs-warn, #ffa726); background: color-mix(in srgb, var(--fs-warn, #ffa726) 10%, transparent); }
.phase-badge--rolledback     { color: var(--fs-text-muted); background: color-mix(in srgb, var(--fs-text-muted) 10%, transparent); }
.phase-badge--rollbackfailed { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }
</style>
