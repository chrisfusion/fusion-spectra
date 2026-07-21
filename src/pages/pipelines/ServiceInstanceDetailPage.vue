<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as monitorApi from '@/api/weaveMonitorApi'
import { usePermission } from '@/composables/usePermission'

const route  = useRoute()
const router = useRouter()
const $q     = useQuasar()
const { can } = usePermission()

const runName = route.params.name as string

// ─── State ─────────────────────────────────────────────────────────────────────

const detail  = ref<monitorApi.RunDetail | null>(null)
const loading = ref(false)
const error   = ref<string | null>(null)

const stopping  = ref(false)
const deleting  = ref(false)
const restartingSteps = ref<Set<string>>(new Set())

// ─── Polling — inline setInterval; Deployed is non-terminal ───────────────────

const POLL_MS = 10_000
let pollTimer: ReturnType<typeof setInterval> | null = null
const autoRefresh = ref(true)

function isTerminal(phase: string | undefined): boolean {
  return phase === 'Succeeded' || phase === 'Failed' || phase === 'Stopped'
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    await loadDetail()
    if (isTerminal(detail.value?.run.status?.phase)) stopPolling()
  }, POLL_MS)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) startPolling()
  else stopPolling()
}

onUnmounted(stopPolling)

// ─── Data loading ──────────────────────────────────────────────────────────────

async function loadDetail() {
  if (!detail.value) loading.value = true
  error.value = null
  try {
    detail.value = await monitorApi.getRun(runName)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load service instance'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadDetail()
  if (!isTerminal(detail.value?.run.status?.phase)) startPolling()
})

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function activeDeployments(): monitorApi.ActiveDeploymentStatus[] {
  return Object.values(detail.value?.run.status?.activeDeployments ?? {})
}

function stepOverride(): monitorApi.StepOverride | undefined {
  return detail.value?.run.spec.stepOverrides?.[0]
}

// ─── Actions ───────────────────────────────────────────────────────────────────

