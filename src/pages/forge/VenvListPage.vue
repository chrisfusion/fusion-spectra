<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as forgeApi from '@/api/forgeApi'

const router = useRouter()

const PAGE_SIZE = 20

type StatusChip = 'ALL' | forgeApi.VenvBuild['status']
const STATUS_CHIPS: StatusChip[] = ['ALL', 'PENDING', 'BUILDING', 'SUCCEEDED', 'FAILED']

const selectedStatuses = ref<StatusChip[]>(['ALL'])
const nameSearch       = ref('')
const currentPage      = ref(1)

const loading = ref(false)
const error   = ref<string | null>(null)
const result  = ref<forgeApi.VenvPage | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function loadBuilds() {
  loading.value = true
  error.value   = null
  try {
    const statuses = selectedStatuses.value.includes('ALL')
      ? undefined
      : selectedStatuses.value as string[]
    result.value = await forgeApi.listVenvs({
      page:     currentPage.value - 1,
      pageSize: PAGE_SIZE,
      name:     nameSearch.value.trim() || undefined,
      status:   statuses,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load builds'
  } finally {
    loading.value = false
  }
}

function scheduleLoad() {
  currentPage.value = 1
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadBuilds, 300)
}

function toggleStatus(chip: StatusChip) {
  if (chip === 'ALL') {
    selectedStatuses.value = ['ALL']
  } else {
    const without = selectedStatuses.value.filter(s => s !== 'ALL')
    const idx = without.indexOf(chip)
    if (idx !== -1) {
      without.splice(idx, 1)
      selectedStatuses.value = without.length === 0 ? ['ALL'] : without
    } else {
      selectedStatuses.value = [...without, chip]
    }
  }
  currentPage.value = 1
  loadBuilds()
}

function isActiveChip(chip: StatusChip) {
  return selectedStatuses.value.includes(chip)
}

watch(currentPage, loadBuilds)
onMounted(loadBuilds)

function openBuild(b: forgeApi.VenvBuild) {
  router.push(`/forge/venvs/${b.id}`)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

const STATUS_ICON: Record<forgeApi.VenvBuild['status'], string> = {
  PENDING:   'mdi-clock-outline',
  BUILDING:  'mdi-cog-sync-outline',
  SUCCEEDED: 'mdi-check-circle-outline',
  FAILED:    'mdi-alert-circle-outline',
}
</script>

<template>
  <div class="page-grid">
    <CanvasPanel
      title="Venv Builds"
      icon="mdi-list-box-outline"
      :wide="true"
      :loading="loading"
      :error="error ?? undefined"
      @refresh="loadBuilds"
    >
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="chips">
          <button
            v-for="chip in STATUS_CHIPS"
            :key="chip"
            class="chip"
            :class="[`chip--${chip.toLowerCase()}`, { 'chip--active': isActiveChip(chip) }]"
            @click="toggleStatus(chip)"
          >{{ chip }}</button>
        </div>
        <input
          v-model="nameSearch"
          class="fs-input search-input"
          placeholder="Search by name…"
          @input="scheduleLoad"
        />
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <table class="builds-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Version</th>
              <th>Status</th>
              <th>Build Type</th>
              <th>Creator</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="b in result?.items ?? []"
              :key="b.id"
              class="build-row"
              @click="openBuild(b)"
            >
              <td class="col-name fs-mono">{{ b.name }}</td>
              <td class="col-version fs-mono">{{ b.version }}</td>
              <td>
                <span class="status-badge" :class="`status--${b.status.toLowerCase()}`">
                  <q-icon :name="STATUS_ICON[b.status]" size="12px" />
                  {{ b.status }}
                </span>
              </td>
              <td class="col-muted">{{ b.buildType }}</td>
              <td class="col-muted">{{ b.creatorEmail ?? '—' }}</td>
              <td class="col-muted">{{ formatDate(b.createdAt) }}</td>
            </tr>
            <tr v-if="!loading && (result?.items ?? []).length === 0">
              <td colspan="6" class="empty-row">No builds found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="(result?.total ?? 0) > PAGE_SIZE" class="pagination-row">
        <q-pagination
          v-model="currentPage"
          :max="Math.ceil((result?.total ?? 0) / PAGE_SIZE)"
          :max-pages="7"
          direction-links
          boundary-links
          size="sm"
          color="grey"
          active-color="primary"
        />
        <span class="pagination-hint">{{ result?.total ?? 0 }} total</span>
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

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 0 12px;
  flex-wrap: wrap;
}
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid var(--fs-border);
  background: var(--fs-bg-hover);
  color: var(--fs-text-muted);
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease);
}
.chip:hover { color: var(--fs-text-primary); border-color: var(--fs-border-bright, var(--fs-border)); }

.chip--all.chip--active       { background: var(--fs-accent);            border-color: var(--fs-accent);            color: #fff; }
.chip--pending.chip--active   { background: var(--fs-accent);            border-color: var(--fs-accent);            color: #fff; }
.chip--building.chip--active  { background: var(--fs-warn, #ff9800);     border-color: var(--fs-warn, #ff9800);     color: #fff; }
.chip--succeeded.chip--active { background: var(--fs-pos, #4caf50);      border-color: var(--fs-pos, #4caf50);      color: #fff; }
.chip--failed.chip--active    { background: var(--fs-neg, #e57373);      border-color: var(--fs-neg, #e57373);      color: #fff; }

.search-input {
  margin-left: auto;
  width: 200px;
  flex-shrink: 0;
}

/* Table */
.table-wrap { overflow-x: auto; }
.builds-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.builds-table th {
  text-align: left;
  padding: 6px 10px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.builds-table td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--fs-border);
  color: var(--fs-text-primary);
  vertical-align: middle;
}
.builds-table tbody tr:last-child td { border-bottom: none; }

.build-row { cursor: pointer; transition: background var(--fs-ease); }
.build-row:hover td { background: var(--fs-bg-hover); }

.col-name    { font-weight: 500; }
.col-version { color: var(--fs-text-muted); font-size: 12px; }
.col-muted   { color: var(--fs-text-muted); font-size: 12px; }

.empty-row { text-align: center; color: var(--fs-text-muted); padding: 32px 10px !important; }

/* Status badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
}
.status--pending   { color: var(--fs-accent);       background: color-mix(in srgb, var(--fs-accent)       10%, transparent); }
.status--building  { color: var(--fs-warn, #ff9800); background: color-mix(in srgb, var(--fs-warn, #ff9800) 10%, transparent); }
.status--succeeded { color: var(--fs-pos, #4caf50);  background: color-mix(in srgb, var(--fs-pos, #4caf50)  10%, transparent); }
.status--failed    { color: var(--fs-neg, #e57373);  background: color-mix(in srgb, var(--fs-neg, #e57373)  10%, transparent); }

/* Pagination */
.pagination-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 12px;
}
.pagination-hint { font-size: 11px; color: var(--fs-text-muted); }

/* Shared input */
.fs-input {
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--fs-text-primary);
  outline: none;
  transition: border-color var(--fs-ease);
  box-sizing: border-box;
}
.fs-input:focus { border-color: var(--fs-accent); }
.fs-mono { font-family: var(--fs-font-mono); }
</style>
