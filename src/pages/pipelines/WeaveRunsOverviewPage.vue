<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as monitorApi from '@/api/weaveMonitorApi'
import { formatDurationMs } from '@/utils/format'

const POLL_MS = 10_000

// ─── State ────────────────────────────────────────────────────────────────────

const statsWindow  = ref<monitorApi.StatsWindow>('24h')
const stats        = ref<monitorApi.RunStatsResponse | null>(null)
const statsLoading = ref(false)
const statsError   = ref<string | null>(null)

const allRuns     = ref<monitorApi.RunSummary[]>([])
const runsLoading = ref(false)
const runsError   = ref<string | null>(null)

// ─── Derived ──────────────────────────────────────────────────────────────────

const runningRuns = computed(() =>
  allRuns.value.filter(r => r.phase === 'Running' || r.phase === 'Pending').slice(0, 5)
)
const failedRuns = computed(() =>
  allRuns.value.filter(r => r.phase === 'Failed' || r.phase === 'Stopped').slice(0, 5)
)

// ─── Polling ──────────────────────────────────────────────────────────────────

const autoRefresh = ref(true)
let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(loadAll, POLL_MS)
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

async function loadStats() {
  statsLoading.value = true
  statsError.value   = null
  try {
    stats.value = await monitorApi.getRunStats(statsWindow.value)
  } catch (e) {
    statsError.value = e instanceof Error ? e.message : 'Failed to load stats'
  } finally {
    statsLoading.value = false
  }
}

async function loadRuns() {
  runsLoading.value = true
  runsError.value   = null
  try {
    allRuns.value = await monitorApi.listRuns()
  } catch (e) {
    runsError.value = e instanceof Error ? e.message : 'Failed to load runs'
  } finally {
    runsLoading.value = false
  }
}

async function loadAll() {
  await Promise.all([loadStats(), loadRuns()])
}

function onWindowChange(w: monitorApi.StatsWindow) {
  statsWindow.value = w
  loadStats()
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function formatRate(rate: number, total: number): string {
  if (total === 0) return '—'
  return `${Math.round(rate * 100)}%`
}

function formatAvgDuration(ms: number, total: number): string {
  if (total === 0 || ms === 0) return '—'
  return formatDurationMs(ms)
}

onMounted(async () => {
  await loadAll()
  if (autoRefresh.value) startPolling()
})
</script>

<template>
  <div class="page-grid">

    <!-- Stats row -->
    <div class="stats-row">
      <div class="stat-card stat-card--running">
        <span class="stat-label">Running</span>
        <span class="stat-value stat-value--running">
          <q-spinner v-if="statsLoading" size="18px" color="warning" />
          <template v-else>{{ stats?.running ?? '—' }}</template>
        </span>
      </div>
      <div class="stat-card stat-card--pending">
        <span class="stat-label">Pending</span>
        <span class="stat-value stat-value--pending">
          <template v-if="!statsLoading">{{ stats?.pending ?? '—' }}</template>
        </span>
      </div>
      <div class="stat-card stat-card--failed">
        <span class="stat-label">Failed</span>
        <span class="stat-value stat-value--failed">
          <template v-if="!statsLoading">{{ stats?.failed ?? '—' }}</template>
        </span>
      </div>
      <div class="stat-card stat-card--rate">
        <span class="stat-label">Success Rate</span>
        <span class="stat-value stat-value--rate">
          <template v-if="!statsLoading">{{ stats ? formatRate(stats.successRate, stats.total) : '—' }}</template>
        </span>
      </div>
      <div class="stat-card stat-card--duration">
        <span class="stat-label">Avg Duration</span>
        <span class="stat-value">
          <template v-if="!statsLoading">{{ stats ? formatAvgDuration(stats.avgDurationMs, stats.total) : '—' }}</template>
        </span>
      </div>
      <div class="stats-controls">
        <div class="window-btns">
          <button
            v-for="w in (['1h', '24h', '7d'] as const)"
            :key="w"
            class="window-btn"
            :class="{ 'window-btn--active': statsWindow === w }"
            @click="onWindowChange(w)"
          >{{ w }}</button>
        </div>
        <button
          class="icon-btn"
          :class="{ 'icon-btn--active': autoRefresh }"
          :title="autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'"
          @click="toggleAutoRefresh"
        >
          <q-icon :name="autoRefresh ? 'mdi-pause-circle-outline' : 'mdi-play-circle-outline'" size="16px" />
          <q-tooltip>{{ autoRefresh ? 'Pause' : 'Resume' }} auto-refresh (10s)</q-tooltip>
        </button>
      </div>
      <p v-if="statsError" class="stats-error">{{ statsError }}</p>
    </div>

    <!-- Running panel -->
    <CanvasPanel
      title="Running"
      icon="mdi-motion-play-outline"
      :loading="runsLoading"
      :error="runsError ?? undefined"
      @refresh="loadRuns"
    >
      <template #actions>
        <router-link class="see-all-link" to="/pipelines/runs/running">See all →</router-link>
      </template>

      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Chain</th>
              <th>Phase</th>
              <th>Steps</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in runningRuns" :key="r.name">
              <td class="col-name fs-mono">{{ r.name }}</td>
              <td class="col-chain fs-mono">{{ r.chain }}</td>
              <td>
                <span class="phase-badge" :class="`phase-badge--${r.phase.toLowerCase()}`">{{ r.phase }}</span>
              </td>
              <td class="col-num">{{ r.stepCount }}</td>
              <td class="col-muted">{{ formatDate(r.startTime) }}</td>
            </tr>
            <tr v-if="!runsLoading && runningRuns.length === 0">
              <td colspan="5" class="empty-row">No running runs.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </CanvasPanel>

    <!-- Failed panel -->
    <CanvasPanel
      title="Failed"
      icon="mdi-alert-circle-outline"
      :loading="runsLoading"
      :error="runsError ?? undefined"
      @refresh="loadRuns"
    >
      <template #actions>
        <router-link class="see-all-link" to="/pipelines/runs/failed">See all →</router-link>
      </template>

      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Chain</th>
              <th>Failed Steps</th>
              <th>Message</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in failedRuns" :key="r.name">
              <td class="col-name fs-mono">{{ r.name }}</td>
              <td class="col-chain fs-mono">{{ r.chain }}</td>
              <td class="col-num">
                <span v-if="r.failedSteps > 0" class="fail-badge">{{ r.failedSteps }}</span>
                <span v-else class="col-muted">0</span>
              </td>
              <td class="col-message" :title="r.message ?? ''">{{ r.message || '—' }}</td>
              <td class="col-muted">{{ formatDate(r.completionTime) }}</td>
            </tr>
            <tr v-if="!runsLoading && failedRuns.length === 0">
              <td colspan="5" class="empty-row">No failed runs.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </CanvasPanel>

  </div>
</template>

<style scoped>
.page-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 16px;
  align-content: start;
}