function confirmStop() {
  $q.dialog({
    title:   'Stop Service Instance',
    message: `Stop <strong>${runName}</strong>? All run-owned Deployments, Services, and Ingresses will be removed.`,
    html:    true,
    ok:     { label: 'Stop', color: 'warning', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    stopping.value = true
    if (detail.value?.run.status) detail.value.run.status.phase = 'Stopped'
    stopPolling()
    try {
      await monitorApi.stopRun(runName)
      $q.notify({ type: 'positive', message: `${runName} stopped` })
    } catch (e) {
      if (detail.value?.run.status) detail.value.run.status.phase = 'Running'
      if (autoRefresh.value) startPolling()
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Stop failed' })
    } finally {
      stopping.value = false
    }
  })
}

function confirmDelete() {
  $q.dialog({
    title:   'Delete Service Instance',
    message: `Delete <strong>${runName}</strong>? This cannot be undone.`,
    html:    true,
    ok:     { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deleting.value = true
    stopPolling()
    try {
      await monitorApi.deleteRun(runName)
      $q.notify({ type: 'positive', message: `${runName} deleted` })
      router.push('/pipelines/services')
    } catch (e) {
      if (autoRefresh.value) startPolling()
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
      deleting.value = false
    }
  })
}

function restartStep(d: monitorApi.ActiveDeploymentStatus) {
  $q.dialog({
    title:   'Reload Service',
    message: `Trigger a rolling restart of <strong>${d.stepName}</strong>?`,
    html:    true,
    ok:     { label: 'Reload', color: 'warning', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    restartingSteps.value = new Set([...restartingSteps.value, d.stepName])
    try {
      await monitorApi.restartDeployStep(runName, d.stepName)
      $q.notify({ type: 'positive', message: `Reload triggered for ${d.stepName}` })
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Reload failed' })
    } finally {
      restartingSteps.value = new Set([...restartingSteps.value].filter(s => s !== d.stepName))
    }
  })
}
</script>

<template>
  <div class="page-grid">
    <!-- Left: metadata + actions -->
    <CanvasPanel
      title="Service Instance"
      icon="mdi-server-network-outline"
      :loading="loading && !detail"
      :error="error ?? undefined"
      @refresh="loadDetail"
    >
      <template #actions>
        <button
          class="icon-btn"
          :class="{ 'icon-btn--active': autoRefresh }"
          title="Toggle auto-refresh"
          @click="toggleAutoRefresh"
        >
          <q-icon :name="autoRefresh ? 'mdi-pause-circle-outline' : 'mdi-play-circle-outline'" size="16px" />
          <q-tooltip>{{ autoRefresh ? 'Pause' : 'Resume' }} auto-refresh</q-tooltip>
        </button>
      </template>

      <div v-if="detail" class="meta-body">
        <h2 class="run-name fs-mono">{{ runName }}</h2>

        <div class="phase-row">
          <span class="phase-badge" :class="`phase-badge--${(detail.run.status?.phase ?? 'pending').toLowerCase()}`">
            {{ detail.run.status?.phase ?? 'Pending' }}
          </span>
        </div>

        <dl class="meta-list">
          <dt>Chain</dt>
          <dd class="fs-mono">{{ detail.run.spec.chainRef.name }}</dd>

          <dt>Artifact</dt>
          <dd class="fs-mono">{{ stepOverride()?.artifactName ?? '—' }}</dd>

          <dt>Tag</dt>
          <dd class="fs-mono">{{ stepOverride()?.tag ?? '—' }}</dd>

          <template v-if="stepOverride()?.ingressName">
            <dt>Ingress Name</dt>
            <dd class="fs-mono">{{ stepOverride()?.ingressName }}</dd>
          </template>

          <dt>Deploy Step</dt>
          <dd class="fs-mono">{{ stepOverride()?.stepName ?? '—' }}</dd>

          <dt>Started</dt>
          <dd>{{ formatDate(detail.run.status?.startTime) }}</dd>

          <template v-if="detail.run.status?.message">
            <dt>Message</dt>
            <dd class="col-muted">{{ detail.run.status.message }}</dd>
          </template>
        </dl>

        <div class="action-row">
          <button
            v-if="can('weave:steps:restart') && detail.run.status?.phase === 'Running'"
            class="fs-btn fs-btn--warn"
            :disabled="stopping"
            @click="confirmStop"
          >
            <q-spinner v-if="stopping" size="14px" style="margin-right:6px" />
            <q-icon v-else name="mdi-stop-circle-outline" size="14px" style="margin-right:4px" />
            Stop
          </button>
          <button
            v-if="can('weave:runs:delete')"
            class="fs-btn fs-btn--danger"
            :disabled="deleting || stopping"
            @click="confirmDelete"
          >
            <q-spinner v-if="deleting" size="14px" style="margin-right:6px" />
            <q-icon v-else name="mdi-delete-outline" size="14px" style="margin-right:4px" />
            Delete
          </button>
        </div>
      </div>
    </CanvasPanel>

    <!-- Right: active deployments health -->
    <CanvasPanel
      title="Deployment Health"
      icon="mdi-heart-pulse"
      :loading="loading && !detail"
      :error="error ?? undefined"
      @refresh="loadDetail"
    >
      <div v-if="detail">
        <div v-if="activeDeployments().length === 0" class="no-deployments">
          <q-icon name="mdi-server-off" size="28px" class="no-dep-icon" />
          <p>No active deployments yet.</p>
          <p class="col-muted">The operator is starting the service…</p>
        </div>

        <div v-for="d in activeDeployments()" :key="d.deploymentName" class="dep-card">
          <div class="dep-header">
            <span class="dep-name fs-mono">{{ d.deploymentName }}</span>
            <span class="health-badge" :class="`health-badge--${d.health.toLowerCase()}`">{{ d.health }}</span>
          </div>

          <dl class="dep-meta">
            <dt>Step</dt>
            <dd class="fs-mono">{{ d.stepName }}</dd>

            <dt>Running version</dt>
            <dd class="fs-mono version-chip">{{ d.codeSourceDeployedVersion || '—' }}</dd>

            <dt>Tracking tag</dt>
            <dd class="fs-mono">{{ d.codeSourceTag }}</dd>

            <template v-if="d.health !== 'Healthy' && d.unhealthyDurationSeconds">
              <dt>Unhealthy for</dt>
              <dd class="col-warn">{{ formatDuration(d.unhealthyDurationSeconds) }}</dd>
            </template>
          </dl>

          <div class="dep-actions">
            <button
              v-if="can('weave:steps:restart')"
              class="fs-btn fs-btn--ghost fs-btn--sm"
              :disabled="restartingSteps.has(d.stepName)"
              @click="restartStep(d)"
            >
              <q-spinner v-if="restartingSteps.has(d.stepName)" size="12px" style="margin-right:4px" />
              <q-icon v-else name="mdi-reload" size="13px" style="margin-right:4px" />
              Reload
            </button>
          </div>
        </div>
      </div>
    </CanvasPanel>

    <!-- Step phases (secondary, full width) -->
    <CanvasPanel
      v-if="detail && (detail.run.status?.steps ?? []).length > 0"
      title="Steps"
      icon="mdi-sitemap-outline"
      :wide="true"
    >
      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Phase</th>
              <th>Kind</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in detail.run.status?.steps ?? []" :key="s.name">
              <td class="col-name fs-mono">{{ s.name }}</td>
              <td>
                <span class="phase-badge" :class="`phase-badge--${s.phase.toLowerCase()}`">{{ s.phase }}</span>
              </td>
              <td class="col-muted">
                {{ s.deploymentRef?.name ? 'Service' : s.jobRef?.name ? 'Job' : '—' }}
              </td>
              <td class="col-muted">{{ formatDate(s.startTime) }}</td>
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

/* Metadata panel */
.meta-body { display: flex; flex-direction: column; gap: 12px; }

.run-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--fs-text-primary);
  margin: 0 0 4px 0;
  word-break: break-all;
}

.phase-row { margin-bottom: 4px; }

.meta-list {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 6px 12px;
  font-size: 12.5px;
  margin: 0;
}
.meta-list dt {
  color: var(--fs-text-muted);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
}
.meta-list dd {
  color: var(--fs-text-primary);
  margin: 0;
  word-break: break-all;
}

.action-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* Deployment health cards */
.no-deployments {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  gap: 6px;
  color: var(--fs-text-muted);
  font-size: 13px;
}
.no-dep-icon { opacity: 0.4; }
.no-deployments p { margin: 0; }

.dep-card {
  border: 1px solid var(--fs-border);
  border-radius: 6px;
  padding: 12px 14px;
  margin-bottom: 10px;
  background: var(--fs-bg-elevated, var(--fs-bg-surface));
}
.dep-card:last-child { margin-bottom: 0; }

.dep-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.dep-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--fs-accent);
}

