<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as indexApi from '@/api/indexApi'
import type { Artifact, ArtifactVersion, ArtifactFile } from '@/api/indexApi'
import { formatSize } from '@/utils/format'

const route  = useRoute()
const router = useRouter()

const artifactId = Number(route.params.id)

// ─── Artifact metadata ────────────────────────────────────────────────────────

const artifact        = ref<Artifact | null>(null)
const artifactLoading = ref(true)
const artifactError   = ref<string | null>(null)

// ─── Versions ─────────────────────────────────────────────────────────────────

const versions        = ref<ArtifactVersion[]>([])
const versionsLoading = ref(true)
const versionsError   = ref<string | null>(null)

// ─── Files (keyed by semver string) ───────────────────────────────────────────

const filesMap   = ref<Record<string, ArtifactFile[]>>({})
const filesReady = ref(false)

// ─── Load ─────────────────────────────────────────────────────────────────────

async function loadArtifact() {
  artifactLoading.value = true
  artifactError.value   = null
  try {
    artifact.value = await indexApi.getArtifact(artifactId)
  } catch (e) {
    artifactError.value = e instanceof Error ? e.message : 'Failed to load artifact'
  } finally {
    artifactLoading.value = false
  }
}

async function loadVersions() {
  versionsLoading.value = true
  versionsError.value   = null
  filesReady.value      = false
  try {
    versions.value = await indexApi.listVersions(artifactId)
    loadAllFiles(versions.value)
  } catch (e) {
    versionsError.value = e instanceof Error ? e.message : 'Failed to load versions'
    versionsLoading.value = false
  } finally {
    versionsLoading.value = false
  }
}

async function loadAllFiles(vs: ArtifactVersion[]) {
  const results = await Promise.allSettled(
    vs.map(v =>
      indexApi.listFiles(artifactId, v.version)
        .then(files => ({ semver: v.version, files }))
    )
  )
  const map: Record<string, ArtifactFile[]> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') map[r.value.semver] = r.value.files
  }
  filesMap.value   = map
  filesReady.value = true
}

onMounted(() => Promise.all([loadArtifact(), loadVersions()]))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function versionFiles(semver: string): ArtifactFile[] {
  return filesMap.value[semver] ?? []
}


function totalSize(files: ArtifactFile[]): string {
  if (!files.length) return '—'
  const total = files.reduce((s, f) => s + (f.sizeBytes ?? 0), 0)
  return formatSize(total)
}

