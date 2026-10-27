<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import CleanupPanel from '@/components/CleanupPanel.vue'
import { usePermission } from '@/composables/usePermission'
import { formatSize } from '@/utils/format'
import * as indexApi from '@/api/indexApi'
import { artifactViewLink } from '@/pages/index/artifactListQuery'
import type { Artifact, ArtifactVersion, ArtifactFile, TypeResponse } from '@/api/indexApi'

const $q    = useQuasar()
const { can } = usePermission()

const PAGE_SIZE = 20

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

const artifactLink = (id: number) => `/fusion-index/artifacts/${id}`

// ── Cleanup panel columns ─────────────────────────────────────────────────────

const artifactCols = [
  { label: 'ID',        value: (a: Artifact) => a.id,                  class: 'col-id fs-mono' },
  { label: 'Full Name', value: (a: Artifact) => a.fullName,            class: 'col-name fs-mono', link: (a: Artifact) => artifactLink(a.id) },
  { label: 'Created',   value: (a: Artifact) => formatDate(a.createdAt), class: 'col-muted' },
]

const versionCols = [
  { label: 'Version ID',  value: (v: ArtifactVersion) => v.id,         class: 'col-id fs-mono' },
  { label: 'Artifact ID', value: (v: ArtifactVersion) => v.artifactId, class: 'col-id fs-mono', link: (v: ArtifactVersion) => artifactLink(v.artifactId) },
  { label: 'Version',     value: (v: ArtifactVersion) => v.version,    class: 'col-name fs-mono' },
  { label: 'Created',     value: (v: ArtifactVersion) => formatDate(v.createdAt), class: 'col-muted' },
]

const fileCols = [
  { label: 'File ID',    value: (f: ArtifactFile) => f.id,          class: 'col-id fs-mono' },
  { label: 'Version ID', value: (f: ArtifactFile) => f.versionId,   class: 'col-id fs-mono' },
  { label: 'Name',       value: (f: ArtifactFile) => f.name,        class: 'col-name fs-mono' },
  { label: 'Status',     value: (f: ArtifactFile) => f.status,      class: 'col-muted' },
  { label: 'Backend',    value: (f: ArtifactFile) => f.storageBackend, class: 'col-muted' },
  { label: 'Created',    value: (f: ArtifactFile) => formatDate(f.createdAt), class: 'col-muted' },
]

const typeCols = [
  { label: 'ID',          value: (t: TypeResponse) => t.id,                 class: 'col-id fs-mono' },
  { label: 'Name',        value: (t: TypeResponse) => t.name,               class: 'col-name fs-mono' },
  { label: 'Description', value: (t: TypeResponse) => t.description ?? '—', class: 'col-muted' },
  { label: 'Created',     value: (t: TypeResponse) => formatDate(t.createdAt), class: 'col-muted' },
]

// ── Registry health (maintenance indicators from /q/metrics) ──────────────────

const metrics        = ref<indexApi.RegistrySnapshot | null>(null)
const metricsLoading = ref(false)
const metricsError   = ref<string | null>(null)

async function loadMetrics() {
  metricsLoading.value = true; metricsError.value = null
  try { metrics.value = await indexApi.getMetrics() }
  catch (e) { metricsError.value = e instanceof Error ? e.message : 'Failed to load metrics' }
  finally { metricsLoading.value = false }
}

// ── Broken tags (read-only list; tags are removed one at a time) ──────────────

const bt = {
  loading:  ref(false),
  error:    ref<string | null>(null),
  items:    ref<indexApi.TagListItem[]>([]),
  total:    ref(0),
  page:     ref(1),
  removing: ref<Set<number>>(new Set()),
}

async function loadBrokenTags() {
  bt.loading.value = true; bt.error.value = null
  try {
    const r = await indexApi.listTags({ broken: true, page: bt.page.value - 1, pageSize: PAGE_SIZE })
    bt.items.value = r.items ?? []; bt.total.value = r.total
  } catch (e) { bt.error.value = e instanceof Error ? e.message : 'Failed to load' }
  finally { bt.loading.value = false }
}

watch(bt.page, loadBrokenTags)

