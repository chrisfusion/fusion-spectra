<script setup lang="ts">
import { ref, onMounted } from 'vue'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as indexApi from '@/api/indexApi'
import type { Artifact, ArtifactVersion, RegistrySnapshot } from '@/api/indexApi'
import { formatSize } from '@/utils/format'

// ─── Metrics ──────────────────────────────────────────────────────────────────
const metrics        = ref<RegistrySnapshot | null>(null)
const metricsLoading = ref(true)
const metricsError   = ref<string | null>(null)

async function loadMetrics() {
  metricsLoading.value = true
  metricsError.value   = null
  try {
    metrics.value = await indexApi.getMetrics()
  } catch (e) {
    metricsError.value = e instanceof Error ? e.message : 'Failed to load metrics'
  } finally {
    metricsLoading.value = false
  }
}

// ─── Artifacts (silent, feeds recent versions) ────────────────────────────────
const artifacts = ref<Artifact[]>([])

async function loadArtifacts() {
  try {
    const page = await indexApi.listArtifacts({ pageSize: 20 })
    artifacts.value = page.items
  } catch { /* silent — recent versions will show empty */ }
}

// ─── Recent versions ──────────────────────────────────────────────────────────
const recentVersions        = ref<(ArtifactVersion & { artifactName: string })[]>([])
const recentVersionsLoading = ref(true)
const recentVersionsError   = ref<string | null>(null)

async function loadRecentVersions() {
  recentVersionsLoading.value = true
  recentVersionsError.value   = null
  try {
    const slice   = artifacts.value.slice(0, 5)
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
  await Promise.all([loadMetrics(), loadArtifacts()])
  await loadRecentVersions()
})

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const topTypes = (snap: RegistrySnapshot) =>
  [...snap.typeCounts].sort((a, b) => b.count - a.count).slice(0, 6)

const maxTypeCount = (snap: RegistrySnapshot) =>
  Math.max(1, ...snap.typeCounts.map(t => t.count))
</script>

<template>
  <div class="page-grid">

    <!-- Stat cards row -->
    <div class="stat-row">
      <div class="stat-card" :class="{ 'stat-card--loading': metricsLoading }">
        <q-icon name="mdi-package-variant-closed" size="18px" class="stat-card__icon" />
        <div class="stat-card__value">{{ metricsLoading ? '—' : metrics?.totalArtifacts ?? '—' }}</div>
        <div class="stat-card__label">Artifacts</div>
      </div>
      <div class="stat-card" :class="{ 'stat-card--loading': metricsLoading }">
        <q-icon name="mdi-tag-multiple-outline" size="18px" class="stat-card__icon" />
        <div class="stat-card__value">{{ metricsLoading ? '—' : metrics?.totalVersions ?? '—' }}</div>
        <div class="stat-card__label">Versions</div>
      </div>
      <div class="stat-card" :class="{ 'stat-card--loading': metricsLoading }">
        <q-icon name="mdi-bookmark-multiple-outline" size="18px" class="stat-card__icon" />
        <div class="stat-card__value">{{ metricsLoading ? '—' : metrics?.totalTags ?? '—' }}</div>
        <div class="stat-card__label">Tags</div>
      </div>
      <div class="stat-card" :class="{ 'stat-card--loading': metricsLoading }">
        <q-icon name="mdi-harddisk" size="18px" class="stat-card__icon" />
        <div class="stat-card__value">{{ metricsLoading ? '—' : metrics ? formatSize(metrics.totalStorageBytes) : '—' }}</div>
        <div class="stat-card__label">Storage</div>
      </div>
      <div
        class="stat-card"
        :class="{ 'stat-card--loading': metricsLoading, 'stat-card--error': !metricsLoading && (metrics?.filesError ?? 0) > 0 }"
      >
        <q-icon name="mdi-file-check-outline" size="18px" class="stat-card__icon" />
        <div class="stat-card__value">{{ metricsLoading ? '—' : metrics?.filesAvailable ?? '—' }}</div>
        <div class="stat-card__label">Files OK{{ !metricsLoading && (metrics?.filesError ?? 0) > 0 ? ` · ${metrics!.filesError} error` : '' }}</div>
      </div>
    </div>

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

    <!-- By type -->
    <CanvasPanel
      title="By Type"
      icon="mdi-shape-outline"
      :loading="metricsLoading"
      :error="metricsError"
      @refresh="loadMetrics"
    >
      <div v-if="!metrics || metrics.typeCounts.length === 0" class="empty-row">No types assigned</div>
      <div v-else class="type-list">
        <div v-for="t in topTypes(metrics)" :key="t.typeName" class="type-row">
          <span class="type-row__name fs-mono">{{ t.typeName }}</span>
          <div class="type-row__bar-wrap">
            <div
              class="type-row__bar"
              :style="{ width: `${Math.round((t.count / maxTypeCount(metrics!)) * 100)}%` }"
            />
          </div>
          <span class="type-row__count muted-text fs-mono">{{ t.count }}</span>
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

/* Stat cards */
.stat-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 10px 12px;
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border);
  border-radius: 6px;
  transition: border-color var(--fs-ease);
}
.stat-card--loading { opacity: 0.5; }
.stat-card--error   { border-color: var(--fs-neg); }
.stat-card--error .stat-card__value { color: var(--fs-neg); }

.stat-card__icon  { color: var(--fs-text-muted); }
.stat-card__value { font-size: 22px; font-weight: 700; color: var(--fs-accent); line-height: 1.1; font-family: 'JetBrains Mono', monospace; }
.stat-card__label { font-size: 10.5px; color: var(--fs-text-muted); text-transform: uppercase; letter-spacing: 0.06em; text-align: center; }

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
.version-item:hover       { background: var(--fs-bg-hover); }
.version-item__name       { flex: 1; font-size: 12px; color: var(--fs-text-primary); }
.version-item__time       { flex-shrink: 0; }

/* By type */
.type-list { display: flex; flex-direction: column; gap: 8px; padding: 2px 0; }
.type-row  { display: flex; align-items: center; gap: 8px; }
.type-row__name { width: 120px; font-size: 11.5px; color: var(--fs-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.type-row__bar-wrap { flex: 1; height: 5px; background: var(--fs-border); border-radius: 3px; overflow: hidden; }
.type-row__bar      { height: 100%; background: var(--fs-accent); border-radius: 3px; transition: width 0.3s ease; }
.type-row__count    { width: 28px; text-align: right; font-size: 11.5px; flex-shrink: 0; }
</style>