function downloadUrl(semver: string, fileId: number): string {
  return indexApi.getFileDownloadUrl(artifactId, semver, fileId)
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/fusion-index/artifacts')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Artifact List
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current fs-mono">{{ artifact?.fullName ?? '…' }}</span>
    </div>

    <!-- Metadata panel -->
    <CanvasPanel
      :title="artifact?.fullName ?? 'Artifact'"
      icon="mdi-package-variant-closed"
      :wide="true"
      :loading="artifactLoading"
      :error="artifactError"
      @refresh="loadArtifact"
    >
      <div v-if="artifact" class="meta-grid">
        <div class="meta-row">
          <span class="meta-label">Full name</span>
          <span class="fs-mono accent-text">{{ artifact.fullName }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Description</span>
          <span class="meta-value">{{ artifact.description ?? '—' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Types</span>
          <div class="type-chips">
            <span
              v-for="t in (artifact.types ?? [])"
              :key="t.id"
              class="fs-badge fs-badge--info"
            >{{ t.name }}</span>
            <span v-if="!(artifact.types?.length)" class="muted-text">—</span>
          </div>
        </div>
        <div class="meta-row">
          <span class="meta-label">Created</span>
          <span class="meta-value fs-mono">{{ formatDate(artifact.createdAt) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Updated</span>
          <span class="meta-value fs-mono">{{ relativeTime(artifact.updatedAt) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">ID</span>
          <span class="meta-value fs-mono muted-text">{{ artifact.id }}</span>
        </div>
      </div>
    </CanvasPanel>

    <!-- Versions panel -->
    <CanvasPanel
      title="Versions"
      icon="mdi-tag-multiple-outline"
      :wide="true"
      :loading="versionsLoading"
      :error="versionsError"
      @refresh="loadVersions"
    >
      <template #actions>
        <button class="add-version-btn" @click="router.push(`/fusion-index/artifacts/${artifactId}/versions/create`)">
          <q-icon name="mdi-plus" size="13px" />
          Add Version
        </button>
      </template>
      <table class="data-table">
        <thead>
          <tr>
            <th>Version</th>
            <th>Tags</th>
            <th>Size</th>
            <th>Download</th>
            <th>Published</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="versions.length === 0">
            <td colspan="5" class="empty-row">No versions published yet</td>
          </tr>
          <tr v-for="v in versions" :key="v.id">

            <!-- Version badge -->
            <td>
              <span class="fs-badge fs-badge--accent fs-mono">{{ v.version }}</span>
            </td>

            <!-- Tags -->
            <td>
              <div class="tag-chips">
                <span
                  v-for="t in (v.tags ?? [])"
                  :key="t.id"
                  class="fs-badge fs-badge--pos fs-mono"
                >{{ t.tag }}</span>
                <span v-if="!(v.tags?.length)" class="muted-text">—</span>
              </div>
            </td>

            <!-- Total size -->
            <td class="muted-text fs-mono size-cell">
              <template v-if="filesReady">{{ totalSize(versionFiles(v.version)) }}</template>
              <q-spinner v-else size="11px" color="grey-6" />
            </td>

            <!-- Download -->
            <td class="dl-cell">
              <!-- loading -->
              <template v-if="!filesReady">
                <span class="muted-text">—</span>
              </template>

              <!-- no files -->
              <template v-else-if="versionFiles(v.version).length === 0">
                <span class="muted-text">—</span>
              </template>

              <!-- single file — direct link -->
              <template v-else-if="versionFiles(v.version).length === 1">
                <a
                  :href="downloadUrl(v.version, versionFiles(v.version)[0].id)"
                  class="dl-btn"
                  :title="versionFiles(v.version)[0].name"
                  target="_blank"
                >
                  <q-icon name="mdi-download" size="13px" />
                  {{ versionFiles(v.version)[0].name }}
                </a>
              </template>

              <!-- multiple files — dropdown picker -->
              <template v-else>
                <q-btn-dropdown
                  flat
                  dense
                  no-caps
                  unelevated
                  size="xs"
                  icon="mdi-download"
                  :label="`${versionFiles(v.version).length} files`"
                  class="dl-dropdown"
                  dropdown-icon="mdi-chevron-down"
                >
                  <q-list dense style="min-width: 240px; padding: 4px 0">
                    <q-item
                      v-for="f in versionFiles(v.version)"
                      :key="f.id"
                      clickable
                      tag="a"
                      :href="downloadUrl(v.version, f.id)"
                      target="_blank"
                      class="dl-item"
                    >
                      <q-item-section avatar style="min-width: 28px">
                        <q-icon name="mdi-file-download-outline" size="15px" class="muted-icon" />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label class="fs-mono dl-item__name">{{ f.name }}</q-item-label>
                        <q-item-label caption class="dl-item__meta">
                          {{ formatSize(f.sizeBytes) }}
                          <template v-if="f.contentType"> · {{ f.contentType }}</template>
                        </q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-icon name="mdi-download" size="13px" class="muted-icon" />
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-btn-dropdown>
              </template>
            </td>

            <!-- Published -->
            <td class="muted-text fs-mono">{{ relativeTime(v.createdAt) }}</td>
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

/* Breadcrumb */
.breadcrumb {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 4px;
}
.breadcrumb__back {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--fs-text-muted);
  font-size: 12px;
  font-family: inherit;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.breadcrumb__back:hover {
  color: var(--fs-text-primary);
  background: var(--fs-bg-hover);
}
.breadcrumb__current {
  font-size: 12px;
  color: var(--fs-accent);
  font-weight: 500;
}

/* Metadata */
.meta-grid { display: flex; flex-direction: column; }
.meta-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: start;
  gap: 12px;
  padding: 9px 10px;
  border-bottom: 1px solid var(--fs-border-dim);
  font-size: 12px;
}
.meta-row:last-child { border-bottom: none; }
.meta-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  padding-top: 1px;
}
.meta-value { color: var(--fs-text-primary); }

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
  vertical-align: middle;
}
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: var(--fs-bg-hover); }

.size-cell { width: 80px; }
.dl-cell   { width: 160px; }

/* Direct download link */
.dl-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11.5px;
  font-family: var(--fs-font-mono);
  color: var(--fs-accent);
  text-decoration: none;
  border: 1px solid var(--fs-border-bright);
  transition: background var(--fs-ease), border-color var(--fs-ease);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dl-btn:hover {
  background: var(--fs-bg-hover);
  border-color: var(--fs-accent);
}

/* Multi-file dropdown button */
.dl-dropdown {
  color: var(--fs-accent) !important;
  border: 1px solid var(--fs-border-bright) !important;
  border-radius: 4px !important;
  font-size: 11.5px !important;
  font-family: var(--fs-font-mono) !important;
  padding: 2px 6px !important;
}
.dl-dropdown:hover {
  border-color: var(--fs-accent) !important;
  background: var(--fs-bg-hover) !important;
}

/* Dropdown list items */
.dl-item { min-height: 36px !important; }
.dl-item__name { font-size: 12px !important; }
.dl-item__meta { font-size: 10.5px !important; }

.accent-text { color: var(--fs-accent) !important; }
.muted-text  { color: var(--fs-text-muted) !important; font-size: 11.5px; }
.muted-icon  { color: var(--fs-text-muted); }
.empty-row   { color: var(--fs-text-muted); font-size: 12px; padding: 24px 10px !important; text-align: center; }

.type-chips,
.tag-chips { display: flex; flex-wrap: wrap; gap: 4px; }

.add-version-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 11.5px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  color: var(--fs-accent);
  background: none;
  border: 1px solid var(--fs-border-bright);
  transition: background var(--fs-ease), border-color var(--fs-ease);
  white-space: nowrap;
}
.add-version-btn:hover {
  background: var(--fs-bg-hover);
  border-color: var(--fs-accent);
}
</style>