.dep-meta {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 5px 10px;
  font-size: 12px;
  margin: 0 0 10px 0;
}
.dep-meta dt {
  color: var(--fs-text-muted);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
}
.dep-meta dd { margin: 0; color: var(--fs-text-primary); }

.version-chip {
  display: inline-block;
  background: color-mix(in srgb, var(--fs-accent) 10%, transparent);
  color: var(--fs-accent);
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.dep-actions { display: flex; gap: 6px; }

.col-warn { color: var(--fs-warn, #ff9800); }
.col-muted { color: var(--fs-text-muted); }

/* Phase badges */
.phase-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.phase-badge--running   { color: var(--fs-warn, #ff9800);  background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent); }
.phase-badge--pending   { color: var(--fs-accent);          background: color-mix(in srgb, var(--fs-accent) 12%, transparent); }
.phase-badge--deployed  { color: var(--fs-pos, #81c784);   background: color-mix(in srgb, var(--fs-pos, #81c784) 12%, transparent); }
.phase-badge--succeeded { color: var(--fs-pos, #81c784);   background: color-mix(in srgb, var(--fs-pos, #81c784) 12%, transparent); }
.phase-badge--failed    { color: var(--fs-neg, #e57373);   background: color-mix(in srgb, var(--fs-neg, #e57373) 12%, transparent); }
.phase-badge--stopped   { color: var(--fs-text-muted);     background: color-mix(in srgb, var(--fs-text-muted) 12%, transparent); }
.phase-badge--skipped   { color: var(--fs-text-muted);     background: color-mix(in srgb, var(--fs-text-muted) 12%, transparent); }
.phase-badge--retrying  { color: var(--fs-warn, #ff9800);  background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent); }

/* Health badges */
.health-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.health-badge--healthy    { color: var(--fs-pos, #81c784);  background: color-mix(in srgb, var(--fs-pos, #81c784) 12%, transparent); }
.health-badge--unhealthy  { color: var(--fs-neg, #e57373);  background: color-mix(in srgb, var(--fs-neg, #e57373) 12%, transparent); }
.health-badge--rollingback { color: var(--fs-warn, #ff9800); background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent); }
.health-badge--rolledback  { color: var(--fs-neg, #e57373);  background: color-mix(in srgb, var(--fs-neg, #e57373) 12%, transparent); }
.health-badge--unknown    { color: var(--fs-text-muted);    background: color-mix(in srgb, var(--fs-text-muted) 12%, transparent); }

/* Steps table */
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
.col-name { font-weight: 500; color: var(--fs-accent); }

/* Buttons */
.fs-btn {
  display: inline-flex;
  align-items: center;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 14px;
  cursor: pointer;
  transition: opacity var(--fs-ease), background var(--fs-ease);
  font-family: inherit;
}
.fs-btn--sm { font-size: 11.5px; padding: 4px 10px; }
.fs-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fs-btn--warn   { background: color-mix(in srgb, var(--fs-warn, #ff9800) 15%, transparent); color: var(--fs-warn, #ff9800); border: 1px solid color-mix(in srgb, var(--fs-warn, #ff9800) 30%, transparent); }
.fs-btn--warn:hover:not(:disabled)   { background: color-mix(in srgb, var(--fs-warn, #ff9800) 25%, transparent); }
.fs-btn--danger { background: color-mix(in srgb, var(--fs-neg, #e57373) 15%, transparent); color: var(--fs-neg, #e57373); border: 1px solid color-mix(in srgb, var(--fs-neg, #e57373) 30%, transparent); }
.fs-btn--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--fs-neg, #e57373) 25%, transparent); }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border: 1px solid var(--fs-border); }
.fs-btn--ghost:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }

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
.icon-btn:hover     { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.icon-btn--active   { color: var(--fs-accent); }

.fs-mono { font-family: var(--fs-font-mono); }
</style>
