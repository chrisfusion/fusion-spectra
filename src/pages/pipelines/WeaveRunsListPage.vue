<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import ManagedByFilter from '@/components/ManagedByFilter.vue'
import TimeWindowSelect from '@/components/TimeWindowSelect.vue'
import ListPager from '@/components/ListPager.vue'
import SortTh from '@/components/SortTh.vue'
import * as monitorApi from '@/api/weaveMonitorApi'
import type { RunPhase, WeaveRun } from '@/api/weaveMonitorApi'
import type { ManagedByFilterValue } from '@/utils/managedBy'
import { useRunsPolling } from '@/composables/useRunsPolling'
import { useListQuery } from '@/composables/useListQuery'
import { formatDurationMs, escapeHtml } from '@/utils/format'

// Every WeaveRun, filtered, sorted and paged by weave (GET /runs). Filter options and their counts
// come from GET /runs/facets under the search/owner/time filters. /pipelines/runs/running and
// /failed redirect here with a phase preset.

const router = useRouter()
const $q     = useQuasar()

const PHASES: RunPhase[] = ['Pending', 'Running', 'Succeeded', 'Failed', 'Stopped']

const runs     = ref<WeaveRun[]>([])
const facets   = ref<monitorApi.RunFacets | null>(null)
const loading  = ref(false)
const error    = ref<string | null>(null)
const deleting = ref<Set<string>>(new Set())
const stopping = ref<Set<string>>(new Set())
let   loadSeq  = 0

const list = useListQuery({ defaultSort: '-created', pageSize: 50, load: loadRuns })
const { qs, qa, setQuery, toggleValue, sort, sortBy, search, pager, hasFilters, clearFilters } = list

