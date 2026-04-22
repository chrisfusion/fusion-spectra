<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as indexApi from '@/api/indexApi'
import type { Artifact } from '@/api/indexApi'

const router = useRouter()

// ─── State ────────────────────────────────────────────────────────────────────

const artifacts   = ref<Artifact[]>([])
const total       = ref(0)
const loading     = ref(true)
const error       = ref<string | null>(null)

const PAGE_SIZE   = 20
const currentPage = ref(1)   // 1-based (Quasar); backend is 0-based
const totalPages  = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const searchQuery = ref('')
let   searchTimer: ReturnType<typeof setTimeout> | null = null

// ─── Data loading ─────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value   = null
  try {
    const page = await indexApi.listArtifacts({
      name:     searchQuery.value || undefined,
      page:     currentPage.value - 1,
      pageSize: PAGE_SIZE,
    })
    artifacts.value = page.items
    total.value     = page.total
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load artifacts'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Reset to page 1 and reload when search changes (debounced 300ms)
watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    load()
  }, 300)
})

// Reload when page changes
watch(currentPage, load)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function openArtifact(artifact: Artifact) {
  router.push(`/fusion-index/artifacts/${artifact.id}`)
}
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
      <!-- Search bar -->
      <div class="search-bar">
        <div class="search-bar__input-wrap">
          <q-icon name="mdi-magnify" size="15px" class="muted-icon" />
          <input
            v-model="searchQuery"
            class="search-bar__input fs-mono"
            placeholder="Filter by name prefix…"
            type="text"
          />
          <q-icon
            v-if="searchQuery"
            name="mdi-close"
            size="14px"
            class="muted-icon search-bar__clear"
            @click="searchQuery = ''"
          />
        </div>
        <span class="search-bar__count muted-text">
          {{ total }} artifact{{ total === 1 ? '' : 's' }}
        </span>
      </div>

      <!-- Table -->
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Types</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="artifacts.length === 0">
            <td colspan="4" class="empty-row">No artifacts found</td>
          </tr>
          <tr
            v-for="a in artifacts"
            :key="a.id"
            class="artifact-row"
            @click="openArtifact(a)"
          >
            <td class="fs-mono artifact-row__name">
              <q-icon name="mdi-package-variant-closed" size="13px" class="muted-icon" />
              {{ a.fullName }}
            </td>
            <td class="muted-text">{{ a.description ?? '—' }}</td>
            <td>
              <div class="type-chips">
                <span
                  v-for="t in (a.types ?? [])"
                  :key="t.id"
                  class="fs-badge fs-badge--info"
                >{{ t.name }}</span>
                <span v-if="!(a.types?.length)" class="muted-text">—</span>
              </div>
            </td>
            <td class="muted-text fs-mono">{{ relativeTime(a.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination-row">
        <q-pagination
          v-model="currentPage"
          :max="totalPages"
          :max-pages="7"
          boundary-numbers
          direction-links
          color="grey-7"
          active-color="primary"
          size="sm"
        />
        <span class="muted-text pagination-row__info">
          {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, total) }} of {{ total }}
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

/* Search bar */
.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 2px 12px;
  border-bottom: 1px solid var(--fs-border);
  margin-bottom: 4px;
}
.search-bar__input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border-bright);
  border-radius: 4px;
}
.search-bar__input-wrap:focus-within {
  border-color: var(--fs-accent);
  box-shadow: 0 0 0 2px var(--fs-accent-soft);
}
.search-bar__input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--fs-text-primary);
  font-size: 12px;
}
.search-bar__input::placeholder { color: var(--fs-text-muted); }
.search-bar__clear { cursor: pointer; }
.search-bar__count { font-size: 11.5px; white-space: nowrap; flex-shrink: 0; }

/* Table */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.data-table th {
  text-align: left;
  padding: 0 10px 8px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.data-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--fs-border-dim);
  color: var(--fs-text-primary);
}
.data-table tr:last-child td { border-bottom: none; }

.artifact-row { cursor: pointer; }
.artifact-row:hover td { background: var(--fs-bg-hover); }
.artifact-row__name {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fs-accent) !important;
  font-weight: 500;
}

.muted-text { color: var(--fs-text-muted) !important; font-size: 11.5px; }
.muted-icon { color: var(--fs-text-muted); flex-shrink: 0; }
.empty-row  { color: var(--fs-text-muted); font-size: 12px; padding: 24px 10px !important; text-align: center; }

/* Type chips */
.type-chips { display: flex; flex-wrap: wrap; gap: 4px; }

/* Pagination */
.pagination-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 4px 2px;
  border-top: 1px solid var(--fs-border);
  margin-top: 4px;
}
.pagination-row__info { font-size: 11.5px; }
</style>
