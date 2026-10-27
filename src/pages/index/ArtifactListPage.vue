<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { formatSize } from '@/utils/format'
import * as indexApi from '@/api/indexApi'
import type { Artifact, ArtifactSort, ArtifactListParams, TypeResponse } from '@/api/indexApi'
import { ARTIFACT_LIST_PATH, ARTIFACT_VIEWS, type ArtifactListQuery, type ArtifactView } from './artifactListQuery'

const route  = useRoute()
const router = useRouter()

const PAGE_SIZES = [20, 50, 100]
const MB  = 1_048_576
const DAY = 86_400_000

// ─── Query (single source of truth) ───────────────────────────────────────────

function qs(key: string): string {
  const v = route.query[key]
  return typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? '') : ''
}
function qa(key: string): string[] {
  const v = route.query[key]
  return (Array.isArray(v) ? v : v ? [v] : []).filter((x): x is string => !!x)
}
function qn(key: string): number | undefined {
  const s = qs(key)
  if (s === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}
function qb(key: string): boolean | undefined {
  const s = qs(key)
  return s === 'true' ? true : s === 'false' ? false : undefined
}

const sort     = computed<ArtifactSort>(() => (qs('sort') as ArtifactSort) || 'createdAt')
const order    = computed<'asc' | 'desc'>(() => (qs('order') as 'asc' | 'desc') || (sort.value === 'name' ? 'asc' : 'desc'))
const page     = computed(() => Math.max(1, qn('page') ?? 1))   // 1-based in the UI and URL
const pageSize = computed(() => PAGE_SIZES.includes(qn('size') ?? 0) ? qn('size')! : PAGE_SIZES[0])

const params = computed<ArtifactListParams>(() => {
  const days = qn('olderThanDays'), mb = qn('minTotalMB')
  return {
    name:               qs('name') || undefined,
    type:               qa('type'),
    tag:                qs('tag') || undefined,
    missingTag:         qs('missingTag') || undefined,
    olderThan:          days !== undefined ? new Date(Date.now() - days * DAY).toISOString() : undefined,
    minVersions:        qn('minVersions'),
    maxVersions:        qn('maxVersions'),
    hasFiles:           qb('hasFiles'),
    hasIncompleteFiles: qb('hasIncompleteFiles'),
    minTotalBytes:      qn('minTotalMB') !== undefined ? Math.round(mb! * MB) : undefined,
    hasRetention:       qb('hasRetention'),
    sort:               sort.value,
    order:              order.value,
    page:               page.value - 1,
    pageSize:           pageSize.value,
  }
})

// Merge a patch into the query; empty values drop the key. Filter changes go back to page 1.
function setQuery(patch: ArtifactListQuery, opts: { keepPage?: boolean; replace?: boolean } = {}) {
  const next: LocationQueryRaw = { ...route.query, ...patch }
  if (!opts.keepPage) delete next.page
  for (const k of Object.keys(next)) {
    const v = next[k]
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) delete next[k]
  }
  const to = { path: ARTIFACT_LIST_PATH, query: next }
  return opts.replace ? router.replace(to) : router.push(to)
}

// ─── Active filters (chips) ───────────────────────────────────────────────────

const yesNo = (v: string, yes: string, no: string) => (v === 'true' ? yes : no)

const FILTER_LABELS: Record<string, (v: string) => string> = {
  name:               v => `name: ${v}…`,
  tag:                v => `tag: ${v}`,
  missingTag:         v => `without tag: ${v}`,
  olderThanDays:      v => `created > ${v} d ago`,
  minVersions:        v => `≥ ${v} versions`,
  maxVersions:        v => (v === '0' ? 'no versions' : `≤ ${v} versions`),
  hasFiles:           v => yesNo(v, 'has files', 'no files'),
  hasIncompleteFiles: v => yesNo(v, 'failed uploads', 'no failed uploads'),
  minTotalMB:         v => `≥ ${v} MB total`,
  hasRetention:       v => yesNo(v, 'with retention', 'without retention'),
}

const activeChips = computed(() => {
  const chips: { key: string; value?: string; label: string }[] = []
  for (const t of qa('type')) chips.push({ key: 'type', value: t, label: `type: ${t}` })
  for (const [key, label] of Object.entries(FILTER_LABELS)) {
    const v = qs(key)
    if (v !== '') chips.push({ key, label: label(v) })
  }
  return chips
})
const hasFilters = computed(() => activeChips.value.length > 0)

function removeChip(c: { key: string; value?: string }) {
  if (c.key === 'type') setQuery({ type: qa('type').filter(t => t !== c.value) })
  else setQuery({ [c.key]: undefined })
}

