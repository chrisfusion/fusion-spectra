<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as indexApi from '@/api/indexApi'
import type { Artifact, ArtifactVersion, ArtifactFile, ArtifactTag } from '@/api/indexApi'
import { formatSize } from '@/utils/format'
import { usePermission } from '@/composables/usePermission'
import { getExtBffDownloadPattern, getExtBffPublicPattern, getExtBffPublicTag } from '@/config/runtime'

const route  = useRoute()
const router = useRouter()
const $q     = useQuasar()
const { can } = usePermission()

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

// ─── Tag editing state ────────────────────────────────────────────────────────

const tagAddingFor   = ref<number | null>(null)
const tagInput       = ref('')
const tagInlineInput = ref<HTMLInputElement[]>([])
const tagMutating    = ref<Set<number>>(new Set())
const tagError       = ref<Record<number, string>>({})

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

// ─── External-BFF / public URL copy ──────────────────────────────────────────

const extBffDownloadPattern = getExtBffDownloadPattern()
const extBffPublicPattern   = getExtBffPublicPattern()
const extBffPublicTag       = getExtBffPublicTag()

function resolvePattern(pattern: string, semver: string, fileId: number): string {
  return pattern
    .replace('{artifactId}', String(artifactId))
    .replace('{semver}', semver)
    .replace('{fileId}', String(fileId))
}

function extBffUrl(semver: string, fileId: number): string {
  return resolvePattern(extBffDownloadPattern, semver, fileId)
}

function publicApiUrl(semver: string, fileId: number): string {
  return resolvePattern(extBffPublicPattern, semver, fileId)
}

