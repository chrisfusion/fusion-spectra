<script setup lang="ts">
import { ref, onMounted } from 'vue'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as indexApi from '@/api/indexApi'
import type { Artifact, ArtifactVersion } from '@/api/indexApi'

// ─── Artifacts ────────────────────────────────────────────────────────────────
const artifacts        = ref<Artifact[]>([])
const artifactsLoading = ref(true)
const artifactsError   = ref<string | null>(null)

async function loadArtifacts() {
  artifactsLoading.value = true
  artifactsError.value   = null
  try {
    const page = await indexApi.listArtifacts({ pageSize: 20 })
    artifacts.value = page.items
  } catch (e) {
    artifactsError.value = e instanceof Error ? e.message : 'Failed to load artifacts'
  } finally {
    artifactsLoading.value = false
  }
}

// ─── Recent versions (first 5 artifacts, latest version each) ─────────────────
const recentVersions        = ref<(ArtifactVersion & { artifactName: string })[]>([])
const recentVersionsLoading = ref(true)
const recentVersionsError   = ref<string | null>(null)

async function loadRecentVersions() {
  recentVersionsLoading.value = true
  recentVersionsError.value   = null
  try {
    const slice  = artifacts.value.slice(0, 5)
    const results = await Promise.all(
      slice.map(a =>
        indexApi.listVersions(a.id)
          .then(vs => vs.map(v => ({ ...v, artifactName: a.fullName })))
          .catch(() => [])
      )
    )
    recentVersions.value = results
      .flat()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
  } catch (e) {
    recentVersionsError.value = e instanceof Error ? e.message : 'Failed to load versions'
  } finally {
    recentVersionsLoading.value = false
  }
}

onMounted(async () => {
  await loadArtifacts()
  await loadRecentVersions()
})

const searchQuery = ref('')

async function onSearchInput(e: Event) {
  searchQuery.value = (e.target as HTMLInputElement).value
  artifactsLoading.value = true
  artifactsError.value   = null
  try {
    const page = await indexApi.listArtifacts({
      name:     searchQuery.value || undefined,
      pageSize: 20
    })
    artifacts.value = page.items
  } catch (err) {
    artifactsError.value = err instanceof Error ? err.message : 'Failed to search'
  } finally {
    artifactsLoading.value = false
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
</script>

<template>
  <div class="page-grid">
    <!-- Artifact registry -->
    <CanvasPanel
      title="Artifact Registry"
      icon="mdi-package-variant"
      :wide="true"
      :loading="artifactsLoading"
      :error="artifactsError"
      @refresh="loadArtifacts"
    >
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Created</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="artifacts.length === 0">
            <td colspan="4" class="empty-row">No artifacts yet</td>
          </tr>
          <tr v-for="a in artifacts" :key="a.id">
            <td class="fs-mono accent-text">{{ a.fullName }}</td>
            <td class="muted-text">{{ a.description ?? '—' }}</td>
            <td class="muted-text fs-mono">{{ relativeTime(a.createdAt) }}</td>
            <td class="muted-text fs-mono">{{ relativeTime(a.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </CanvasPanel>

    <!-- Recent versions -->
    <CanvasPanel
      title="Recent Versions"
      icon="mdi-tag-outline"
      :loading="recentVersionsLoading"
      :error="recentVersionsError"
      @refresh="loadRecentVersions"
    >
      <div class="version-list">
        <div v-if="recentVersions.length === 0" class="empty-row">No versions yet</div>
        <div v-for="v in recentVersions" :key="v.id" class="version-item">
          <q-icon name="mdi-tag-outline" size="13px" class="muted-icon" />
          <span class="version-item__name fs-mono">{{ v.artifactName }}</span>
          <span class="fs-badge fs-badge--accent fs-mono">{{ v.version }}</span>
          <span class="version-item__time muted-text fs-mono">{{ relativeTime(v.createdAt) }}</span>
        </div>
      </div>
    </CanvasPanel>

    <!-- Quick search -->
    <CanvasPanel title="Quick Search" icon="mdi-magnify">
      <div class="search-panel">
        <div class="search-panel__input-wrap">
          <q-icon name="mdi-magnify" size="15px" class="muted-icon" />
          <input
            class="search-panel__input fs-mono"
            placeholder="Filter by name prefix…"
            type="text"
            @input="onSearchInput"
          />
        </div>
        <div class="search-panel__hint muted-text">
          <q-icon name="mdi-information-outline" size="13px" />
          <span>Connected to fusion-index · {{ artifacts.length }} artifact{{ artifacts.length === 1 ? '' : 's' }}</span>
        </div>
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
  padding: 7px 10px;
  border-bottom: 1px solid var(--fs-border-dim);
  color: var(--fs-text-primary);
}
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: var(--fs-bg-hover); }

.accent-text { color: var(--fs-accent) !important; }
.muted-text  { color: var(--fs-text-muted) !important; font-size: 11.5px; }
.muted-icon  { color: var(--fs-text-muted); flex-shrink: 0; }
.empty-row   { color: var(--fs-text-muted); font-size: 12px; padding: 16px 10px !important; }

/* Versions */
.version-list { display: flex; flex-direction: column; gap: 2px; }
.version-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 6px;
  border-radius: 3px;
  transition: background var(--fs-ease);
}
.version-item:hover { background: var(--fs-bg-hover); }
.version-item__name { flex: 1; font-size: 12px; color: var(--fs-text-primary); }
.version-item__time { flex-shrink: 0; }

/* Search */
.search-panel { display: flex; flex-direction: column; gap: 12px; }
.search-panel__input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border-bright);
  border-radius: 4px;
}
.search-panel__input-wrap:focus-within {
  border-color: var(--fs-accent);
  box-shadow: 0 0 0 2px var(--fs-accent-soft);
}
.search-panel__input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--fs-text-primary);
  font-size: 12px;
}
.search-panel__input::placeholder { color: var(--fs-text-muted); }
.search-panel__hint { display: flex; align-items: center; gap: 6px; font-size: 11.5px; }
</style>