function clearFilters() {
  // Keep sort and page size — only filters go
  router.push({ path: ARTIFACT_LIST_PATH, query: { sort: qs('sort') || undefined, order: qs('order') || undefined, size: qs('size') || undefined } })
}

// ─── Quick views ──────────────────────────────────────────────────────────────

function viewActive(v: ArtifactView): boolean {
  return Object.entries(v.query).every(([k, val]) => qs(k) === val)
}
function toggleView(v: ArtifactView) {
  const off = Object.fromEntries(Object.keys(v.query).map(k => [k, undefined]))
  setQuery(viewActive(v) ? off : v.query)
}

// ─── Search / tag / types / more filters ──────────────────────────────────────

const searchInput = ref(qs('name'))
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchInput, v => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { if (v !== qs('name')) setQuery({ name: v.trim() }, { replace: true }) }, 300)
})

const tagMode  = ref<'has' | 'missing'>(qs('missingTag') && !qs('tag') ? 'missing' : 'has')
const tagInput = ref(qs('tag') || qs('missingTag'))
function applyTag() {
  const v = tagInput.value.trim()
  const [curTag, curMissing] = tagMode.value === 'has' ? [v, ''] : ['', v]
  if (curTag === qs('tag') && curMissing === qs('missingTag')) return   // blur without change
  setQuery(tagMode.value === 'has' ? { tag: v, missingTag: undefined } : { missingTag: v, tag: undefined })
}

const types       = ref<TypeResponse[]>([])
const typesFailed = ref(false)   // GET /types needs index:types:manage at the BFF — viewers can't filter by type
function toggleType(name: string) {
  const cur = qa('type')
  setQuery({ type: cur.includes(name) ? cur.filter(t => t !== name) : [...cur, name] })
}

const ADVANCED_KEYS = ['olderThanDays', 'minVersions', 'maxVersions', 'hasFiles', 'hasIncompleteFiles', 'minTotalMB', 'hasRetention']
const moreOpen = ref(ADVANCED_KEYS.some(k => qs(k) !== ''))
const advancedCount = computed(() => ADVANCED_KEYS.filter(k => qs(k) !== '').length)

function onAdvanced(key: string, e: Event) {
  setQuery({ [key]: (e.target as HTMLInputElement | HTMLSelectElement).value.trim() })
}

// Keep the inputs in sync when the query changes from outside (back/forward, chips, views)
watch(() => route.query, () => {
  if (searchInput.value.trim() !== qs('name')) searchInput.value = qs('name')
  if (qs('tag'))             { tagMode.value = 'has';     tagInput.value = qs('tag') }
  else if (qs('missingTag')) { tagMode.value = 'missing'; tagInput.value = qs('missingTag') }
  else                       tagInput.value = ''
})

// ─── Sorting ──────────────────────────────────────────────────────────────────

function sortBy(key: ArtifactSort) {
  if (sort.value === key) setQuery({ sort: key, order: order.value === 'asc' ? 'desc' : 'asc' })
  else setQuery({ sort: key, order: undefined })   // each column's default order
}
function sortIcon(key: ArtifactSort): string {
  if (sort.value !== key) return 'mdi-swap-vertical'
  return order.value === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'
}

// ─── Data loading ─────────────────────────────────────────────────────────────

const artifacts = ref<Artifact[]>([])
const total     = ref(0)
const loading   = ref(true)
const error     = ref<string | null>(null)
let   loadSeq   = 0

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

