<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import LogViewer from '@/components/LogViewer.vue'
import LogDialog from '@/components/LogDialog.vue'
import ListPager from '@/components/ListPager.vue'
import { useContinuePager } from '@/composables/useContinuePager'
import * as monitorApi from '@/api/weaveMonitorApi'
import type { LogSnapshot } from '@/api/weaveMonitorApi'
import { formatDurationMs } from '@/utils/format'

// Logs of one WeaveApp: service = live pod log inline, job = one log per execution (dialog).
// Shared by WizardRunLogsPanel and WeaveAppDetailPage; never links into Weave pages.
// Job executions come filtered and paged from GET /apps/{name}/executions, reloaded whenever the
// parent passes a fresh app object (its poll).

const props = defineProps<{ app: monitorApi.WeaveApp }>()

const EXEC_PHASES: monitorApi.AppExecutionPhase[] = ['Running', 'Succeeded', 'Failed']

const executions   = ref<monitorApi.WeaveAppExecution[]>([])
const execPhase    = ref<'' | monitorApi.AppExecutionPhase>('')
const execEntry    = ref('')
const execError    = ref<string | null>(null)
const entrypoints  = computed(() => (props.app.spec.entrypoints ?? []).map(e => e.name))
let   execSeq      = 0

const paging = useContinuePager(20, loadExecutions)

async function loadExecutions() {
  if (props.app.spec.type !== 'job') return
  const seq = ++execSeq
  try {
    const page = await monitorApi.listAppExecutions(props.app.metadata.name, {
      phase:      execPhase.value ? [execPhase.value] : undefined,
      entrypoint: execEntry.value ? [execEntry.value] : undefined,
      limit:      20,
      continue:   paging.token.value,
    })
    if (seq !== execSeq) return
    executions.value = page.items ?? []
    execError.value  = null
    paging.setPage({ count: executions.value.length, continue: page.metadata?.continue, remaining: page.metadata?.remainingItemCount })
  } catch (e) {
    if (seq === execSeq) execError.value = e instanceof Error ? e.message : 'Failed to load executions'
  }
}

watch(() => props.app, loadExecutions, { immediate: true })
watch([execPhase, execEntry], () => { paging.reset(); loadExecutions() })

// Stable per app name — LogViewer reloads whenever its fetchLogs prop changes, and every poll
// replaces the app object.
const appName        = computed(() => props.app.metadata.name)
const serviceFetcher = computed(() => {
  const name = appName.value
  return ({ setup }: { setup: boolean }) => monitorApi.getAppLogs(name, { setup })
})

const dialogOpen  = ref(false)
const dialogTitle = ref('')
const dialogFetch = ref<(o: { setup: boolean }) => Promise<LogSnapshot>>(() => Promise.resolve({ lines: [], podName: '' }))

function openExecutionLogs(exec: monitorApi.WeaveAppExecution) {
  const name = appName.value
  dialogTitle.value = `${exec.entrypoint} · ${formatDate(exec.startTime)}`
  dialogFetch.value = ({ setup }) => monitorApi.getAppLogs(name, { execution: exec.jobName, setup })
  dialogOpen.value  = true
}

function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '—'
}

function duration(start?: string | null, end?: string | null): string {
  if (!start) return '—'
  return formatDurationMs((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime())
}
</script>

<template>
  <div>
    <p v-if="app.status?.validationMessage" class="logs-note logs-note--error">{{ app.status.validationMessage }}</p>

    <div v-if="app.spec.type === 'service'" class="logs-inline">
      <LogViewer :title="appName" :fetch-logs="serviceFetcher" :setup-toggle="true" />
    </div>

    <template v-else>
      <div class="exec-filters">
        <select v-model="execPhase" class="exec-select" title="Filter by status">
          <option value="">All statuses</option>
          <option v-for="p in EXEC_PHASES" :key="p" :value="p">{{ p }}</option>
        </select>
        <select v-if="entrypoints.length > 1" v-model="execEntry" class="exec-select" title="Filter by entrypoint">
          <option value="">All entrypoints</option>
          <option v-for="e in entrypoints" :key="e" :value="e">{{ e }}</option>
        </select>
      </div>
      <p v-if="execError" class="logs-note logs-note--error">{{ execError }}</p>
      <table class="logs-table">
        <thead>
          <tr><th>Entrypoint</th><th>Status</th><th>Started</th><th>Duration</th><th>Message</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="ex in executions" :key="ex.jobName">
            <td class="fs-mono">{{ ex.entrypoint }}</td>
            <td><span class="state-badge" :class="`state-badge--${ex.phase.toLowerCase()}`">{{ ex.phase }}</span></td>
            <td>{{ formatDate(ex.startTime) }}</td>
            <td class="fs-mono">{{ duration(ex.startTime, ex.completionTime) }}</td>
            <td class="logs-table__msg" :title="ex.message">{{ ex.message || '—' }}</td>
            <td class="logs-table__actions">
              <button class="fs-btn fs-btn--ghost fs-btn--sm" @click="openExecutionLogs(ex)">
                <q-icon name="mdi-text-box-outline" size="13px" /> Logs
              </button>
            </td>
          </tr>
          <tr v-if="!executions.length">
            <td colspan="6" class="logs-table__empty">
              <template v-if="execPhase || execEntry">No executions match these filters.</template>
              <template v-else>No executions yet — scheduled entrypoints show up here once they fire.</template>
            </td>
          </tr>
        </tbody>
      </table>
      <ListPager v-bind="paging.pager.value" noun="executions" @prev="paging.prevPage" @next="paging.nextPage" />
      <p class="logs-note">Logs of finished executions are kept for 24 hours; the result stays listed.</p>
    </template>

    <LogDialog v-model="dialogOpen" :title="dialogTitle" :fetch-logs="dialogFetch" :setup-toggle="true" />
  </div>
</template>

<style scoped>
.logs-inline {
  border: 1px solid var(--fs-border);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 8px;
}

.logs-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.logs-table thead th {
  text-align: left; padding: 6px 8px; font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.logs-table td { padding: 6px 8px; border-bottom: 1px solid var(--fs-border); color: var(--fs-text-primary); }
.logs-table__msg { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fs-text-muted); }
.logs-table__actions { display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; }
.logs-table__empty { text-align: center; color: var(--fs-text-muted); padding: 16px 8px; }

.exec-filters { display: flex; gap: 8px; padding-bottom: 8px; }
.exec-select {
  background: var(--fs-bg-surface); border: 1px solid var(--fs-border); border-radius: 4px;
  color: var(--fs-text-primary); font-size: 12px; padding: 4px 8px; font-family: inherit; cursor: pointer;
}

.logs-note { margin: 6px 2px 8px; font-size: 11.5px; color: var(--fs-text-muted); }
.logs-note--error { color: var(--fs-neg, #e57373); }

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
.fs-btn--sm { padding: 4px 9px; font-size: 11.5px; }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.fs-btn--ghost:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
</style>
