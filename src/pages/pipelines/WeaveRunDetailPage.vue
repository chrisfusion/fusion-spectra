<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as monitorApi from '@/api/weaveMonitorApi'
import { formatDurationMs } from '@/utils/format'

const route  = useRoute()
const router = useRouter()

const runName = route.params.name as string

// ─── State ────────────────────────────────────────────────────────────────────

const detail  = ref<monitorApi.RunDetail | null>(null)
const loading = ref(false)
const error   = ref<string | null>(null)

// step detail dialog
const selectedStep   = ref<monitorApi.RunStepStatus | null>(null)
const stepDialogOpen = ref(false)

function openStepDialog(step: monitorApi.RunStepStatus) {
  selectedStep.value   = step
  stepDialogOpen.value = true
}

function stepKindLabel(step: monitorApi.RunStepStatus): string {
  if (step.deploymentRef?.name) return 'Service'
  if (step.jobRef?.name)        return 'Job'
  return '—'
}

// log dialog
const logDialogOpen = ref(false)
const logStepName   = ref('')
const logLines      = ref<string[]>([])
const logLoading    = ref(false)
const logError      = ref<string | null>(null)
const logPodName    = ref<string>('')

// ─── Derived ──────────────────────────────────────────────────────────────────

const run    = computed(() => detail.value?.run)
const status = computed(() => run.value?.status)
const steps  = computed(() => status.value?.steps ?? [])
const events = computed(() =>
  (detail.value?.events ?? []).slice().sort((a, b) => {
    const ta = a.lastTimestamp ?? a.firstTimestamp ?? ''
    const tb = b.lastTimestamp ?? b.firstTimestamp ?? ''
    return tb.localeCompare(ta)
  })
)

function isTerminal(phase: monitorApi.RunPhase | undefined): boolean {
  return phase === 'Succeeded' || phase === 'Failed' || phase === 'Stopped'
}

// ─── Polling ──────────────────────────────────────────────────────────────────

const autoRefresh = ref(true)
let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    await loadRun()
    if (isTerminal(status.value?.phase)) stopPolling()
  }, 10_000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function toggleAutoRefresh() {
  if (autoRefresh.value) {
    stopPolling()
    autoRefresh.value = false
  } else {
    startPolling()
    autoRefresh.value = true
  }
}

onUnmounted(stopPolling)

// ─── Loaders ──────────────────────────────────────────────────────────────────

async function loadRun() {
  loading.value = true
  error.value   = null
  try {
    detail.value = await monitorApi.getRun(runName)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load run'
  } finally {
    loading.value = false
  }
}

async function openLogDialog(stepName: string) {
  logStepName.value   = stepName
  logLines.value      = []
  logError.value      = null
  logPodName.value    = ''
  logDialogOpen.value = true
  logLoading.value    = true
  try {
    const resp = await monitorApi.getStepLogs(runName, stepName)
    logLines.value   = resp.lines
    logPodName.value = resp.podName
  } catch (e) {
    logError.value = e instanceof Error ? e.message : 'Failed to load logs'
  } finally {
    logLoading.value = false
  }
}

onMounted(async () => {
  await loadRun()
  if (!isTerminal(status.value?.phase)) startPolling()
})

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function stepDuration(step: monitorApi.RunStepStatus): string {
  if (!step.startTime) return '—'
  const end = step.completionTime ? new Date(step.completionTime) : new Date()
  const ms  = end.getTime() - new Date(step.startTime).getTime()
  return formatDurationMs(ms)
}