async function load() {
  const seq = ++loadSeq
  loading.value = true
  error.value   = null
  try {
    const res = await indexApi.listArtifacts(params.value)
    if (seq !== loadSeq) return   // a newer request superseded this one
    artifacts.value = res.items ?? []
    total.value     = res.total
  } catch (e) {
    if (seq === loadSeq) error.value = e instanceof Error ? e.message : 'Failed to load artifacts'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

watch(() => route.fullPath, () => { if (route.path === ARTIFACT_LIST_PATH) load() })

onMounted(async () => {
  load()
  try { types.value = await indexApi.listTypes() ?? [] }
  catch { typesFailed.value = true }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 60 ? `${d}d ago` : new Date(iso).toLocaleDateString()
}

const detailPath = (a: Artifact) => `/fusion-index/artifacts/${a.id}`

// Whole row is clickable; the name cell is a real link (middle-click / ctrl-click → new tab)
function onRowClick(a: Artifact, e: MouseEvent) {
  if ((e.target as HTMLElement).closest('a')) return
  if (e.ctrlKey || e.metaKey) window.open(router.resolve(detailPath(a)).href, '_blank')
  else router.push(detailPath(a))
}

const SORT_COLUMNS: { key: ArtifactSort; label: string; numeric?: boolean }[] = [
  { key: 'versionCount',   label: 'Versions',        numeric: true },
  { key: 'totalSize',      label: 'Total size',      numeric: true },
  { key: 'largestVersion', label: 'Largest version', numeric: true },
  { key: 'createdAt',      label: 'Created' },
]
</script>

<template>
  <div class="page-grid">
    <CanvasPanel
      title="Artifact Registry"
      icon="mdi-package-variant-closed"
      :wide="true"
      :loading="loading"
      :error="error"
      @refresh="load"
    >
      <template #actions>
        <router-link to="/fusion-index/artifacts/create" class="create-link">
          <q-icon name="mdi-plus" size="14px" /> New artifact
        </router-link>
      </template>

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="field field--search">
          <q-icon name="mdi-magnify" size="15px" class="muted-icon" />
          <input v-model="searchInput" class="field__input fs-mono" placeholder="Filter by name prefix…" type="text" />
          <q-icon v-if="searchInput" name="mdi-close" size="14px" class="muted-icon field__clear" @click="searchInput = ''" />
        </div>

        <button v-if="!typesFailed" class="bar-btn" :class="{ 'bar-btn--active': qa('type').length }">
          <q-icon name="mdi-shape-outline" size="14px" />
          Types<span v-if="qa('type').length" class="bar-btn__count">{{ qa('type').length }}</span>
          <q-icon name="mdi-chevron-down" size="14px" />
          <q-menu anchor="bottom left" self="top left" :offset="[0, 4]">
            <div class="type-menu">
              <div v-if="types.length === 0" class="muted-text type-menu__empty">No types defined</div>
              <label v-for="t in types" :key="t.id" class="type-menu__item">
                <input type="checkbox" :checked="qa('type').includes(t.name)" @change="toggleType(t.name)" />
                <span class="fs-mono">{{ t.name }}</span>
              </label>
            </div>
          </q-menu>
        </button>

        <div class="field field--tag">
          <select v-model="tagMode" class="field__mode" @change="tagInput && applyTag()">
            <option value="has">has tag</option>
            <option value="missing">missing tag</option>
          </select>
          <input v-model="tagInput" class="field__input fs-mono" placeholder="latest" @keyup.enter="applyTag" @blur="applyTag" />
        </div>

        <button class="bar-btn" :class="{ 'bar-btn--active': advancedCount }" @click="moreOpen = !moreOpen">
          <q-icon name="mdi-tune-variant" size="14px" />
          More filters<span v-if="advancedCount" class="bar-btn__count">{{ advancedCount }}</span>
          <q-icon :name="moreOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="14px" />
        </button>

        <span class="muted-text filter-bar__count">{{ total }} artifact{{ total === 1 ? '' : 's' }}</span>
      </div>

      <!-- More filters -->
      <div v-if="moreOpen" class="more-filters">
        <label class="more-filters__row">
          <span>Versions</span>
          <input type="number" min="0" class="mini" placeholder="min" :value="qs('minVersions')" @change="onAdvanced('minVersions', $event)" />
          <span class="muted-text">–</span>
          <input type="number" min="0" class="mini" placeholder="max" :value="qs('maxVersions')" @change="onAdvanced('maxVersions', $event)" />
        </label>
        <label class="more-filters__row">
          <span>Created before</span>
          <input type="number" min="1" class="mini" placeholder="—" :value="qs('olderThanDays')" @change="onAdvanced('olderThanDays', $event)" />
          <span class="muted-text">days ago</span>
        </label>
        <label class="more-filters__row">
          <span>Total size ≥</span>
          <input type="number" min="0" step="any" class="mini" placeholder="—" :value="qs('minTotalMB')" @change="onAdvanced('minTotalMB', $event)" />
          <span class="muted-text">MB</span>
        </label>
        <label class="more-filters__row">
          <span>Files</span>
          <select class="mini mini--select" :value="qs('hasFiles')" @change="onAdvanced('hasFiles', $event)">
            <option value="">any</option><option value="true">has files</option><option value="false">no files</option>
          </select>
        </label>
        <label class="more-filters__row">
          <span>Failed uploads</span>
          <select class="mini mini--select" :value="qs('hasIncompleteFiles')" @change="onAdvanced('hasIncompleteFiles', $event)">
            <option value="">any</option><option value="true">has PENDING/ERROR</option><option value="false">none</option>
          </select>
        </label>
        <label class="more-filters__row">
          <span>Retention</span>
          <select class="mini mini--select" :value="qs('hasRetention')" @change="onAdvanced('hasRetention', $event)">
            <option value="">any</option><option value="true">rule applies</option><option value="false">no rule</option>
          </select>
        </label>
      </div>

      <!-- Quick views + active filters -->
      <div class="chip-row">
        <button
          v-for="v in ARTIFACT_VIEWS" :key="v.id"
          class="view-chip" :class="{ 'view-chip--active': viewActive(v) }"
          @click="toggleView(v)"
        >
          <q-icon :name="v.icon" size="13px" />{{ v.label }}
        </button>
        <template v-if="hasFilters">
          <span class="chip-row__sep" />
          <span v-for="c in activeChips" :key="c.key + (c.value ?? '')" class="filter-chip">
            {{ c.label }}
            <q-icon name="mdi-close" size="12px" class="filter-chip__x" @click="removeChip(c)" />
          </span>
          <button class="link-btn" @click="clearFilters">Clear all</button>
        </template>
      </div>

      <!-- Table -->
      <table class="data-table">
        <thead>
          <tr>
            <th class="th-sort" @click="sortBy('name')">
              Name <q-icon :name="sortIcon('name')" size="12px" :class="{ 'sort-off': sort !== 'name' }" />
            </th>
            <th>Types</th>
            <th
              v-for="c in SORT_COLUMNS" :key="c.key"
              class="th-sort" :class="{ 'num': c.numeric }"
              @click="sortBy(c.key)"
            >
              {{ c.label }} <q-icon :name="sortIcon(c.key)" size="12px" :class="{ 'sort-off': sort !== c.key }" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && artifacts.length === 0">
            <td colspan="6" class="empty-row">
              <template v-if="hasFilters">
                No artifacts match these filters.
                <button class="link-btn" @click="clearFilters">Clear filters</button>
              </template>
              <template v-else>
                The registry is empty.
                <router-link to="/fusion-index/artifacts/create" class="link-btn">Create the first artifact</router-link>
              </template>
            </td>
          </tr>
          <tr v-for="a in artifacts" :key="a.id" class="artifact-row" @click="onRowClick(a, $event)">
            <td class="name-cell">
              <router-link :to="detailPath(a)" class="name-cell__link fs-mono">
                <q-icon name="mdi-package-variant-closed" size="13px" class="muted-icon" />
                {{ a.fullName }}
              </router-link>
              <div v-if="a.description" class="name-cell__desc">{{ a.description }}</div>
            </td>
            <td>
              <div class="type-chips">
                <span v-for="t in (a.types ?? [])" :key="t.id" class="fs-badge fs-badge--info">{{ t.name }}</span>
                <span v-if="!(a.types?.length)" class="muted-text">—</span>
              </div>
            </td>
            <td class="num fs-mono">{{ a.versionCount ?? '—' }}</td>
            <td class="num fs-mono">{{ formatSize(a.totalBytes) }}</td>
            <td class="num fs-mono">{{ formatSize(a.largestVersionBytes) }}</td>
            <td class="muted-text fs-mono">
              {{ relativeTime(a.createdAt) }}
              <q-tooltip anchor="top middle" self="bottom middle" :delay="400">{{ new Date(a.createdAt).toLocaleString() }}</q-tooltip>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="total > 0" class="pagination-row">
        <div class="pagination-row__size muted-text">
          Rows
          <select class="mini mini--select" :value="pageSize" @change="setQuery({ size: ($event.target as HTMLSelectElement).value })">
            <option v-for="s in PAGE_SIZES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <q-pagination
          v-if="totalPages > 1"
          :model-value="page"
          :max="totalPages"
          :max-pages="7"
          boundary-numbers
          direction-links
          color="grey-7"
          active-color="primary"
          size="sm"
          @update:model-value="(p: number) => setQuery({ page: String(p) }, { keepPage: true })"
        />
        <span class="muted-text pagination-row__info">
          {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, total) }} of {{ total }}
        </span>
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

.create-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--fs-accent);
  text-decoration: none;
  margin-right: 6px;
}
.create-link:hover { text-decoration: underline; }

