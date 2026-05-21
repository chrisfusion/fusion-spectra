<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as monitorApi from '@/api/weaveMonitorApi'
import { listWeaveChains } from '@/api/weaveApi'
import { useRunsPolling } from '@/composables/useRunsPolling'
import { usePermission } from '@/composables/usePermission'

const router = useRouter()
const $q     = useQuasar()
const { can } = usePermission()

const allRuns      = ref<monitorApi.WeaveRun[]>([])
const chains       = ref<string[]>([])
const chainFilter  = ref<string | null>(null)
const loading      = ref(false)
const error        = ref<string | null>(null)
const stoppingRuns = ref<Set<string>>(new Set())
const deletingRuns = ref<Set<string>>(new Set())
const restartingSteps = ref<Set<string>>(new Set())

const serviceRuns = computed(() =>
  allRuns.value.filter(r => (r.spec.stepOverrides?.length ?? 0) > 0)
)

const filteredRuns = computed(() => {
  let runs = serviceRuns.value
  if (chainFilter.value) runs = runs.filter(r => r.spec.chainRef.name === chainFilter.value)
  return runs
})

async function loadRuns() {
  loading.value = true
  error.value   = null
  try {
    allRuns.value = await monitorApi.listAllRuns()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load service instances'
  } finally {
    loading.value = false
  }
}

async function loadChains() {
  try {
    const list = await listWeaveChains()
    chains.value = list.items.map(c => c.metadata.name)
  } catch {
    // chains list is best-effort for the filter
  }
}

const { polling, startPolling, togglePolling } = useRunsPolling(loadRuns)

function deployedVersion(r: monitorApi.WeaveRun): string {
  const deployments = Object.values(r.status?.activeDeployments ?? {})
  if (!deployments.length) return '—'
  return deployments[0].codeSourceDeployedVersion || '—'
}

function deploymentHealth(r: monitorApi.WeaveRun): monitorApi.DeploymentHealth | null {
  const deployments = Object.values(r.status?.activeDeployments ?? {})
  if (!deployments.length) return null
  return deployments[0].health
}

function stepOverrideSummary(r: monitorApi.WeaveRun): string {
  const o = r.spec.stepOverrides?.[0]
  return o ? `${o.artifactName} @ ${o.tag}` : '—'
}