/* ─── Stats row ─────────────────────────────────────────────────────────────── */

.stats-row {
  grid-column: span 2;
  display: flex;
  align-items: stretch;
  gap: 10px;
}

.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  border-radius: 4px;
  border: 1px solid var(--fs-border);
  background: var(--fs-bg-surface);
  border-top: 2px solid var(--fs-border);
}
.stat-card--running  { border-top-color: var(--fs-warn, #ff9800); }
.stat-card--pending  { border-top-color: var(--fs-accent); }
.stat-card--failed   { border-top-color: var(--fs-neg, #e57373); }
.stat-card--rate     { border-top-color: var(--fs-pos, #4caf50); }
.stat-card--duration { border-top-color: var(--fs-text-muted); }

.stat-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  font-family: var(--fs-font-mono);
  color: var(--fs-text-primary);
  line-height: 1.2;
  min-height: 27px;
}
.stat-value--running { color: var(--fs-warn, #ff9800); }
.stat-value--pending { color: var(--fs-accent); }
.stat-value--failed  { color: var(--fs-neg, #e57373); }
.stat-value--rate    { color: var(--fs-pos, #4caf50); }

.stats-controls {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 4px;
  border: 1px solid var(--fs-border);
  background: var(--fs-bg-surface);
}

.window-btns {
  display: flex;
  gap: 4px;
}
.window-btn {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid var(--fs-border);
  background: transparent;
  color: var(--fs-text-muted);
  transition: background var(--fs-ease), color var(--fs-ease), border-color var(--fs-ease);
}
.window-btn--active {
  background: var(--fs-accent);
  border-color: var(--fs-accent);
  color: #fff;
}
.window-btn:not(.window-btn--active):hover {
  background: var(--fs-bg-hover);
  color: var(--fs-text-primary);
}

.stats-error {
  grid-column: span 2;
  font-size: 11px;
  color: var(--fs-neg, #e57373);
  margin: 0;
  padding-top: 4px;
}

/* ─── See all link ──────────────────────────────────────────────────────────── */

.see-all-link {
  font-size: 11px;
  font-weight: 500;
  color: var(--fs-accent);
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 3px;
  transition: background var(--fs-ease);
}
.see-all-link:hover { background: var(--fs-bg-hover); }

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

.col-name  { font-weight: 500; color: var(--fs-accent); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-chain { color: var(--fs-text-muted); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-num   { color: var(--fs-text-muted); text-align: center; }
.col-muted { color: var(--fs-text-muted); font-size: 12px; }
.col-message {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fs-text-muted);
  font-size: 12px;
}

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

/* ─── Fail count badge ──────────────────────────────────────────────────────── */

.fail-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--fs-neg, #e57373);
  background: color-mix(in srgb, var(--fs-neg, #e57373) 12%, transparent);
}

/* ─── Icon button ───────────────────────────────────────────────────────────── */

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
.icon-btn:hover    { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.icon-btn--active  { color: var(--fs-accent); }

.fs-mono { font-family: var(--fs-font-mono); }
</style>