/* Filter bar */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 2px 10px;
}
.field {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border-bright);
  border-radius: 4px;
}
.field:focus-within {
  border-color: var(--fs-accent);
  box-shadow: 0 0 0 2px var(--fs-accent-soft);
}
.field--search { flex: 1; min-width: 220px; }
.field--tag    { width: 230px; padding-left: 0; }
.field__input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  color: var(--fs-text-primary);
  font-size: 12px;
}
.field__input::placeholder { color: var(--fs-text-muted); }
.field__clear { cursor: pointer; }
.field__mode {
  height: 100%;
  background: var(--fs-bg-hover);
  border: none;
  border-right: 1px solid var(--fs-border);
  border-radius: 4px 0 0 4px;
  color: var(--fs-text-secondary, var(--fs-text-muted));
  font: inherit;
  font-size: 11.5px;
  padding: 0 6px;
  outline: none;
  cursor: pointer;
}

.bar-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 10px;
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border-bright);
  border-radius: 4px;
  color: var(--fs-text-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.bar-btn:hover { border-color: var(--fs-accent); }
.bar-btn--active { border-color: var(--fs-accent); color: var(--fs-accent); }
.bar-btn__count {
  min-width: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--fs-accent);
  color: var(--fs-bg-base, #fff);
  font-size: 10.5px;
  font-weight: 700;
  text-align: center;
}
.filter-bar__count { margin-left: auto; white-space: nowrap; }

.type-menu {
  min-width: 200px;
  max-height: 320px;
  overflow-y: auto;
  padding: 6px 0;
  background: var(--fs-bg-elevated);
}
.type-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--fs-text-primary);
}
.type-menu__item:hover { background: var(--fs-bg-hover); }
.type-menu__empty { padding: 6px 12px; }

