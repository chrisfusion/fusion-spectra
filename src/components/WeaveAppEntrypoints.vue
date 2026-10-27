<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import * as monitorApi from '@/api/weaveMonitorApi'
import { usePermission } from '@/composables/usePermission'
import { describeCron } from '@/utils/cron'

// The entrypoints of a job WeaveApp: schedule in words, last execution, Run now. Shared by the
// expert app page and the wizard run page (Simple mode) — Run now needs only weave:apps:fire.

const props = defineProps<{ app: monitorApi.WeaveApp }>()
// Emitted ~2s after a fire so the parent reloads once the operator has started the execution.
const emit  = defineEmits<{ fired: [] }>()

const $q      = useQuasar()
const { can } = usePermission()
const firing  = ref<Set<string>>(new Set())

function lastExecution(entrypoint: string): monitorApi.WeaveAppExecution | undefined {
  return (props.app.status?.executions ?? []).find(e => e.entrypoint === entrypoint)   // newest first
}

function isRunning(entrypoint: string): boolean {
  return lastExecution(entrypoint)?.phase === 'Running'
}

function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '—'
}

async function runNow(entrypoint: string) {
  const name = props.app.metadata.name
  firing.value = new Set([...firing.value, entrypoint])
  try {
    await monitorApi.fireAppEntrypoint(name, entrypoint)
    $q.notify({ type: 'positive', message: `${entrypoint} started — the execution shows up below shortly` })
    setTimeout(() => emit('fired'), 2000)
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Run failed' })
  } finally {
    firing.value = new Set([...firing.value].filter(n => n !== entrypoint))
  }
}
</script>

<template>
  <table class="ep-table">
    <thead>
      <tr><th>Entrypoint</th><th>Schedule</th><th>Last run</th><th></th></tr>
    </thead>
    <tbody>
      <tr v-for="ep in app.spec.entrypoints ?? []" :key="ep.name">
        <td class="ep-table__name fs-mono">{{ ep.name }}</td>
        <td>
          <template v-if="ep.schedule">
            {{ describeCron(ep.schedule) }}
            <div class="ep-table__cron fs-mono">{{ ep.schedule }}</div>
          </template>
          <span v-else class="ep-table__muted">On demand</span>
        </td>
        <td>
          <template v-if="lastExecution(ep.name)">
            <span class="state-badge" :class="`state-badge--${lastExecution(ep.name)!.phase.toLowerCase()}`">{{ lastExecution(ep.name)!.phase }}</span>
            <div class="ep-table__muted">{{ formatDate(lastExecution(ep.name)!.startTime) }}</div>
          </template>
          <span v-else class="ep-table__muted">Never</span>
        </td>
        <td class="ep-table__actions">
          <button
            v-if="can('weave:apps:fire')"
            class="fs-btn fs-btn--ghost fs-btn--sm"
            :disabled="firing.has(ep.name) || isRunning(ep.name)"
            :title="isRunning(ep.name) ? 'An execution of this entrypoint is still running' : ''"
            @click="runNow(ep.name)"
          >
            <q-spinner v-if="firing.has(ep.name)" size="12px" />
            <q-icon v-else name="mdi-play" size="13px" />
            Run now
          </button>
        </td>
      </tr>
      <tr v-if="!(app.spec.entrypoints ?? []).length">
        <td colspan="4" class="ep-table__empty">No entrypoints.</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.ep-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 8px; }
.ep-table thead th {
  text-align: left; padding: 6px 8px; font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.ep-table td { padding: 7px 8px; border-bottom: 1px solid var(--fs-border); color: var(--fs-text-primary); vertical-align: middle; }
.ep-table tbody tr:last-child td { border-bottom: none; }
.ep-table__name    { font-weight: 500; color: var(--fs-accent); }
.ep-table__cron    { font-size: 11px; color: var(--fs-text-muted); margin-top: 2px; }
.ep-table__muted   { font-size: 11.5px; color: var(--fs-text-muted); margin-top: 2px; }
.ep-table__actions { text-align: right; white-space: nowrap; }
.ep-table__empty   { text-align: center; color: var(--fs-text-muted); padding: 16px 8px; }

.state-badge {
  display: inline-flex; width: fit-content; padding: 2px 8px; border-radius: 10px;
  font-size: 11px; font-weight: 600;
  color: var(--fs-text-muted); background: color-mix(in srgb, var(--fs-text-muted) 10%, transparent);
}
.state-badge--running   { color: var(--fs-accent); background: color-mix(in srgb, var(--fs-accent) 10%, transparent); }
.state-badge--succeeded { color: var(--fs-pos, #4caf50); background: color-mix(in srgb, var(--fs-pos, #4caf50) 10%, transparent); }
.state-badge--failed    { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

.fs-mono { font-family: var(--fs-font-mono); }
.fs-btn {
  display: inline-flex; align-items: center; gap: 5px; border-radius: 4px;
  font-family: inherit; font-weight: 500; cursor: pointer; border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease);
}
.fs-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fs-btn--sm { padding: 4px 9px; font-size: 11.5px; }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.fs-btn--ghost:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
</style>
