<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as wizardApi from '@/api/wizardApi'
import { usePermission } from '@/composables/usePermission'
import { useRunsPolling } from '@/composables/useRunsPolling'

const router = useRouter()
const $q     = useQuasar()
const { can } = usePermission()

const runs      = ref<wizardApi.WizardRun[]>([])
const loading   = ref(true)
const loadError = ref<string | null>(null)
const actingOn  = ref<Set<string>>(new Set())

const PHASES: wizardApi.RunPhase[] = ['Pending', 'Running', 'Ready', 'Failed', 'RollingBack', 'RolledBack', 'RollbackFailed']
const PHASE_LABEL: Record<string, string> = {
  Pending: 'Pending', Running: 'Running', Ready: 'Ready', Failed: 'Failed',
  RollingBack: 'Rolling Back', RolledBack: 'Rolled Back', RollbackFailed: 'Rollback Failed',
}

async function loadRuns() {
  loadError.value = null
  try {
    const page = await wizardApi.listRuns({ limit: 200 })
    runs.value = page.items
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load wizard runs'
  } finally {
    loading.value = false
  }
}
onMounted(loadRuns)

const { polling, togglePolling } = useRunsPolling(loadRuns)

// ─── Filters (client-side, matches the equivalent weave monitoring pages) ────

const filterDefinition = ref('')
const filterPhase      = ref('')

const definitions = computed(() =>
  [...new Set(runs.value.map(r => r.definition))].sort())

const filteredRuns = computed(() => runs.value.filter(r =>
  (!filterDefinition.value || r.definition === filterDefinition.value) &&
  (!filterPhase.value || r.status.phase === filterPhase.value)))

const stats = computed(() => {
  const counts: Record<string, number> = {}
  for (const r of runs.value) {
    const p = r.status.phase ?? 'Pending'
    counts[p] = (counts[p] ?? 0) + 1
  }
  return counts
})

// ─── Actions ────────────────────────────────────────────────────────────────

