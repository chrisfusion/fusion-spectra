<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as monitorApi from '@/api/weaveMonitorApi'
import { useRunsPolling } from '@/composables/useRunsPolling'
import ManagedByBadge from '@/components/ManagedByBadge.vue'
import ManagedByFilter from '@/components/ManagedByFilter.vue'
import { matchesManagedBy, type ManagedByFilterValue } from '@/utils/managedBy'
import { appSource, lastExecution } from '@/utils/weaveApp'

// WeaveApps — single-resource services/jobs, created by the wizards (or the API). Read-only list;
// image changes and "Run now" live on the detail page.

const router = useRouter()

const apps        = ref<monitorApi.WeaveApp[]>([])
const typeFilter  = ref<'' | 'service' | 'job'>('')
const ownerFilter = ref<ManagedByFilterValue>('')
const loading     = ref(false)
const error       = ref<string | null>(null)

const filteredApps = computed(() => apps.value
  .filter(a => !typeFilter.value || a.spec.type === typeFilter.value)
  .filter(a => matchesManagedBy(a.metadata, ownerFilter.value))
  .sort((a, b) => (b.metadata.creationTimestamp ?? '').localeCompare(a.metadata.creationTimestamp ?? '')))

async function loadApps() {
  loading.value = true
  error.value   = null
  try {
    apps.value = await monitorApi.listApps()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load apps'
  } finally {
    loading.value = false
  }
}

const { polling, startPolling, togglePolling } = useRunsPolling(loadApps)

function phase(a: monitorApi.WeaveApp): string {
  return a.status?.phase ?? 'Pending'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

onMounted(async () => {
  await loadApps()
  startPolling()
})
</script>

<template>
  <div class="page-grid">
    <CanvasPanel
      title="Apps"
      icon="mdi-application-outline"
      :wide="true"
      :loading="loading && apps.length === 0"
      :error="error ?? undefined"
      @refresh="loadApps"
    >
      <template #actions>
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
        <select v-model="typeFilter" class="type-select">
          <option value="">All types</option>
          <option value="service">Services</option>
          <option value="job">Jobs</option>
        </select>
        <ManagedByFilter v-model="ownerFilter" />
        <span class="total-hint">{{ filteredApps.length }} app{{ filteredApps.length !== 1 ? 's' : '' }}</span>
      </div>

      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Source</th>
              <th>Owner</th>
              <th>Phase</th>
              <th>Last execution</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in filteredApps"
              :key="a.metadata.name"
              class="clickable-row"
              @click="router.push('/pipelines/weave/apps/' + encodeURIComponent(a.metadata.name))"
            >
              <td class="col-name fs-mono">{{ a.metadata.name }}</td>
              <td class="col-muted">{{ a.spec.type === 'service' ? 'Service' : 'Job' }}</td>
              <td class="col-source fs-mono">{{ appSource(a) }}</td>
              <td><ManagedByBadge :meta="a.metadata" /></td>
              <td>
                <span class="phase-badge" :class="`phase-badge--${phase(a).toLowerCase()}`">{{ phase(a) }}</span>
              </td>
              <td>
                <template v-if="lastExecution(a)">
                  <span class="phase-badge" :class="`phase-badge--${lastExecution(a)!.phase.toLowerCase()}`">{{ lastExecution(a)!.phase }}</span>
                  <span class="col-muted exec-time">{{ formatDate(lastExecution(a)!.startTime) }}</span>
                </template>
                <span v-else class="col-muted">—</span>
              </td>
              <td class="col-muted">{{ formatDate(a.metadata.creationTimestamp) }}</td>
            </tr>
            <tr v-if="!loading && filteredApps.length === 0">
              <td colspan="7" class="empty-row">No apps found — the Image and Git → Python wizards create them.</td>
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

.type-select {
  background: var(--fs-bg-surface);
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  color: var(--fs-text-primary);
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
}
.type-select:focus { outline: 1px solid var(--fs-accent); }

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

.col-name   { font-weight: 500; color: var(--fs-accent); }
.col-source { font-size: 12px; word-break: break-all; }
.col-muted  { color: var(--fs-text-muted); font-size: 12px; }
.exec-time  { margin-left: 6px; }

.empty-row {
  text-align: center;
  color: var(--fs-text-muted);
  padding: 32px 10px !important;
}

.fs-mono { font-family: var(--fs-font-mono); }

/* Phase badges — app phases (Pending/Ready/Running/Invalid) and execution phases */
.phase-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.phase-badge--pending   { color: var(--fs-accent);           background: color-mix(in srgb, var(--fs-accent) 12%, transparent); }
.phase-badge--running   { color: var(--fs-warn, #ff9800);   background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent); }
.phase-badge--ready,
.phase-badge--succeeded { color: var(--fs-pos, #81c784);     background: color-mix(in srgb, var(--fs-pos, #81c784) 12%, transparent); }
.phase-badge--invalid,
.phase-badge--failed    { color: var(--fs-neg, #e57373);     background: color-mix(in srgb, var(--fs-neg, #e57373) 12%, transparent); }

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
</style>