function runPhase(r: monitorApi.WeaveRun): string {
  return r.status?.phase ?? 'Pending'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function confirmStop(r: monitorApi.WeaveRun) {
  $q.dialog({
    title:   'Stop Service Instance',
    message: `Stop <strong>${r.metadata.name}</strong>? All run-owned Deployments, Services, and Ingresses will be removed.`,
    html:    true,
    ok:     { label: 'Stop', color: 'warning', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    const name = r.metadata.name
    stoppingRuns.value = new Set([...stoppingRuns.value, name])
    const origPhase = r.status?.phase
    if (r.status) r.status.phase = 'Stopped'
    try {
      await monitorApi.stopRun(name)
      $q.notify({ type: 'positive', message: `${name} stopped` })
    } catch (e) {
      if (r.status && origPhase) r.status.phase = origPhase
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Stop failed' })
    } finally {
      stoppingRuns.value = new Set([...stoppingRuns.value].filter(n => n !== name))
    }
  })
}

function confirmDelete(r: monitorApi.WeaveRun) {
  $q.dialog({
    title:   'Delete Service Instance',
    message: `Delete <strong>${r.metadata.name}</strong>? This cannot be undone.`,
    html:    true,
    ok:     { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    const name = r.metadata.name
    deletingRuns.value = new Set([...deletingRuns.value, name])
    try {
      await monitorApi.deleteRun(name)
      allRuns.value = allRuns.value.filter(x => x.metadata.name !== name)
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
    } finally {
      deletingRuns.value = new Set([...deletingRuns.value].filter(n => n !== name))
    }
  })
}

function confirmRestart(r: monitorApi.WeaveRun) {
  const stepName = r.spec.stepOverrides?.[0]?.stepName
  if (!stepName) return
  const name = r.metadata.name
  $q.dialog({
    title:   'Reload Service',
    message: `Trigger a rolling restart of <strong>${stepName}</strong> in <strong>${name}</strong>?`,
    html:    true,
    ok:     { label: 'Reload', color: 'warning', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    const key = `${name}/${stepName}`
    restartingSteps.value = new Set([...restartingSteps.value, key])
    try {
      await monitorApi.restartDeployStep(name, stepName)
      $q.notify({ type: 'positive', message: `Reload triggered for ${name}` })
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Reload failed' })
    } finally {
      restartingSteps.value = new Set([...restartingSteps.value].filter(k => k !== key))
    }
  })
}

function isRestarting(r: monitorApi.WeaveRun): boolean {
  const stepName = r.spec.stepOverrides?.[0]?.stepName ?? ''
  return restartingSteps.value.has(`${r.metadata.name}/${stepName}`)
}

onMounted(async () => {
  await Promise.all([loadRuns(), loadChains()])
  startPolling()
})
</script>

<template>
  <div class="page-grid">
    <CanvasPanel
      title="Service Instances"
      icon="mdi-server-network"
      :wide="true"
      :loading="loading && allRuns.length === 0"
      :error="error ?? undefined"
      @refresh="loadRuns"
    >
      <template #actions>
        <button
          v-if="can('weave:runs:write')"
          class="fs-btn fs-btn--primary"
          @click="router.push('/pipelines/services/create')"
        >
          <q-icon name="mdi-plus" size="14px" style="margin-right:4px" />
          Launch Service
        </button>
        <button
          class="icon-btn"
          :class="{ 'icon-btn--active': polling }"
          :title="polling ? 'Pause auto-refresh' : 'Resume auto-refresh'"
          @click="togglePolling"
        >
          <q-icon :name="polling ? 'mdi-pause-circle-outline' : 'mdi-play-circle-outline'" size="16px" />
          <q-tooltip>{{ polling ? 'Pause' : 'Resume' }} auto-refresh (10s)</q-tooltip>
        </button>
      </template>

      <div class="toolbar">
        <select v-model="chainFilter" class="chain-select">
          <option :value="null">All chains</option>
          <option v-for="c in chains" :key="c" :value="c">{{ c }}</option>
        </select>
        <span class="total-hint">{{ filteredRuns.length }} instance{{ filteredRuns.length !== 1 ? 's' : '' }}</span>
      </div>

      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Chain</th>
              <th>Artifact @ Tag</th>
              <th>Version</th>
              <th>Health</th>
              <th>Phase</th>
              <th>Started</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in filteredRuns"
              :key="r.metadata.name"
              class="clickable-row"
              @click="router.push('/pipelines/services/' + r.metadata.name)"
            >
              <td class="col-name fs-mono">{{ r.metadata.name }}</td>
              <td class="col-muted fs-mono">{{ r.spec.chainRef.name }}</td>
              <td class="col-artifact">{{ stepOverrideSummary(r) }}</td>
              <td class="col-mono col-muted">{{ deployedVersion(r) }}</td>
              <td>
                <span
                  v-if="deploymentHealth(r)"
                  class="health-badge"
                  :class="`health-badge--${(deploymentHealth(r) ?? 'unknown').toLowerCase()}`"
                >{{ deploymentHealth(r) }}</span>
                <span v-else class="col-muted">—</span>
              </td>
              <td>
                <span class="phase-badge" :class="`phase-badge--${runPhase(r).toLowerCase()}`">{{ runPhase(r) }}</span>
              </td>
              <td class="col-muted">{{ formatDate(r.status?.startTime) }}</td>
              <td class="col-actions" @click.stop>
                <button
                  v-if="can('weave:steps:restart')"
                  class="icon-btn icon-btn--warn"
                  :disabled="isRestarting(r)"
                  title="Reload (rolling restart)"
                  @click="confirmRestart(r)"
                >
                  <q-spinner v-if="isRestarting(r)" size="13px" />
                  <q-icon v-else name="mdi-reload" size="16px" />
                  <q-tooltip>Reload (rolling restart)</q-tooltip>
                </button>
                <button
                  v-if="can('weave:steps:restart') && runPhase(r) === 'Running'"
                  class="icon-btn icon-btn--warn"
                  :disabled="stoppingRuns.has(r.metadata.name)"
                  title="Stop instance"
                  @click="confirmStop(r)"
                >
                  <q-spinner v-if="stoppingRuns.has(r.metadata.name)" size="13px" />
                  <q-icon v-else name="mdi-stop-circle-outline" size="16px" />
                  <q-tooltip>Stop instance</q-tooltip>
                </button>
                <button
                  v-if="can('weave:runs:delete')"
                  class="icon-btn icon-btn--danger"
                  :disabled="deletingRuns.has(r.metadata.name)"
                  title="Delete instance"
                  @click="confirmDelete(r)"
                >
                  <q-spinner v-if="deletingRuns.has(r.metadata.name)" size="13px" />
                  <q-icon v-else name="mdi-delete-outline" size="16px" />
                  <q-tooltip>Delete instance</q-tooltip>
                </button>
              </td>
            </tr>
            <tr v-if="!loading && filteredRuns.length === 0">
              <td colspan="8" class="empty-row">No service instances found.</td>
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

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 0 10px 0;
}

.chain-select {
  background: var(--fs-bg-surface);
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  color: var(--fs-text-primary);
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
}
.chain-select:focus { outline: 1px solid var(--fs-accent); }

.total-hint {
  font-size: 11px;
  color: var(--fs-text-muted);
  margin-left: auto;
}

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
.tpl-table tbody tr:hover td      { background: var(--fs-bg-hover); }
.tpl-table tbody tr.clickable-row { cursor: pointer; }

.col-name    { font-weight: 500; color: var(--fs-accent); }
.col-artifact { color: var(--fs-text-secondary, var(--fs-text-primary)); font-size: 12px; }
.col-mono    { font-family: var(--fs-font-mono); }
.col-muted   { color: var(--fs-text-muted); font-size: 12px; }
.col-actions { width: 96px; text-align: center; white-space: nowrap; }

.empty-row {
  text-align: center;
  color: var(--fs-text-muted);
  padding: 32px 10px !important;
}

.fs-mono { font-family: var(--fs-font-mono); }

/* Phase badges */
.phase-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.phase-badge--running   { color: var(--fs-warn, #ff9800);   background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent); }
.phase-badge--pending   { color: var(--fs-accent);           background: color-mix(in srgb, var(--fs-accent) 12%, transparent); }
.phase-badge--stopped   { color: var(--fs-text-muted);       background: color-mix(in srgb, var(--fs-text-muted) 12%, transparent); }
.phase-badge--failed    { color: var(--fs-neg, #e57373);     background: color-mix(in srgb, var(--fs-neg, #e57373) 12%, transparent); }
.phase-badge--succeeded { color: var(--fs-pos, #81c784);     background: color-mix(in srgb, var(--fs-pos, #81c784) 12%, transparent); }

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

/* Buttons */
.fs-btn {
  display: inline-flex;
  align-items: center;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 12px;
  cursor: pointer;
  transition: opacity var(--fs-ease);
}
.fs-btn--primary {
  background: var(--fs-accent);
  color: #fff;
}
.fs-btn--primary:hover { opacity: 0.85; }

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
.icon-btn:hover                        { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.icon-btn--active                      { color: var(--fs-accent); }
.icon-btn--danger:hover:not(:disabled) { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }
.icon-btn--warn:hover:not(:disabled)   { color: var(--fs-warn, #ff9800); background: color-mix(in srgb, var(--fs-warn, #ff9800) 10%, transparent); }
.icon-btn:disabled                     { opacity: 0.4; cursor: not-allowed; }
</style>