/* More filters */
.more-filters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px 20px;
  padding: 10px 12px;
  margin-bottom: 10px;
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  background: var(--fs-bg-surface);
}
.more-filters__row {
  display: grid;
  grid-template-columns: 105px auto auto auto;
  justify-content: start;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--fs-text-muted);
}
.mini {
  width: 72px;
  height: 26px;
  padding: 0 6px;
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border-bright);
  border-radius: 4px;
  color: var(--fs-text-primary);
  font: inherit;
  font-size: 12px;
  outline: none;
}
.mini:focus { border-color: var(--fs-accent); }
.mini--select { width: auto; cursor: pointer; }

/* Quick views + active filters */
.chip-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 2px 10px;
  border-bottom: 1px solid var(--fs-border);
  margin-bottom: 4px;
}
.chip-row__sep { width: 1px; height: 18px; background: var(--fs-border); margin: 0 4px; }
.view-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border: 1px dashed var(--fs-border-bright);
  border-radius: 12px;
  background: none;
  color: var(--fs-text-muted);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}
.view-chip:hover { color: var(--fs-text-primary); border-color: var(--fs-accent); }
.view-chip--active {
  border-style: solid;
  border-color: var(--fs-accent);
  color: var(--fs-accent);
  background: var(--fs-accent-soft);
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 9px;
  border-radius: 12px;
  background: var(--fs-bg-hover);
  border: 1px solid var(--fs-border);
  font-size: 11.5px;
  color: var(--fs-text-primary);
}
.filter-chip__x { cursor: pointer; color: var(--fs-text-muted); }
.filter-chip__x:hover { color: var(--fs-neg, #e57373); }
.link-btn {
  background: none;
  border: none;
  padding: 0 4px;
  color: var(--fs-accent);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  text-decoration: none;
}
.link-btn:hover { text-decoration: underline; }

/* Table */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.data-table th {
  text-align: left;
  padding: 8px 10px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
  white-space: nowrap;
}
.th-sort { cursor: pointer; user-select: none; }
.th-sort:hover { color: var(--fs-text-primary); }
.sort-off { opacity: 0.35; }
.data-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--fs-border-dim);
  color: var(--fs-text-primary);
  vertical-align: top;
}
.data-table tr:last-child td { border-bottom: none; }
.data-table .num { text-align: right; }

.artifact-row { cursor: pointer; }
.artifact-row:hover td { background: var(--fs-bg-hover); }
.name-cell__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--fs-accent);
  font-weight: 500;
  text-decoration: none;
}
.name-cell__link:hover { text-decoration: underline; }
.name-cell__desc {
  margin: 2px 0 0 19px;
  font-size: 11.5px;
  color: var(--fs-text-muted);
  max-width: 520px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted-text { color: var(--fs-text-muted) !important; font-size: 11.5px; }
.muted-icon { color: var(--fs-text-muted); flex-shrink: 0; }
.empty-row  { color: var(--fs-text-muted); font-size: 12px; padding: 28px 10px !important; text-align: center; }

.type-chips { display: flex; flex-wrap: wrap; gap: 4px; }

/* Pagination */
.pagination-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 4px 2px;
  border-top: 1px solid var(--fs-border);
  margin-top: 4px;
}
.pagination-row__size { display: flex; align-items: center; gap: 6px; }
.pagination-row__info { font-size: 11.5px; }
</style>