function withActing<T>(name: string, fn: () => Promise<T>): Promise<T | void> {
  actingOn.value = new Set([...actingOn.value, name])
  return fn()
    .catch(e => { $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Action failed' }) })
    .finally(() => { actingOn.value = new Set([...actingOn.value].filter(n => n !== name)) })
}

function retry(name: string) {
  withActing(name, async () => { await wizardApi.retryRun(name); await loadRuns() })
}

function confirmRollback(name: string) {
  $q.dialog({
    title: 'Roll Back Run', html: true,
    message: `Roll back <strong>${name}</strong>? Everything it provisioned will be deleted.`,
    ok: { label: 'Roll Back', color: 'warning', flat: true }, cancel: { label: 'Cancel', flat: true },
  }).onOk(() => withActing(name, async () => { await wizardApi.rollbackRun(name); await loadRuns() }))
}

function confirmDelete(name: string) {
  $q.dialog({
    title: 'Delete Run', html: true,
    message: `Delete <strong>${name}</strong>? If it still owns provisioned resources, they are rolled back first. This cannot be undone.`,
    ok: { label: 'Delete', color: 'negative', flat: true }, cancel: { label: 'Cancel', flat: true },
  }).onOk(() => withActing(name, async () => { await wizardApi.deleteRun(name); await loadRuns() }))
}
</script>

<template>
  <div class="page-grid">

    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/wizards')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Wizards
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">Runs</span>
    </div>

    <CanvasPanel title="Wizard Runs" icon="mdi-history" :wide="true" :loading="loading" :error="loadError" @refresh="loadRuns">
      <template #actions>
        <button class="fs-btn fs-btn--ghost fs-btn--sm" @click="togglePolling">
          <q-icon :name="polling ? 'mdi-pause' : 'mdi-play'" size="13px" />
          {{ polling ? 'Auto-refresh on' : 'Auto-refresh off' }}
        </button>
      </template>

      <div class="stats-row">
        <div v-for="p in PHASES" :key="p" class="stat-tile">
          <span class="stat-tile__value">{{ stats[p] ?? 0 }}</span>
          <span class="stat-tile__label">{{ PHASE_LABEL[p] }}</span>
        </div>
      </div>

      <div class="filters-row">
        <select v-model="filterDefinition" class="fs-input fs-select">
          <option value="">All definitions</option>
          <option v-for="d in definitions" :key="d" :value="d">{{ d }}</option>
        </select>
        <select v-model="filterPhase" class="fs-input fs-select">
          <option value="">All phases</option>
          <option v-for="p in PHASES" :key="p" :value="p">{{ PHASE_LABEL[p] }}</option>
        </select>
      </div>

      <table class="runs-table">
        <thead>
          <tr>
            <th>Name</th><th>Definition</th><th>Phase</th><th>Created By</th><th>Created At</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in filteredRuns" :key="r.name"
            class="runs-table__row"
            @click="router.push(`/wizards/runs/${encodeURIComponent(r.name)}`)"
          >
            <td class="fs-mono">{{ r.name }}</td>
            <td>{{ r.definition }}</td>
            <td>
              <span class="phase-badge" :class="`phase-badge--${r.status.phase?.toLowerCase()}`">
                {{ r.status.phase ? PHASE_LABEL[r.status.phase] ?? r.status.phase : 'Unknown' }}
              </span>
            </td>
            <td>{{ r.createdByEmail || r.createdBy || '—' }}</td>
            <td>{{ new Date(r.createdAt).toLocaleString() }}</td>
            <td class="runs-table__actions" @click.stop>
              <button
                v-if="r.status.phase === 'Failed' && can('wizard:runs:retry')"
                class="icon-btn" title="Retry" :disabled="actingOn.has(r.name)"
                @click="retry(r.name)"
              ><q-icon name="mdi-refresh" size="15px" /></button>
              <button
                v-if="r.status.phase !== 'RolledBack' && r.status.phase !== 'RollingBack' && can('wizard:runs:rollback')"
                class="icon-btn" title="Roll back" :disabled="actingOn.has(r.name)"
                @click="confirmRollback(r.name)"
              ><q-icon name="mdi-undo-variant" size="15px" /></button>
              <button
                v-if="can('wizard:runs:delete')"
                class="icon-btn icon-btn--danger" title="Delete" :disabled="actingOn.has(r.name)"
                @click="confirmDelete(r.name)"
              ><q-icon name="mdi-delete-outline" size="15px" /></button>
            </td>
          </tr>
          <tr v-if="filteredRuns.length === 0">
            <td colspan="6" class="runs-table__empty">No wizard runs match these filters.</td>
          </tr>
        </tbody>
      </table>

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

.breadcrumb {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 4px;
}
.breadcrumb__back {
  display: flex; align-items: center; gap: 5px;
  background: none; border: none; padding: 4px 8px; border-radius: 4px;
  cursor: pointer; color: var(--fs-text-muted); font-size: 12px; font-family: inherit;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.breadcrumb__back:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.breadcrumb__current { font-size: 12px; color: var(--fs-accent); font-weight: 500; }
.muted-icon { color: var(--fs-text-muted); }
.fs-mono { font-family: var(--fs-font-mono); }

.stats-row { display: flex; gap: 10px; padding: 12px 10px; flex-wrap: wrap; }
.stat-tile {
  display: flex; flex-direction: column; gap: 2px; min-width: 88px;
  padding: 10px 14px; border: 1px solid var(--fs-border); border-radius: 6px; background: var(--fs-bg-elevated);
}
.stat-tile__value { font-size: 20px; font-weight: 700; color: var(--fs-text-primary); font-family: var(--fs-font-mono); }
.stat-tile__label { font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--fs-text-muted); }

.filters-row { display: flex; gap: 10px; padding: 0 10px 10px; }
.fs-input {
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border); border-radius: 4px;
  padding: 6px 10px; font-size: 12.5px; font-family: inherit; color: var(--fs-text-primary);
  outline: none;
}
.fs-select { cursor: pointer; min-width: 160px; }

.runs-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.runs-table thead th {
  text-align: left; padding: 8px 10px; font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.runs-table__row { cursor: pointer; transition: background var(--fs-ease); }
.runs-table__row:hover { background: var(--fs-bg-hover); }
.runs-table__row td { padding: 8px 10px; border-bottom: 1px solid var(--fs-border); color: var(--fs-text-primary); }
.runs-table__actions { display: flex; gap: 4px; }
.runs-table__empty { text-align: center; color: var(--fs-text-muted); padding: 24px 10px; }

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 4px; border: none; background: transparent;
  color: var(--fs-text-muted); cursor: pointer; transition: color var(--fs-ease), background var(--fs-ease);
}
.icon-btn:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.icon-btn--danger:hover:not(:disabled) { color: var(--fs-neg, #e57373); }

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

.fs-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px;
  border-radius: 4px; font-size: 12.5px; font-family: inherit; font-weight: 500;
  cursor: pointer; border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease), filter var(--fs-ease);
}
.fs-btn--sm { padding: 5px 10px; font-size: 11.5px; }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.fs-btn--ghost:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
</style>