function runDuration(): string {
  if (!status.value?.startTime) return '—'
  const end = status.value.completionTime ? new Date(status.value.completionTime) : new Date()
  const ms  = end.getTime() - new Date(status.value.startTime).getTime()
  return formatDurationMs(ms)
}
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/pipelines/runs')">
        ← Run History
      </button>
      <span class="breadcrumb__sep">/</span>
      <span class="breadcrumb__current fs-mono">{{ runName }}</span>
    </div>

    <!-- Run Info panel -->
    <CanvasPanel
      title="Run Info"
      icon="mdi-information-outline"
      :loading="loading && !detail"
      :error="error ?? undefined"
      @refresh="loadRun"
    >
      <template #actions>
        <button
          class="icon-btn"
          :class="{ 'icon-btn--active': autoRefresh }"
          :title="autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'"
          @click="toggleAutoRefresh"
        >
          <q-icon :name="autoRefresh ? 'mdi-pause-circle-outline' : 'mdi-play-circle-outline'" size="16px" />
          <q-tooltip>{{ autoRefresh ? 'Pause' : 'Resume' }} auto-refresh (10s)</q-tooltip>
        </button>
      </template>

      <div v-if="run" class="meta-grid">
        <div class="meta-row">
          <span class="meta-label">Name</span>
          <span class="meta-value fs-mono">{{ run.metadata.name }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Namespace</span>
          <span class="meta-value fs-mono">{{ run.metadata.namespace ?? '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Phase</span>
          <span class="phase-badge" :class="`phase-badge--${(status?.phase ?? 'pending').toLowerCase()}`">
            {{ status?.phase ?? '—' }}
          </span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Chain</span>
          <span class="meta-value fs-mono">{{ run.spec.chainRef.name }}</span>
        </div>
        <div class="meta-row" v-if="run.spec.triggerRef?.name">
          <span class="meta-label">Trigger</span>
          <span class="meta-value fs-mono">{{ run.spec.triggerRef.name }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Steps</span>
          <span class="meta-value fs-mono">{{ steps.length }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Created</span>
          <span class="meta-value">{{ formatDate(run.metadata.creationTimestamp) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Started</span>
          <span class="meta-value">{{ formatDate(status?.startTime) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Completed</span>
          <span class="meta-value">{{ formatDate(status?.completionTime) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Duration</span>
          <span class="meta-value fs-mono">{{ runDuration() }}</span>
        </div>
        <div class="meta-row" v-if="status?.sharedPVCName">
          <span class="meta-label">Shared PVC</span>
          <span class="meta-value fs-mono">{{ status.sharedPVCName }}</span>
        </div>
        <div class="meta-row" v-if="status?.message">
          <span class="meta-label">Message</span>
          <span class="meta-value meta-value--message">{{ status.message }}</span>
        </div>
        <div v-if="run.spec.parameterOverrides?.length" class="meta-row meta-row--top">
          <span class="meta-label">Params</span>
          <div class="param-list">
            <span v-for="p in run.spec.parameterOverrides" :key="p.name" class="param-chip">
              <span class="param-key">{{ p.name }}</span>=<span class="param-val">{{ p.value }}</span>
            </span>
          </div>
        </div>
        <div class="meta-row" v-if="run.metadata.uid">
          <span class="meta-label">UID</span>
          <span class="meta-value fs-mono meta-value--uid">{{ run.metadata.uid }}</span>
        </div>
      </div>
    </CanvasPanel>

    <!-- Events panel -->
    <CanvasPanel
      title="Events"
      icon="mdi-bell-outline"
      :loading="loading && !detail"
      :error="error ?? undefined"
      @refresh="loadRun"
    >
      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Reason</th>
              <th>Message</th>
              <th>Count</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(ev, i) in events" :key="i">
              <td>
                <span class="ev-type-badge" :class="ev.type === 'Warning' ? 'ev-type-badge--warn' : 'ev-type-badge--normal'">
                  {{ ev.type }}
                </span>
              </td>
              <td class="col-reason fs-mono">{{ ev.reason }}</td>
              <td class="col-message" :title="ev.message">{{ ev.message }}</td>
              <td class="col-num">{{ ev.count }}</td>
              <td class="col-muted">{{ formatDate(ev.lastTimestamp ?? ev.firstTimestamp) }}</td>
            </tr>
            <tr v-if="!loading && events.length === 0">
              <td colspan="5" class="empty-row">No events.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </CanvasPanel>

    <!-- Steps panel -->
    <CanvasPanel
      title="Steps"
      icon="mdi-stairs"
      :wide="true"
      :loading="loading && !detail"
      :error="error ?? undefined"
      @refresh="loadRun"
    >
      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Phase</th>
              <th>Duration</th>
              <th>Retries</th>
              <th>Job / Deployment</th>
              <th>Message</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="step in steps" :key="step.name" class="clickable-row" @click="openStepDialog(step)">
              <td class="col-name fs-mono">{{ step.name }}</td>
              <td>
                <span class="phase-badge" :class="`phase-badge--${step.phase.toLowerCase()}`">
                  {{ step.phase }}
                </span>
              </td>
              <td class="col-dur fs-mono">{{ stepDuration(step) }}</td>
              <td class="col-num">
                <span v-if="step.retryCount" class="retry-badge">{{ step.retryCount }}</span>
                <span v-else class="col-muted">—</span>
              </td>
              <td class="col-ref fs-mono">
                <span v-if="step.jobRef?.name" class="ref-chip">
                  <q-icon name="mdi-briefcase-outline" size="11px" />
                  {{ step.jobRef.name }}
                </span>
                <span v-else-if="step.deploymentRef?.name" class="ref-chip ref-chip--deploy">
                  <q-icon name="mdi-server-outline" size="11px" />
                  {{ step.deploymentRef.name }}
                </span>
                <span v-else class="col-muted">—</span>
              </td>
              <td class="col-message" :title="step.message">{{ step.message || '—' }}</td>
              <td class="col-actions" @click.stop>
                <button
                  class="icon-btn"
                  title="View logs"
                  @click="openLogDialog(step.name)"
                >
                  <q-icon name="mdi-text-box-outline" size="15px" />
                  <q-tooltip>View logs</q-tooltip>
                </button>
              </td>
            </tr>

            <tr v-if="!loading && steps.length === 0">
              <td colspan="7" class="empty-row">No steps yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </CanvasPanel>

  </div>

  <!-- Log dialog -->
  <q-dialog v-model="logDialogOpen" :maximized="false">
    <q-card class="log-dialog">
      <q-card-section class="log-dialog__header">
        <div class="log-dialog__title">
          <q-icon name="mdi-text-box-outline" size="15px" />
          <span class="fs-mono">{{ logStepName }}</span>
          <span v-if="logPodName" class="log-dialog__pod fs-mono">— {{ logPodName }}</span>
        </div>
        <q-btn flat round dense icon="mdi-close" @click="logDialogOpen = false" />
      </q-card-section>

      <q-separator />

      <q-card-section class="log-dialog__body">
        <div v-if="logLoading" class="log-dlg-loading">
          <q-spinner size="14px" />
          <span>Loading logs…</span>
        </div>
        <p v-else-if="logError" class="log-dlg-error">{{ logError }}</p>
        <pre v-else-if="logLines.length" class="log-dlg-pre">{{ logLines.join('\n') }}</pre>
        <p v-else class="log-dlg-empty">EOF — No LOG available at moment or yet</p>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- Step detail dialog -->
  <q-dialog v-model="stepDialogOpen">
    <q-card class="step-dialog" v-if="selectedStep">
      <q-card-section class="step-dialog__header">
        <div class="step-dialog__title">
          <q-icon name="mdi-stairs" size="16px" />
          <span class="fs-mono">{{ selectedStep.name }}</span>
        </div>
        <q-btn flat round dense icon="mdi-close" @click="stepDialogOpen = false" />
      </q-card-section>

      <q-separator />

      <q-card-section class="step-dialog__body">
        <div class="sdl-grid">

          <div class="sdl-row">
            <span class="sdl-label">Phase</span>
            <span class="phase-badge" :class="`phase-badge--${selectedStep.phase.toLowerCase()}`">
              {{ selectedStep.phase }}
            </span>
          </div>

          <div class="sdl-row">
            <span class="sdl-label">Kind</span>
            <span class="sdl-value">{{ stepKindLabel(selectedStep) }}</span>
          </div>

          <div class="sdl-row" v-if="selectedStep.jobRef?.name">
            <span class="sdl-label">Job</span>
            <span class="sdl-value fs-mono ref-chip">
              <q-icon name="mdi-briefcase-outline" size="11px" />
              {{ selectedStep.jobRef.name }}
            </span>
          </div>

          <div class="sdl-row" v-if="selectedStep.deploymentRef?.name">
            <span class="sdl-label">Deployment</span>
            <span class="sdl-value fs-mono ref-chip ref-chip--deploy">
              <q-icon name="mdi-server-outline" size="11px" />
              {{ selectedStep.deploymentRef.name }}
            </span>
          </div>

          <div class="sdl-row">
            <span class="sdl-label">Started</span>
            <span class="sdl-value">{{ formatDate(selectedStep.startTime) }}</span>
          </div>

          <div class="sdl-row">
            <span class="sdl-label">Completed</span>
            <span class="sdl-value">{{ formatDate(selectedStep.completionTime) }}</span>
          </div>

          <div class="sdl-row">
            <span class="sdl-label">Duration</span>
            <span class="sdl-value fs-mono">{{ stepDuration(selectedStep) }}</span>
          </div>

          <div class="sdl-row">
            <span class="sdl-label">Retries</span>
            <span class="sdl-value fs-mono">
              <span v-if="selectedStep.retryCount" class="retry-badge">{{ selectedStep.retryCount }}</span>
              <span v-else class="sdl-muted">0</span>
            </span>
          </div>

          <div class="sdl-row" v-if="selectedStep.nextRetryAfter">
            <span class="sdl-label">Next Retry</span>
            <span class="sdl-value">{{ formatDate(selectedStep.nextRetryAfter) }}</span>
          </div>

          <div class="sdl-row" v-if="selectedStep.jobRef?.name">
            <span class="sdl-label">Output</span>
            <span class="sdl-value">
              <span v-if="selectedStep.outputCaptured" class="output-badge output-badge--yes">
                <q-icon name="mdi-check-circle-outline" size="12px" /> Captured
              </span>
              <span v-else class="sdl-muted">Not captured</span>
            </span>
          </div>

          <div class="sdl-row sdl-row--top" v-if="selectedStep.message">
            <span class="sdl-label">Message</span>
            <span class="sdl-value sdl-value--message">{{ selectedStep.message }}</span>
          </div>

        </div>
      </q-card-section>
    </q-card>
  </q-dialog>

</template>

<style scoped>
.page-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 16px;
  align-content: start;
}

/* ─── Breadcrumb ────────────────────────────────────────────────────────────── */

.breadcrumb {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--fs-text-muted);
  padding-bottom: 2px;
}
.breadcrumb__back {
  background: none;
  border: none;
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 12px;
  color: var(--fs-accent);
  font-family: inherit;
  transition: background var(--fs-ease);
}
.breadcrumb__back:hover { background: var(--fs-bg-hover); }
.breadcrumb__sep { color: var(--fs-border-bright); }
.breadcrumb__current { color: var(--fs-text-primary); font-size: 12.5px; }

/* ─── Meta grid ─────────────────────────────────────────────────────────────── */

.meta-grid { display: flex; flex-direction: column; }

.meta-row {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 8px;
  align-items: baseline;
  padding: 7px 0;
  border-bottom: 1px solid var(--fs-border);
}
.meta-row:last-child { border-bottom: none; }
.meta-row--top { align-items: start; }

.meta-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
}
.meta-value {
  font-size: 12.5px;
  color: var(--fs-text-primary);
}
.meta-value--message {
  color: var(--fs-text-muted);
  font-size: 12px;
  word-break: break-word;
}
.meta-value--uid {
  font-size: 11px;
  color: var(--fs-text-muted);
}

.param-list { display: flex; flex-wrap: wrap; gap: 4px; }
.param-chip {
  font-family: var(--fs-font-mono);
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--fs-bg-hover);
  border: 1px solid var(--fs-border);
  color: var(--fs-text-secondary);
}
.param-key { color: var(--fs-accent); }
.param-val { color: var(--fs-text-primary); }

/* ─── Table ─────────────────────────────────────────────────────────────────── */

.table-wrap { overflow-x: auto; }

.tpl-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.tpl-table th {
  text-align: left;
  padding: 6px 10px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.tpl-table td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--fs-border);
  color: var(--fs-text-primary);
  vertical-align: middle;
}
.tpl-table tbody tr:last-child td { border-bottom: none; }
.tpl-table tbody tr:hover td { background: var(--fs-bg-hover); }

.col-name    { font-weight: 500; color: var(--fs-accent); }
.col-dur     { color: var(--fs-text-secondary); font-size: 12px; }
.col-num     { color: var(--fs-text-muted); text-align: center; }
.col-muted   { color: var(--fs-text-muted); font-size: 12px; }
.col-reason  { font-size: 12px; color: var(--fs-text-secondary); }
.col-ref     { font-size: 11px; }
.col-message {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fs-text-muted);
  font-size: 12px;
  cursor: default;
}
.col-actions { width: 40px; text-align: center; }

.empty-row {
  text-align: center;
  color: var(--fs-text-muted);
  padding: 28px 10px !important;
}

/* ─── Phase badges ──────────────────────────────────────────────────────────── */

.phase-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.phase-badge--running   { color: var(--fs-warn, #ff9800); background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent); }
.phase-badge--pending   { color: var(--fs-accent);        background: color-mix(in srgb, var(--fs-accent)        12%, transparent); }
.phase-badge--succeeded { color: var(--fs-pos, #4caf50);  background: color-mix(in srgb, var(--fs-pos, #4caf50)  12%, transparent); }
.phase-badge--failed    { color: var(--fs-neg, #e57373);  background: color-mix(in srgb, var(--fs-neg, #e57373)  12%, transparent); }
.phase-badge--stopped   { color: var(--fs-text-muted);    background: color-mix(in srgb, var(--fs-text-muted)    12%, transparent); }
.phase-badge--skipped   { color: var(--fs-text-muted);    background: color-mix(in srgb, var(--fs-text-muted)    12%, transparent); }
.phase-badge--retrying  { color: var(--fs-warn, #ff9800); background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent); }

/* ─── Event type badges ─────────────────────────────────────────────────────── */

.ev-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10.5px;
  font-weight: 600;
}
.ev-type-badge--normal { color: var(--fs-text-muted);   background: color-mix(in srgb, var(--fs-text-muted)   10%, transparent); }
.ev-type-badge--warn   { color: var(--fs-warn, #ff9800); background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent); }

/* ─── Ref chips ─────────────────────────────────────────────────────────────── */

.ref-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--fs-bg-hover);
  border: 1px solid var(--fs-border);
  color: var(--fs-text-secondary);
  font-size: 11px;
}
.ref-chip--deploy { color: var(--fs-pos, #4caf50); border-color: color-mix(in srgb, var(--fs-pos, #4caf50) 30%, transparent); }

/* ─── Retry badge ───────────────────────────────────────────────────────────── */

.retry-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--fs-warn, #ff9800);
  background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent);
}

/* ─── Shared ────────────────────────────────────────────────────────────────── */

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  color: var(--fs-text-muted);
  transition: color var(--fs-ease), background var(--fs-ease);
}
.icon-btn:hover   { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.icon-btn--active { color: var(--fs-accent); }

.fs-mono { font-family: var(--fs-font-mono); }
.clickable-row { cursor: pointer; }
</style>

<style>
/* q-dialog renders outside component DOM — must be unscoped */
.step-dialog {
  min-width: 420px;
  max-width: 560px;
  background: var(--fs-bg-surface);
  color: var(--fs-text-primary);
}

.step-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px !important;
}

.step-dialog__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fs-text-primary);
}

.step-dialog__body {
  padding: 16px !important;
}

.sdl-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sdl-row {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 8px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--fs-border);
}
.sdl-row:last-child { border-bottom: none; }
.sdl-row--top { align-items: start; }

.sdl-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
}

.sdl-value {
  font-size: 12.5px;
  color: var(--fs-text-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.sdl-value--message {
  color: var(--fs-text-muted);
  font-size: 12px;
  word-break: break-word;
  line-height: 1.5;
  display: block;
}

.sdl-muted {
  color: var(--fs-text-muted);
  font-size: 12px;
}

.output-badge--yes {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--fs-pos, #4caf50);
}

/* ─── Log dialog ────────────────────────────────────────────────────────────── */

.log-dialog {
  width: 760px;
  max-width: 96vw;
  background: var(--fs-bg-surface);
  color: var(--fs-text-primary);
}

.log-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px !important;
}

.log-dialog__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fs-text-primary);
}

.log-dialog__pod {
  font-size: 11px;
  font-weight: 400;
  color: var(--fs-text-muted);
}

.log-dialog__body {
  padding: 0 !important;
  max-height: 70vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.log-dlg-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  font-size: 12px;
  color: var(--fs-text-muted);
}

.log-dlg-error {
  padding: 16px;
  font-size: 12px;
  color: var(--fs-neg, #e57373);
  margin: 0;
}

.log-dlg-pre {
  margin: 0;
  padding: 14px 16px;
  font-family: var(--fs-font-mono);
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--fs-text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  overflow-y: auto;
  flex: 1;
  background: var(--fs-bg-elevated, var(--fs-bg-surface));
}

.log-dlg-empty {
  padding: 20px 16px;
  font-size: 12px;
  color: var(--fs-text-muted);
  margin: 0;
}
</style>
