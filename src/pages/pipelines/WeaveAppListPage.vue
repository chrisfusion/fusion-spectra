<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as monitorApi from '@/api/weaveMonitorApi'
import { useRunsPolling } from '@/composables/useRunsPolling'
import { useListQuery } from '@/composables/useListQuery'
import ManagedByBadge from '@/components/ManagedByBadge.vue'
import ManagedByFilter from '@/components/ManagedByFilter.vue'
import ListPager from '@/components/ListPager.vue'
import SortTh from '@/components/SortTh.vue'
import type { ManagedByFilterValue } from '@/utils/managedBy'
import { appSource, lastExecution } from '@/utils/weaveApp'

// WeaveApps — single-resource services/jobs, created by the wizards (or the API). Read-only list;
// image changes and "Run now" live on the detail page. Filtered, sorted and paged by weave.

const router = useRouter()

const APP_PHASES = ['Pending', 'Ready', 'Running', 'Invalid']

const apps    = ref<monitorApi.WeaveApp[]>([])
const loading = ref(false)
const error   = ref<string | null>(null)
let   loadSeq = 0

const list = useListQuery({ defaultSort: '-created', pageSize: 50, load: loadApps })
const { qs, qb, setQuery, sortBy, sort, search, pager, hasFilters, clearFilters } = list

async function loadApps() {
  const seq = ++loadSeq
  loading.value = true
  error.value   = null
  try {
    const page = await monitorApi.listApps({
      ...list.listParams.value,
      type:    qs('type') ? [qs('type') as 'service' | 'job'] : undefined,
      phase:   qs('phase') ? [qs('phase')] : undefined,
      running: qb('running'),
    })
    if (seq !== loadSeq) return   // a newer request superseded this one
    apps.value = page.items ?? []
    list.setPage({ count: apps.value.length, continue: page.metadata?.continue, remaining: page.metadata?.remainingItemCount })
  } catch (e) {
    if (seq === loadSeq) error.value = e instanceof Error ? e.message : 'Failed to load apps'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

const { polling, startPolling, togglePolling } = useRunsPolling(loadApps)
startPolling()

function phase(a: monitorApi.WeaveApp): string {
  return a.status?.phase ?? 'Pending'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}
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
        <input v-model="search" class="type-select search-input" placeholder="Search by name…" />
        <select :value="qs('type')" class="type-select" @change="setQuery({ type: ($event.target as HTMLSelectElement).value })">
          <option value="">All types</option>
          <option value="service">Services</option>
          <option value="job">Jobs</option>
        </select>
        <select :value="qs('phase')" class="type-select" @change="setQuery({ phase: ($event.target as HTMLSelectElement).value })">
          <option value="">All phases</option>
          <option v-for="p in APP_PHASES" :key="p" :value="p">{{ p }}</option>
        </select>
        <ManagedByFilter
          :model-value="(qs('source') as ManagedByFilterValue)"
          server-side
          @update:model-value="v => setQuery({ source: v })"
        />
        <label class="check-toggle" title="Apps with an execution running right now">
          <input type="checkbox" :checked="qb('running') === true" @change="setQuery({ running: ($event.target as HTMLInputElement).checked ? 'true' : undefined })" />
          Executing now
        </label>
        <button v-if="hasFilters" class="clear-btn" @click="clearFilters">Clear filters</button>
      </div>

      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <SortTh sort-key="name" :current="sort" @sort="sortBy('name')">Name</SortTh>
              <th>Type</th>
              <th>Source</th>
              <th>Owner</th>
              <th>Phase</th>
              <SortTh sort-key="lastExecution" :current="sort" @sort="sortBy('lastExecution')">Last execution</SortTh>
              <SortTh sort-key="created" :current="sort" @sort="sortBy('created')">Created</SortTh>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in apps"
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
            <tr v-if="!loading && apps.length === 0">
              <td colspan="7" class="empty-row">
                <template v-if="hasFilters">No apps match these filters.</template>
                <template v-else>No apps found — the Image and Git → Python wizards create them.</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ListPager v-bind="pager" noun="apps" @prev="list.prevPage" @next="list.nextPage" />
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
  flex-wrap: wrap;
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

.search-input { width: 200px; cursor: text; }
.check-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fs-text-muted); cursor: pointer; }
.clear-btn {
  margin-left: auto; background: none; border: none; cursor: pointer;
  font-size: 11.5px; color: var(--fs-accent); font-family: inherit;
}
.clear-btn:hover { text-decoration: underline; }

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
