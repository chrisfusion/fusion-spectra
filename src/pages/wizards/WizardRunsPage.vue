<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import WizardPhaseBadge from '@/components/WizardPhaseBadge.vue'
import TimeWindowSelect from '@/components/TimeWindowSelect.vue'
import ListPager from '@/components/ListPager.vue'
import SortTh from '@/components/SortTh.vue'
import * as wizardApi from '@/api/wizardApi'
import type { RunPhase } from '@/api/wizardApi'
import { usePermission } from '@/composables/usePermission'
import { useRunsPolling } from '@/composables/useRunsPolling'
import { useListQuery } from '@/composables/useListQuery'
import { useAuthStore } from '@/stores/auth'

// Filtered, sorted and paged by fusion-wizard. No multi-tenancy yet: everyone sees every run;
// "Only mine" narrows to the creator (?mine=1).

const router = useRouter()
const $q     = useQuasar()
const { can } = usePermission()
const auth    = useAuthStore()

const PHASES      = wizardApi.RUN_PHASES
const PHASE_LABEL = wizardApi.RUN_PHASE_LABEL

const runs        = ref<wizardApi.WizardRun[]>([])
const definitions = ref<string[]>([])
const stats       = ref<Partial<Record<RunPhase, number>>>({})
const loading     = ref(true)
const loadError   = ref<string | null>(null)
const actingOn    = ref<Set<string>>(new Set())
let   loadSeq     = 0

const list = useListQuery({ defaultSort: '-created', pageSize: 50, load: loadRuns })
const { qs, qa, setQuery, toggleValue, sort, sortBy, search, pager, hasFilters, clearFilters } = list

async function loadRuns() {
  const seq = ++loadSeq
  loadError.value = null
  // Every filter but phase — the phase tiles count within it.
  const base: wizardApi.WizardRunListParams = {
    ...list.listParams.value,
    definition: qa('definition'),
    createdBy:  qs('mine') ? auth.user?.sub : undefined,
  }
  try {
    // wizard has no facets endpoint: one limit=1 call per phase reads its filtered total.
    const [page, ...totals] = await Promise.all([
      wizardApi.listRuns({ ...base, phase: qa('phase') as RunPhase[] }),
      ...PHASES.map(p => wizardApi.listRuns({ ...base, phase: [p], sort: undefined, continue: undefined, limit: 1 }).then(r => r.total)),
    ])
    if (seq !== loadSeq) return   // a newer request superseded this one
    runs.value  = page.items ?? []
    stats.value = Object.fromEntries(PHASES.map((p, i) => [p, totals[i]]))
    list.setPage({ count: runs.value.length, continue: page.continue, total: page.total })
  } catch (e) {
    if (seq === loadSeq) loadError.value = e instanceof Error ? e.message : 'Failed to load wizard runs'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

onMounted(async () => {
  try { definitions.value = ((await wizardApi.listDefinitions()).items ?? []).map(d => d.name).sort() }
  catch { /* filter options only */ }
})

const { polling, startPolling, togglePolling } = useRunsPolling(loadRuns)
startPolling()

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
        <button
          v-for="p in PHASES" :key="p"
          class="stat-tile" :class="{ 'stat-tile--on': qa('phase').includes(p) }"
          :title="`Show ${PHASE_LABEL[p]} runs`"
          @click="toggleValue('phase', p)"
        >
          <span class="stat-tile__value">{{ stats[p] ?? 0 }}</span>
          <span class="stat-tile__label">{{ PHASE_LABEL[p] }}</span>
        </button>
      </div>

      <div class="filters-row">
        <input v-model="search" class="fs-input" placeholder="Search by name…" />
        <select :value="qs('definition')" class="fs-input fs-select" @change="setQuery({ definition: ($event.target as HTMLSelectElement).value })">
          <option value="">All definitions</option>
          <option v-for="d in definitions" :key="d" :value="d">{{ d }}</option>
        </select>
        <TimeWindowSelect :model-value="qs('since')" @update:model-value="v => setQuery({ since: v })" />
        <label class="mine-toggle">
          <input type="checkbox" :checked="!!qs('mine')" @change="setQuery({ mine: ($event.target as HTMLInputElement).checked ? '1' : undefined })" />
          Only mine
        </label>
        <label class="mine-toggle" title="Runs applied by Flux from a GitOps repo">
          <input type="checkbox" :checked="qa('source').includes('gitops')" @change="setQuery({ source: ($event.target as HTMLInputElement).checked ? 'gitops' : undefined })" />
          From GitOps
        </label>
        <button v-if="hasFilters" class="clear-btn" @click="clearFilters">Clear filters</button>
      </div>

      <table class="runs-table">
        <thead>
          <tr>
            <SortTh sort-key="name" :current="sort" @sort="sortBy('name')">Name</SortTh>
            <SortTh sort-key="definition" :current="sort" @sort="sortBy('definition', false)">Definition</SortTh>
            <SortTh sort-key="phase" :current="sort" @sort="sortBy('phase', false)">Phase</SortTh>
            <th>Created By</th>
            <SortTh sort-key="created" :current="sort" @sort="sortBy('created')">Created At</SortTh>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in runs" :key="r.name"
            class="runs-table__row"
            @click="router.push(`/wizards/runs/${encodeURIComponent(r.name)}`)"
          >
            <td class="fs-mono">{{ r.name }}</td>
            <td>{{ r.definition }}</td>
            <td>
              <WizardPhaseBadge :phase="r.status.phase" />
            </td>
            <td>{{ r.createdByEmail || r.createdBy || '—' }}</td>
            <td>{{ new Date(r.createdAt).toLocaleString() }}</td>
            <td class="runs-table__actions" @click.stop>
              <button
                class="icon-btn" title="Logs"
                @click="router.push({ path: `/wizards/runs/${encodeURIComponent(r.name)}`, query: { logs: '1' } })"
              ><q-icon name="mdi-text-box-outline" size="15px" /></button>
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
          <tr v-if="!loading && runs.length === 0">
            <td colspan="6" class="runs-table__empty">No wizard runs match these filters.</td>
          </tr>
        </tbody>
      </table>

      <ListPager v-bind="pager" noun="runs" @prev="list.prevPage" @next="list.nextPage" />
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
button.stat-tile { font-family: inherit; text-align: left; cursor: pointer; transition: border-color var(--fs-ease), background var(--fs-ease); }
button.stat-tile:hover { border-color: var(--fs-accent); }
.stat-tile--on { border-color: var(--fs-accent); background: color-mix(in srgb, var(--fs-accent) 10%, var(--fs-bg-elevated)); }
.stat-tile__value { font-size: 20px; font-weight: 700; color: var(--fs-text-primary); font-family: var(--fs-font-mono); }
.stat-tile__label { font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--fs-text-muted); }

.filters-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 0 10px 10px; }
.clear-btn {
  margin-left: auto; background: none; border: none; cursor: pointer;
  font-size: 11.5px; color: var(--fs-accent); font-family: inherit;
}
.clear-btn:hover { text-decoration: underline; }
.fs-input {
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border); border-radius: 4px;
  padding: 6px 10px; font-size: 12.5px; font-family: inherit; color: var(--fs-text-primary);
  outline: none;
}
.fs-select { cursor: pointer; min-width: 160px; }
.mine-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--fs-text-secondary); cursor: pointer; }

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