function removeTag(t: indexApi.TagListItem) {
  $q.dialog({
    title: 'Remove tag',
    message: `Remove tag "${t.tag}" from ${t.artifactName}? The version ${t.version} itself is kept.`,
    ok: { label: 'Remove', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    bt.removing.value = new Set([...bt.removing.value, t.id])
    try {
      await indexApi.deleteTag(t.artifactId, t.tag)
      onDeleted()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Remove failed' })
    } finally {
      bt.removing.value = new Set([...bt.removing.value].filter(id => id !== t.id))
    }
  })
}

// A delete in any panel can change what every other panel matches — reload them all
const refreshKey = ref(0)
function onDeleted() {
  refreshKey.value++
  loadMetrics()
  loadBrokenTags()
}

onMounted(() => {
  loadMetrics()
  loadBrokenTags()
})
</script>

<template>
  <div v-if="!can('index:admin:manage')" class="no-perm">
    You do not have permission to access index maintenance.
  </div>
  <div v-else class="page-grid">

    <!-- ── Registry Health ───────────────────────────────────────────────────── -->
    <CanvasPanel
      title="Registry Health"
      icon="mdi-stethoscope"
      :wide="true"
      :loading="metricsLoading"
      :error="metricsError ?? undefined"
      @refresh="loadMetrics"
    >
      <template #actions>
        <span v-if="metrics" class="section-hint">as of {{ formatDate(metrics.cachedAt) }} (cached 60s)</span>
      </template>
      <div v-if="metrics" class="health-grid">
        <router-link :to="artifactViewLink('no-versions')" class="stat stat--link" :class="{ 'stat--warn': metrics.artifactsWithoutVersions }">
          <span class="stat__value">{{ metrics.artifactsWithoutVersions }}</span><span class="stat__label">Empty artifacts</span>
        </router-link>
        <router-link :to="artifactViewLink('no-files')" class="stat stat--link" :class="{ 'stat--warn': metrics.artifactsWithoutFiles }">
          <span class="stat__value">{{ metrics.artifactsWithoutFiles }}</span><span class="stat__label">Artifacts without files</span>
        </router-link>
        <div class="stat" :class="{ 'stat--warn': metrics.versionsWithoutFiles }">
          <span class="stat__value">{{ metrics.versionsWithoutFiles }}</span><span class="stat__label">Versions without files</span>
        </div>
        <router-link :to="artifactViewLink('failed-uploads')" class="stat stat--link" :class="{ 'stat--warn': metrics.filesPending + metrics.filesError }">
          <span class="stat__value">{{ metrics.filesPending + metrics.filesError }}</span>
          <span class="stat__label">Incomplete files ({{ metrics.filesPending }} pending · {{ metrics.filesError }} error)</span>
        </router-link>
        <div class="stat" :class="{ 'stat--warn': metrics.brokenTags }">
          <span class="stat__value">{{ metrics.brokenTags }}</span><span class="stat__label">Broken tags</span>
        </div>
        <div class="stat" :class="{ 'stat--warn': metrics.unusedTypes }">
          <span class="stat__value">{{ metrics.unusedTypes }}</span><span class="stat__label">Unused types</span>
        </div>
        <router-link to="/admin/retention" class="stat stat--link">
          <span class="stat__value">{{ metrics.retentionPolicies }}</span><span class="stat__label">Retention policies</span>
        </router-link>
        <div class="stat">
          <span class="stat__value">{{ formatSize(metrics.totalStorageBytes) }}</span>
          <span class="stat__label">
            Storage<template v-for="b in metrics.storageBytesByBackend ?? []" :key="b.backend"> · {{ b.backend }} {{ formatSize(b.bytes) }}</template>
          </span>
        </div>
      </div>
    </CanvasPanel>

    <CleanupPanel
      title="Empty Artifacts" icon="mdi-archive-off-outline"
      path="artifacts/empty" item-label="empty artifacts" :columns="artifactCols"
      hint="Artifacts that have no versions."
      @deleted="onDeleted" :refresh-key="refreshKey"
    />
    <CleanupPanel
      title="Versions Without Files" icon="mdi-code-tags-check"
      path="versions/empty" item-label="empty versions" :columns="versionCols"
      hint="Versions with no file at all (any status)."
      @deleted="onDeleted" :refresh-key="refreshKey"
    />
    <CleanupPanel
      title="Artifacts Without Files" icon="mdi-folder-open-outline"
      path="artifacts/no-files" item-label="file-less artifacts" :columns="artifactCols"
      hint="Artifacts that have versions but no file in any of them — deleted together with their versions."
      @deleted="onDeleted" :refresh-key="refreshKey"
    />
    <CleanupPanel
      title="Incomplete Files" icon="mdi-file-alert-outline"
      path="files/incomplete" item-label="incomplete files" :columns="fileCols"
      hint="PENDING (interrupted) or ERROR (failed) uploads. Partial objects left in storage are removed too. Pick a threshold well in the past so running uploads are not hit."
      @deleted="onDeleted" :refresh-key="refreshKey"
    />
    <CleanupPanel
      title="Unused Types" icon="mdi-tag-off-outline"
      path="types/unused" item-label="unused types" :columns="typeCols"
      hint="Artifact types assigned to no artifact."
      @deleted="onDeleted" :refresh-key="refreshKey"
    />

    <!-- ── Broken Tags ───────────────────────────────────────────────────────── -->
    <CanvasPanel
      title="Broken Tags"
      icon="mdi-tag-remove-outline"
      :wide="true"
      :loading="bt.loading.value"
      :error="bt.error.value ?? undefined"
      @refresh="loadBrokenTags"
    >
      <template #actions>
        <span class="section-hint">{{ bt.total.value }} found</span>
      </template>

      <div class="panel-hint">Tags pointing at a version with no available file — resolving them yields nothing downloadable.</div>

      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr>
            <th>Artifact</th><th>Tag</th><th>Version</th><th>Updated</th><th></th>
          </tr></thead>
          <tbody>
            <tr v-for="t in bt.items.value" :key="t.id">
              <td class="col-name fs-mono"><router-link :to="artifactLink(t.artifactId)">{{ t.artifactName }}</router-link></td>
              <td class="fs-mono"><span class="status-chip status-chip--warn">{{ t.tag }}</span></td>
              <td class="fs-mono">{{ t.version }}</td>
              <td class="col-muted">{{ formatDate(t.updatedAt) }}</td>
              <td class="col-action">
                <button
                  v-if="can('index:artifacts:write')"
                  class="icon-btn"
                  title="Remove tag"
                  :disabled="bt.removing.value.has(t.id)"
                  @click="removeTag(t)"
                >
                  <q-icon name="mdi-tag-remove-outline" size="15px" />
                </button>
              </td>
            </tr>
            <tr v-if="!bt.loading.value && bt.items.value.length === 0">
              <td colspan="5" class="empty-row">No broken tags found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="bt.total.value > PAGE_SIZE" class="pagination-row">
        <q-pagination v-model="bt.page.value" :max="Math.ceil(bt.total.value / PAGE_SIZE)" :max-pages="7"
          direction-links boundary-links size="sm" color="grey" active-color="primary" />
        <span class="pagination-hint">{{ bt.total.value }} total</span>
      </div>
    </CanvasPanel>

  </div>
</template>

<style scoped lang="scss">
@use '@/css/admin-page';

.panel-hint {
  font-size: 12px;
  color: var(--fs-text-muted);
  margin-bottom: 10px;
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--fs-border);
  border-radius: 6px;
}
.stat__value {
  font-family: var(--fs-font-mono);
  font-size: 20px;
  font-weight: 600;
  color: var(--fs-text-primary);
}
.stat__label { font-size: 11px; color: var(--fs-text-muted); }
.stat--link {
  text-decoration: none;
  transition: border-color var(--fs-ease);
  &:hover { border-color: var(--fs-accent); }
}
.stat--warn {
  border-color: color-mix(in srgb, var(--fs-warn, #f59e0b) 45%, transparent);
  .stat__value { color: var(--fs-warn, #f59e0b); }
}
</style>