async function loadRuns() {
  const seq = ++loadSeq
  loading.value = true
  error.value   = null
  const base = list.listParams.value
  try {
    // Facets leave out the phase/chain/trigger filters, so every option keeps its count.
    const [page, f] = await Promise.all([
      monitorApi.listWeaveRuns({
        ...base,
        phase:   qa('phase') as RunPhase[],
        chain:   qa('chain'),
        trigger: qa('trigger'),
      }),
      monitorApi.getRunFacets({ q: base.q, since: base.since, source: base.source }),
    ])
    if (seq !== loadSeq) return   // a newer request superseded this one
    runs.value   = page.items ?? []
    facets.value = f
    list.setPage({ count: runs.value.length, continue: page.metadata?.continue, remaining: page.metadata?.remainingItemCount })
  } catch (e) {
    if (seq === loadSeq) error.value = e instanceof Error ? e.message : 'Failed to load runs'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

const { polling, startPolling, togglePolling } = useRunsPolling(loadRuns)
startPolling()

// Facet keys sorted by name; a value set in the URL stays selectable even without runs.
function facetOptions(dim: 'chain' | 'trigger'): [string, number][] {
  const counts = { ...(facets.value?.[dim] ?? {}) }
  for (const v of qa(dim)) counts[v] ??= 0
  return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
}
const chainOptions   = computed(() => facetOptions('chain'))
const triggerOptions = computed(() => facetOptions('trigger'))

// ─── Row helpers ──────────────────────────────────────────────────────────────

function phase(r: WeaveRun): RunPhase {
  return r.status?.phase ?? 'Pending'
}
function failedSteps(r: WeaveRun): number {
  return (r.status?.steps ?? []).filter(s => s.phase === 'Failed').length
}
function duration(r: WeaveRun): string {
  const start = r.status?.startTime
  if (!start) return '—'
  const end = r.status?.completionTime ? new Date(r.status.completionTime) : new Date()
  return formatDurationMs(end.getTime() - new Date(start).getTime())
}
function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '—'
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function withSet(set: typeof deleting, name: string, fn: () => Promise<void>, failMsg: string) {
  set.value = new Set([...set.value, name])
  fn()
    .then(loadRuns)
    .catch(e => $q.notify({ type: 'negative', message: e instanceof Error ? e.message : failMsg }))
    .finally(() => { set.value = new Set([...set.value].filter(n => n !== name)) })
}

function confirmStop(r: WeaveRun) {
  const name = r.metadata.name
  $q.dialog({
    title: 'Stop Run', html: true,
    message: `Stop run <strong>${escapeHtml(name)}</strong>? The run will be kept in history as Stopped.`,
    ok: { label: 'Stop', color: 'warning', flat: true }, cancel: { label: 'Cancel', flat: true },
  }).onOk(() => withSet(stopping, name, async () => {
    await monitorApi.stopRun(name)
    $q.notify({ type: 'positive', message: `Run ${name} stopped` })
  }, 'Stop failed'))
}

function confirmDelete(r: WeaveRun) {
  const name = r.metadata.name
  $q.dialog({
    title: 'Delete Run', html: true,
    message: `Delete run <strong>${escapeHtml(name)}</strong>? This cannot be undone.`,
    ok: { label: 'Delete', color: 'negative', flat: true }, cancel: { label: 'Cancel', flat: true },
  }).onOk(() => withSet(deleting, name, () => monitorApi.deleteRun(name), 'Delete failed'))
}
</script>

<template>
  <div class="page-grid">
    <CanvasPanel
      title="All Runs"
      icon="mdi-format-list-bulleted"
      :wide="true"
      :loading="loading && runs.length === 0"
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

      <!-- Phase chips (multi-select) with facet counts -->
      <div class="phase-chips">
        <button
          v-for="p in PHASES"
          :key="p"
          class="phase-chip"
          :class="[`phase-chip--${p.toLowerCase()}`, { 'phase-chip--on': qa('phase').includes(p) }]"
          @click="toggleValue('phase', p)"
        >
          {{ p }}
          <span class="phase-chip__count">{{ facets?.phase[p] ?? 0 }}</span>
        </button>
        <span class="phase-chips__total">{{ facets?.total ?? 0 }} total</span>
      </div>

      <div class="toolbar">
        <input v-model="search" class="fs-input search-input" placeholder="Search by name…" />
        <select :value="qs('chain')" class="fs-input" @change="setQuery({ chain: ($event.target as HTMLSelectElement).value })">
          <option value="">All chains</option>
          <option v-for="[c, n] in chainOptions" :key="c" :value="c">{{ c }} ({{ n }})</option>
        </select>
        <select :value="qs('trigger')" class="fs-input" @change="setQuery({ trigger: ($event.target as HTMLSelectElement).value })">
          <option value="">All triggers</option>
          <option v-for="[t, n] in triggerOptions" :key="t" :value="t">{{ t }} ({{ n }})</option>
        </select>
        <ManagedByFilter
          :model-value="(qs('source') as ManagedByFilterValue)"
          server-side
          @update:model-value="v => setQuery({ source: v })"
        />
        <TimeWindowSelect :model-value="qs('since')" @update:model-value="v => setQuery({ since: v })" />
        <button v-if="hasFilters" class="clear-btn" @click="clearFilters">Clear filters</button>
      </div>

      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <SortTh sort-key="name" :current="sort" @sort="sortBy('name')">Name</SortTh>
              <th>Chain</th>
              <th>Trigger</th>
              <th>Phase</th>
              <th>Steps</th>
              <th>Message</th>
              <SortTh sort-key="started" :current="sort" @sort="sortBy('started')">Started</SortTh>
              <SortTh sort-key="duration" :current="sort" @sort="sortBy('duration')">Duration</SortTh>
              <SortTh sort-key="created" :current="sort" @sort="sortBy('created')">Created</SortTh>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in runs"
              :key="r.metadata.name"
              class="clickable-row"
              @click="router.push('/pipelines/runs/' + encodeURIComponent(r.metadata.name))"
            >
              <td class="col-name fs-mono">{{ r.metadata.name }}</td>
              <td class="col-chain fs-mono">{{ r.spec.chainRef.name }}</td>
              <td class="col-chain fs-mono">{{ r.spec.triggerRef?.name ?? 'manual' }}</td>
              <td>
                <span class="phase-badge" :class="`phase-badge--${phase(r).toLowerCase()}`">{{ phase(r) }}</span>
              </td>
              <td class="col-muted">
                {{ r.status?.steps?.length ?? 0 }}
                <span v-if="failedSteps(r)" class="fail-badge">{{ failedSteps(r) }} failed</span>
              </td>
              <td class="col-message" :title="r.status?.message ?? ''">{{ r.status?.message || '—' }}</td>
              <td class="col-muted">{{ formatDate(r.status?.startTime) }}</td>
              <td class="col-muted fs-mono">{{ duration(r) }}</td>
              <td class="col-muted">{{ formatDate(r.metadata.creationTimestamp) }}</td>
              <td class="col-actions" @click.stop>
                <button
                  v-if="phase(r) === 'Running'"
                  class="icon-btn icon-btn--warn"
                  :disabled="stopping.has(r.metadata.name)"
                  title="Stop run (keeps history)"
                  @click="confirmStop(r)"
                >
                  <q-spinner v-if="stopping.has(r.metadata.name)" size="13px" />
                  <q-icon v-else name="mdi-stop-circle-outline" size="16px" />
                </button>
                <button
                  class="icon-btn icon-btn--danger"
                  :disabled="deleting.has(r.metadata.name)"
                  title="Delete run (removes from history)"
                  @click="confirmDelete(r)"
                >
                  <q-spinner v-if="deleting.has(r.metadata.name)" size="13px" />
                  <q-icon v-else name="mdi-delete-outline" size="16px" />
                </button>
              </td>
            </tr>
            <tr v-if="!loading && runs.length === 0">
              <td colspan="10" class="empty-row">{{ hasFilters ? 'No runs match these filters.' : 'No runs yet.' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

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

.phase-chips { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding-bottom: 10px; }
.phase-chips__total { margin-left: auto; font-size: 11px; color: var(--fs-text-muted); }
.phase-chip {
  --chip: var(--fs-text-muted);
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 12px; cursor: pointer;
  font-size: 11.5px; font-weight: 600; font-family: inherit;
  color: var(--chip); background: transparent;
  border: 1px solid color-mix(in srgb, var(--chip) 35%, transparent);
  transition: background var(--fs-ease);
}
.phase-chip:hover  { background: color-mix(in srgb, var(--chip) 8%, transparent); }
.phase-chip--on    { background: color-mix(in srgb, var(--chip) 16%, transparent); border-color: var(--chip); }
.phase-chip__count { font-family: var(--fs-font-mono); font-weight: 500; opacity: 0.85; }
.phase-chip--pending   { --chip: var(--fs-accent); }
.phase-chip--running   { --chip: var(--fs-warn, #ff9800); }
.phase-chip--succeeded { --chip: var(--fs-pos, #81c784); }
.phase-chip--failed    { --chip: var(--fs-neg, #e57373); }

.toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding-bottom: 12px; }
.toolbar select { cursor: pointer; max-width: 220px; }
.search-input { width: 200px; }
.clear-btn {
  margin-left: auto; background: none; border: none; cursor: pointer;
  font-size: 11.5px; color: var(--fs-accent); font-family: inherit;
}
.clear-btn:hover { text-decoration: underline; }

.fs-input {
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--fs-text-primary);
  outline: none;
  box-sizing: border-box;
}
.fs-input:focus { border-color: var(--fs-accent); }

.table-wrap { overflow-x: auto; }
.tpl-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
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

.col-name    { font-weight: 500; color: var(--fs-accent); }
.col-chain   { color: var(--fs-text-muted); font-size: 12px; }
.col-muted   { color: var(--fs-text-muted); font-size: 12px; white-space: nowrap; }
.col-message { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fs-text-muted); font-size: 12px; }
.col-actions { width: 72px; text-align: center; white-space: nowrap; }

.empty-row { text-align: center; color: var(--fs-text-muted); padding: 32px 10px !important; }

.phase-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.phase-badge--pending   { color: var(--fs-accent);         background: color-mix(in srgb, var(--fs-accent)         12%, transparent); }
.phase-badge--running   { color: var(--fs-warn, #ff9800); background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent); }
.phase-badge--succeeded { color: var(--fs-pos, #81c784);  background: color-mix(in srgb, var(--fs-pos, #81c784)  12%, transparent); }
.phase-badge--failed    { color: var(--fs-neg, #e57373);  background: color-mix(in srgb, var(--fs-neg, #e57373)  12%, transparent); }
.phase-badge--stopped   { color: var(--fs-text-muted);    background: color-mix(in srgb, var(--fs-text-muted)    12%, transparent); }

.fail-badge {
  margin-left: 6px;
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
.icon-btn:hover                        { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.icon-btn--active                      { color: var(--fs-accent); }
.icon-btn--danger:hover:not(:disabled) { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }
.icon-btn--warn:hover:not(:disabled)   { color: var(--fs-warn, #ff9800); background: color-mix(in srgb, var(--fs-warn, #ff9800) 10%, transparent); }
.icon-btn:disabled                     { opacity: 0.4; cursor: not-allowed; }

.fs-mono { font-family: var(--fs-font-mono); }
</style>
