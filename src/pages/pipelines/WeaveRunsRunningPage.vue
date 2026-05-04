<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as monitorApi from '@/api/weaveMonitorApi'
import { useRunsPolling } from '@/composables/useRunsPolling'

const router = useRouter()

const allRuns  = ref<monitorApi.RunSummary[]>([])
const loading  = ref(false)
const error    = ref<string | null>(null)

const runs = computed(() =>
  allRuns.value.filter(r => r.phase === 'Running' || r.phase === 'Pending')
)

async function loadRuns() {
  loading.value = true
  error.value   = null
  try {
    allRuns.value = await monitorApi.listRuns()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load runs'
  } finally {
    loading.value = false
  }
}

const { polling, startPolling, togglePolling } = useRunsPolling(loadRuns)

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

onMounted(async () => {
  await loadRuns()
  startPolling()
})
</script>

<template>
  <div class="page-grid">
    <CanvasPanel
      title="Running Runs"
      icon="mdi-motion-play-outline"
      :wide="true"
      :loading="loading"
      :error="error ?? undefined"
      @refresh="loadRuns"
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

      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Chain</th>
              <th>Phase</th>
              <th>Steps</th>
              <th>Failed Steps</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in runs" :key="r.name" class="clickable-row" @click="router.push('/pipelines/runs/' + r.name)">
              <td class="col-name fs-mono">{{ r.name }}</td>
              <td class="col-chain fs-mono">{{ r.chain }}</td>
              <td>
                <span class="phase-badge" :class="`phase-badge--${r.phase.toLowerCase()}`">{{ r.phase }}</span>
              </td>
              <td class="col-num">{{ r.stepCount }}</td>
              <td class="col-num">
                <span v-if="r.failedSteps > 0" class="fail-badge">{{ r.failedSteps }}</span>
                <span v-else class="col-muted">0</span>
              </td>
              <td class="col-muted">{{ formatDate(r.startTime) }}</td>
            </tr>
            <tr v-if="!loading && runs.length === 0">
              <td colspan="6" class="empty-row">No running or pending runs.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="row-count">{{ runs.length }} run{{ runs.length !== 1 ? 's' : '' }}</p>
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
.tpl-table tbody tr.clickable-row { cursor: pointer; }

.col-name  { font-weight: 500; color: var(--fs-accent); }
.col-chain { color: var(--fs-text-muted); }
.col-num   { color: var(--fs-text-muted); text-align: center; }
.col-muted { color: var(--fs-text-muted); font-size: 12px; }

.empty-row {
  text-align: center;
  color: var(--fs-text-muted);
  padding: 32px 10px !important;
}

.row-count {
  margin: 0;
  padding-top: 10px;
  font-size: 11px;
  color: var(--fs-text-muted);
  text-align: right;
}

.phase-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.phase-badge--running { color: var(--fs-warn, #ff9800); background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent); }
.phase-badge--pending { color: var(--fs-accent);        background: color-mix(in srgb, var(--fs-accent)        12%, transparent); }

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
</style>