function hasPublicTag(v: ArtifactVersion): boolean {
  return (v.tags ?? []).some(t => t.tag === extBffPublicTag)
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    $q.notify({ type: 'positive', message: 'URL copied to clipboard', timeout: 2000 })
  } catch {
    $q.dialog({
      title: 'Could not copy to clipboard',
      message: `Clipboard access requires HTTPS and browser permission.<br><br>Copy manually:<br><pre class="copy-fallback-url">${url}</pre>`,
      html: true,
      ok: { label: 'Close', flat: true },
    })
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// ─── Tag management ───────────────────────────────────────────────────────────

const TAG_RE = /^[a-zA-Z0-9-]+$/

function startTagAdd(versionId: number) {
  tagAddingFor.value = versionId
  tagInput.value     = ''
  const e = { ...tagError.value }
  delete e[versionId]
  tagError.value = e
  nextTick(() => tagInlineInput.value[0]?.focus())
}

function cancelTagAdd() {
  tagAddingFor.value = null
  tagInput.value     = ''
}

async function confirmTagAdd(v: ArtifactVersion) {
  const val = tagInput.value.trim()
  if (!val) { cancelTagAdd(); return }
  if (!TAG_RE.test(val)) {
    tagError.value = { ...tagError.value, [v.id]: 'Alphanumeric and hyphens only' }
    return
  }
  cancelTagAdd()
  tagMutating.value = new Set([...tagMutating.value, v.id])

  const row      = versions.value.find(ver => ver.id === v.id)
  const snapshot = [...(row?.tags ?? [])]
  if (row) {
    row.tags = [...snapshot, { id: -1, artifactId, tag: val, versionId: v.id, createdAt: '', updatedAt: '' } as ArtifactTag]
  }

  try {
    const created = await indexApi.putTag(artifactId, val, v.version)
    if (row) {
      const idx = row.tags.findIndex(t => t.tag === val && t.id === -1)
      if (idx !== -1) row.tags[idx] = created
    }
    const e = { ...tagError.value }
    delete e[v.id]
    tagError.value = e
  } catch (err) {
    if (row) row.tags = snapshot
    tagError.value = { ...tagError.value, [v.id]: err instanceof Error ? err.message : 'Failed to add tag' }
  } finally {
    tagMutating.value = new Set([...tagMutating.value].filter(id => id !== v.id))
  }
}

async function removeTag(v: ArtifactVersion, tag: string) {
  tagMutating.value = new Set([...tagMutating.value, v.id])

  const row      = versions.value.find(ver => ver.id === v.id)
  const snapshot = [...(row?.tags ?? [])]
  if (row) row.tags = snapshot.filter(t => t.tag !== tag)

  try {
    await indexApi.deleteTag(artifactId, tag)
    const e = { ...tagError.value }
    delete e[v.id]
    tagError.value = e
  } catch (err) {
    if (row) row.tags = snapshot
    tagError.value = { ...tagError.value, [v.id]: err instanceof Error ? err.message : 'Failed to remove tag' }
  } finally {
    tagMutating.value = new Set([...tagMutating.value].filter(id => id !== v.id))
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

const deletingVersions = ref<Set<string>>(new Set())

function confirmDeleteVersion(v: ArtifactVersion) {
  $q.dialog({
    title: 'Delete version',
    message: `Delete version <b>${v.version}</b>? All files in this version will be removed.`,
    html: true,
    ok:     { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deletingVersions.value = new Set([...deletingVersions.value, v.version])
    try {
      await indexApi.deleteVersion(artifactId, v.version)
      versions.value = versions.value.filter(ver => ver.id !== v.id)
      const newMap = { ...filesMap.value }
      delete newMap[v.version]
      filesMap.value = newMap

      if (versions.value.length === 0) {
        $q.dialog({
          title: 'No versions remaining',
          message: `<b>${artifact.value?.fullName}</b> has no versions left. Delete the artifact too?`,
          html: true,
          ok:     { label: 'Delete Artifact', color: 'negative', flat: true },
          cancel: { label: 'Keep', flat: true },
        }).onOk(() => doDeleteArtifact())
      }
    } catch (err) {
      $q.notify({ type: 'negative', message: err instanceof Error ? err.message : 'Failed to delete version' })
    } finally {
      deletingVersions.value = new Set([...deletingVersions.value].filter(s => s !== v.version))
    }
  })
}

function confirmDeleteArtifact() {
  $q.dialog({
    title: 'Delete artifact',
    message: `Delete <b>${artifact.value?.fullName}</b> and all its versions?`,
    html: true,
    ok:     { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(() => doDeleteArtifact())
}

async function doDeleteArtifact() {
  try {
    await indexApi.deleteArtifact(artifactId)
    router.replace('/fusion-index/artifacts')
  } catch (err) {
    $q.notify({ type: 'negative', message: err instanceof Error ? err.message : 'Failed to delete artifact' })
  }
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
      <template #actions>
        <button
          v-if="can('index:artifacts:delete')"
          class="delete-artifact-btn"
          :disabled="!artifact"
          @click="confirmDeleteArtifact"
        >
          <q-icon name="mdi-trash-can-outline" size="13px" />
          Delete Artifact
        </button>
      </template>
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="versions.length === 0">
            <td colspan="6" class="empty-row">No versions published yet</td>
          </tr>
          <tr v-for="v in versions" :key="v.id">

            <!-- Version badge -->
            <td>
              <span class="fs-badge fs-badge--accent fs-mono">{{ v.version }}</span>
            </td>

            <!-- Tags -->
            <td class="tags-cell">
              <div class="tag-cell">
                <span
                  v-for="t in (v.tags ?? [])"
                  :key="t.tag"
                  class="fs-badge fs-badge--pos fs-mono tag-chip"
                >
                  {{ t.tag }}
                  <button
                    type="button"
                    class="tag-chip__x"
                    :disabled="tagMutating.has(v.id)"
                    @click.stop="removeTag(v, t.tag)"
                    title="Remove tag"
                  ><q-icon name="mdi-close" size="9px" /></button>
                </span>
                <template v-if="tagAddingFor === v.id">
                  <input
                    ref="tagInlineInput"
                    v-model="tagInput"
                    class="tag-inline-input fs-mono"
                    placeholder="tag-name"
                    maxlength="64"
                    @keydown.enter.prevent="confirmTagAdd(v)"
                    @keydown.escape.prevent="cancelTagAdd"
                  />
                  <button type="button" class="tag-action-btn tag-action-btn--ok" @click="confirmTagAdd(v)" title="Add tag">
                    <q-icon name="mdi-check" size="11px" />
                  </button>
                  <button type="button" class="tag-action-btn tag-action-btn--cancel" @click="cancelTagAdd" title="Cancel">
                    <q-icon name="mdi-close" size="11px" />
                  </button>
                </template>
                <button
                  v-else
                  type="button"
                  class="tag-add-btn"
                  :disabled="tagMutating.has(v.id)"
                  @click.stop="startTagAdd(v.id)"
                  title="Add tag"
                >
                  <q-spinner v-if="tagMutating.has(v.id)" size="10px" />
                  <q-icon v-else name="mdi-plus" size="12px" />
                </button>
              </div>
              <span v-if="tagError[v.id]" class="tag-row-error">{{ tagError[v.id] }}</span>
            </td>

            <!-- Total size -->
            <td class="muted-text fs-mono size-cell">
              <template v-if="filesReady">{{ totalSize(versionFiles(v.version)) }}</template>
              <q-spinner v-else size="11px" color="grey-6" />
            </td>

            <!-- Download -->
            <td class="dl-cell">
              <!-- loading or no files -->
              <template v-if="!filesReady || versionFiles(v.version).length === 0">
                <span class="muted-text">—</span>
              </template>

              <template v-else>
                <div class="dl-group">

                  <!-- single file — direct download link -->
                  <template v-if="versionFiles(v.version).length === 1">
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
                      flat dense no-caps unelevated size="xs"
                      icon="mdi-download"
                      :label="`${versionFiles(v.version).length} files`"
                      class="dl-dropdown"
                      dropdown-icon="mdi-chevron-down"
                    >
                      <q-list dense style="min-width: 240px; padding: 4px 0">
                        <q-item
                          v-for="f in versionFiles(v.version)" :key="f.id"
                          clickable tag="a" :href="downloadUrl(v.version, f.id)"
                          target="_blank" class="dl-item"
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

                  <!-- Ext-BFF copy button (single file: icon btn; multi: dropdown) -->
                  <template v-if="extBffDownloadPattern">
                    <template v-if="versionFiles(v.version).length === 1">
                      <button
                        class="copy-btn"
                        title="Copy ext-BFF URL"
                        @click.stop="copyUrl(extBffUrl(v.version, versionFiles(v.version)[0].id))"
                      >
                        <q-icon name="mdi-content-copy" size="13px" />
                      </button>
                    </template>
                    <template v-else>
                      <q-btn-dropdown
                        flat dense no-caps unelevated size="xs"
                        icon="mdi-content-copy"
                        class="copy-dropdown"
                        dropdown-icon="mdi-chevron-down"
                        title="Copy ext-BFF URL"
                      >
                        <q-list dense style="min-width: 240px; padding: 4px 0">
                          <q-item
                            v-for="f in versionFiles(v.version)" :key="f.id"
                            clickable class="dl-item"
                            @click="copyUrl(extBffUrl(v.version, f.id))"
                          >
                            <q-item-section avatar style="min-width: 28px">
                              <q-icon name="mdi-content-copy" size="15px" class="muted-icon" />
                            </q-item-section>
                            <q-item-section>
                              <q-item-label class="fs-mono dl-item__name">{{ f.name }}</q-item-label>
                              <q-item-label caption class="dl-item__meta">
                                {{ formatSize(f.sizeBytes) }}
                                <template v-if="f.contentType"> · {{ f.contentType }}</template>
                              </q-item-label>
                            </q-item-section>
                          </q-item>
                        </q-list>
                      </q-btn-dropdown>
                    </template>
                  </template>

                  <!-- Public API copy button — only for versions with the public tag -->
                  <template v-if="extBffPublicPattern && hasPublicTag(v)">
                    <template v-if="versionFiles(v.version).length === 1">
                      <button
                        class="copy-btn copy-btn--public"
                        title="Copy public API URL"
                        @click.stop="copyUrl(publicApiUrl(v.version, versionFiles(v.version)[0].id))"
                      >
                        <q-icon name="mdi-earth" size="13px" />
                      </button>
                    </template>
                    <template v-else>
                      <q-btn-dropdown
                        flat dense no-caps unelevated size="xs"
                        icon="mdi-earth"
                        class="copy-dropdown copy-dropdown--public"
                        dropdown-icon="mdi-chevron-down"
                        title="Copy public API URL"
                      >
                        <q-list dense style="min-width: 240px; padding: 4px 0">
                          <q-item
                            v-for="f in versionFiles(v.version)" :key="f.id"
                            clickable class="dl-item"
                            @click="copyUrl(publicApiUrl(v.version, f.id))"
                          >
                            <q-item-section avatar style="min-width: 28px">
                              <q-icon name="mdi-earth" size="15px" class="muted-icon" />
                            </q-item-section>
                            <q-item-section>
                              <q-item-label class="fs-mono dl-item__name">{{ f.name }}</q-item-label>
                              <q-item-label caption class="dl-item__meta">
                                {{ formatSize(f.sizeBytes) }}
                                <template v-if="f.contentType"> · {{ f.contentType }}</template>
                              </q-item-label>
                            </q-item-section>
                          </q-item>
                        </q-list>
                      </q-btn-dropdown>
                    </template>
                  </template>

                </div>
              </template>
            </td>

            <!-- Published -->
            <td class="muted-text fs-mono">{{ relativeTime(v.createdAt) }}</td>

            <!-- Delete -->
            <td class="action-cell">
              <button
                v-if="can('index:versions:delete')"
                class="delete-version-btn"
                :disabled="deletingVersions.has(v.version) || tagMutating.has(v.id)"
                :title="`Delete ${v.version}`"
                @click.stop="confirmDeleteVersion(v)"
              >
                <q-spinner v-if="deletingVersions.has(v.version)" size="12px" />
                <q-icon v-else name="mdi-trash-can-outline" size="14px" />
              </button>
            </td>
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
.dl-cell   { min-width: 140px; }

.dl-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
}

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

.type-chips { display: flex; flex-wrap: wrap; gap: 4px; }

.tags-cell { min-width: 180px; }

.tag-cell {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding-right: 4px;
}
.tag-chip__x {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  display: flex;
  align-items: center;
  opacity: 0.6;
  line-height: 1;
  transition: opacity var(--fs-ease);
}
.tag-chip__x:hover:not(:disabled) { opacity: 1; }
.tag-chip__x:disabled             { opacity: 0.3; cursor: not-allowed; }

.tag-inline-input {
  width: 100px;
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-accent);
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 11.5px;
  color: var(--fs-text-primary);
  outline: none;
  height: 22px;
  box-sizing: border-box;
}

.tag-add-btn {
  background: none;
  border: 1px solid var(--fs-border);
  border-radius: 3px;
  padding: 2px 5px;
  cursor: pointer;
  color: var(--fs-text-muted);
  display: inline-flex;
  align-items: center;
  line-height: 1;
  transition: color var(--fs-ease), border-color var(--fs-ease);
}
.tag-add-btn:hover:not(:disabled) {
  color: var(--fs-accent);
  border-color: var(--fs-accent);
}
.tag-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.tag-action-btn {
  background: none;
  border: 1px solid var(--fs-border);
  border-radius: 3px;
  padding: 2px 5px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  line-height: 1;
  height: 22px;
  transition: color var(--fs-ease), border-color var(--fs-ease), background var(--fs-ease);
}
.tag-action-btn--ok {
  color: var(--fs-pos, #4caf50);
  border-color: var(--fs-pos, #4caf50);
}
.tag-action-btn--ok:hover {
  background: color-mix(in srgb, var(--fs-pos, #4caf50) 12%, transparent);
}
.tag-action-btn--cancel { color: var(--fs-text-muted); }
.tag-action-btn--cancel:hover {
  color: var(--fs-neg, #e57373);
  border-color: var(--fs-neg, #e57373);
}

.tag-row-error {
  display: block;
  font-size: 10.5px;
  color: var(--fs-neg, #e57373);
  margin-top: 3px;
}

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

.delete-artifact-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 11.5px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  color: var(--fs-text-muted);
  background: none;
  border: 1px solid var(--fs-border-bright);
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease);
  white-space: nowrap;
}
.delete-artifact-btn:hover:not(:disabled) {
  color: var(--fs-neg);
  border-color: var(--fs-neg);
  background: color-mix(in srgb, var(--fs-neg) 8%, transparent);
}
.delete-artifact-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.action-cell { width: 36px; text-align: center; }

/* Copy-to-clipboard icon buttons */
.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: none;
  border: 1px solid var(--fs-border-bright);
  border-radius: 4px;
  cursor: pointer;
  color: var(--fs-text-muted);
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease);
  flex-shrink: 0;
}
.copy-btn:hover {
  color: var(--fs-accent);
  border-color: var(--fs-accent);
  background: var(--fs-bg-hover);
}
.copy-btn--public:hover {
  color: var(--fs-pos, #4caf50);
  border-color: var(--fs-pos, #4caf50);
  background: color-mix(in srgb, var(--fs-pos, #4caf50) 8%, transparent);
}

/* Copy-to-clipboard dropdowns */
.copy-dropdown {
  color: var(--fs-text-muted) !important;
  border: 1px solid var(--fs-border-bright) !important;
  border-radius: 4px !important;
  font-size: 11.5px !important;
  padding: 2px 6px !important;
}
.copy-dropdown:hover {
  color: var(--fs-accent) !important;
  border-color: var(--fs-accent) !important;
  background: var(--fs-bg-hover) !important;
}
.copy-dropdown--public:hover {
  color: var(--fs-pos, #4caf50) !important;
  border-color: var(--fs-pos, #4caf50) !important;
  background: color-mix(in srgb, var(--fs-pos, #4caf50) 8%, transparent) !important;
}

.delete-version-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  color: var(--fs-text-muted);
  transition: background var(--fs-ease), color var(--fs-ease);
}
.delete-version-btn:hover:not(:disabled) {
  color: var(--fs-neg);
  background: color-mix(in srgb, var(--fs-neg) 8%, transparent);
}
.delete-version-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>

<style>
.copy-fallback-url {
  margin-top: 6px;
  padding: 8px 10px;
  background: var(--fs-bg-hover, rgba(0,0,0,0.12));
  border: 1px solid var(--fs-border, rgba(255,255,255,0.08));
  border-radius: 4px;
  font-family: var(--fs-font-mono, 'JetBrains Mono', monospace);
  font-size: 11.5px;
  color: var(--fs-text-primary);
  word-break: break-all;
  white-space: pre-wrap;
  user-select: all;
}
</style>
