<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { usePermission } from '@/composables/usePermission'
import * as indexApi from '@/api/indexApi'

const $q    = useQuasar()
const { can } = usePermission()

const PAGE_SIZE = 20

const OLDER_THAN_OPTIONS = [
  { label: '1 hour',  ms: 3_600_000 },
  { label: '6 hours', ms: 21_600_000 },
  { label: '24 hours', ms: 86_400_000 },
  { label: '7 days',  ms: 604_800_000 },
  { label: '30 days', ms: 2_592_000_000 },
]

function toISO(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

// ── Per-section state ─────────────────────────────────────────────────────────

const ea = {
  olderThanMs: ref(86_400_000),
  loading:     ref(false),
  error:       ref<string | null>(null),
  items:       ref<indexApi.Artifact[]>([]),
  total:       ref(0),
  page:        ref(1),
  deleting:    ref(false),
  result:      ref<indexApi.BulkDeleteResult | null>(null),
}

const vf = {
  olderThanMs: ref(86_400_000),
  loading:     ref(false),
  error:       ref<string | null>(null),
  items:       ref<indexApi.ArtifactVersion[]>([]),
  total:       ref(0),
  page:        ref(1),
  deleting:    ref(false),
  result:      ref<indexApi.BulkDeleteResult | null>(null),
}

const af = {
  olderThanMs: ref(86_400_000),
  loading:     ref(false),
  error:       ref<string | null>(null),
  items:       ref<indexApi.Artifact[]>([]),
  total:       ref(0),
  page:        ref(1),
  deleting:    ref(false),
  result:      ref<indexApi.BulkDeleteResult | null>(null),
}

// ── Loaders ───────────────────────────────────────────────────────────────────

async function loadEmptyArtifacts() {
  ea.loading.value = true; ea.error.value = null
  try {
    const r = await indexApi.listEmptyArtifacts({ olderThan: toISO(ea.olderThanMs.value), page: ea.page.value - 1, pageSize: PAGE_SIZE })
    ea.items.value = r.items; ea.total.value = r.total
  } catch (e) { ea.error.value = e instanceof Error ? e.message : 'Failed to load' }
  finally { ea.loading.value = false }
}

async function loadVersionsWithoutFiles() {
  vf.loading.value = true; vf.error.value = null
  try {
    const r = await indexApi.listVersionsWithoutFiles({ olderThan: toISO(vf.olderThanMs.value), page: vf.page.value - 1, pageSize: PAGE_SIZE })
    vf.items.value = r.items; vf.total.value = r.total
  } catch (e) { vf.error.value = e instanceof Error ? e.message : 'Failed to load' }
  finally { vf.loading.value = false }
}

async function loadArtifactsWithoutFiles() {
  af.loading.value = true; af.error.value = null
  try {
    const r = await indexApi.listArtifactsWithoutFiles({ olderThan: toISO(af.olderThanMs.value), page: af.page.value - 1, pageSize: PAGE_SIZE })
    af.items.value = r.items; af.total.value = r.total
  } catch (e) { af.error.value = e instanceof Error ? e.message : 'Failed to load' }
  finally { af.loading.value = false }
}

watch(ea.page, loadEmptyArtifacts)
watch(ea.olderThanMs, () => { ea.page.value = 1; ea.result.value = null; loadEmptyArtifacts() })
watch(vf.page, loadVersionsWithoutFiles)
watch(vf.olderThanMs, () => { vf.page.value = 1; vf.result.value = null; loadVersionsWithoutFiles() })
watch(af.page, loadArtifactsWithoutFiles)
watch(af.olderThanMs, () => { af.page.value = 1; af.result.value = null; loadArtifactsWithoutFiles() })

onMounted(() => {
  loadEmptyArtifacts()
  loadVersionsWithoutFiles()
  loadArtifactsWithoutFiles()
})

// ── Delete helpers ─────────────────────────────────────────────────────────────

function confirmDelete(label: string, total: number, onOk: () => void) {
  $q.dialog({
    title: 'Confirm bulk delete',
    message: `Delete all ${total} ${label} older than the selected threshold? Items carrying the protected tag will be skipped. This cannot be undone.`,
    ok: { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(onOk)
}

async function deleteEmptyArtifacts() {
  confirmDelete('empty artifacts', ea.total.value, async () => {
    ea.deleting.value = true
    try {
      ea.result.value = await indexApi.deleteEmptyArtifacts(toISO(ea.olderThanMs.value))
      ea.page.value = 1
      await loadEmptyArtifacts()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
    } finally { ea.deleting.value = false }
  })
}

async function deleteVersionsWithoutFiles() {
  confirmDelete('empty versions', vf.total.value, async () => {
    vf.deleting.value = true
    try {
      vf.result.value = await indexApi.deleteVersionsWithoutFiles(toISO(vf.olderThanMs.value))
      vf.page.value = 1
      await loadVersionsWithoutFiles()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
    } finally { vf.deleting.value = false }
  })
}

async function deleteArtifactsWithoutFiles() {
  confirmDelete('file-less artifacts', af.total.value, async () => {
    af.deleting.value = true
    try {
      af.result.value = await indexApi.deleteArtifactsWithoutFiles(toISO(af.olderThanMs.value))
      af.page.value = 1
      await loadArtifactsWithoutFiles()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
    } finally { af.deleting.value = false }
  })
}
</script>

<template>
  <div v-if="!can('index:admin:manage')" class="no-perm">
    You do not have permission to access index maintenance.
  </div>
  <div v-else class="page-grid">

    <!-- ── Empty Artifacts ───────────────────────────────────────────────────── -->
    <CanvasPanel
      title="Empty Artifacts"
      icon="mdi-archive-off-outline"
      :wide="true"
      :loading="ea.loading.value"
      :error="ea.error.value ?? undefined"
      @refresh="loadEmptyArtifacts"
    >
      <template #actions>
        <span class="section-hint">{{ ea.total.value }} found</span>
        <select v-model="ea.olderThanMs.value" class="older-than-select">
          <option v-for="o in OLDER_THAN_OPTIONS" :key="o.ms" :value="o.ms">older than {{ o.label }}</option>
        </select>
        <button
          v-if="can('index:admin:manage')"
          class="fs-btn fs-btn--danger"
          :disabled="ea.total.value === 0 || ea.deleting.value"
          @click="deleteEmptyArtifacts"
        >
          <q-icon name="mdi-delete-sweep-outline" size="14px" />
          Delete All
        </button>
      </template>

      <div v-if="ea.result.value" class="result-bar result-bar--done">
        Deleted {{ ea.result.value.deleted }}<span v-if="ea.result.value.skipped"> · {{ ea.result.value.skipped }} skipped (protected)</span>
      </div>

      <div class="table-wrap">
        <table class="cleanup-table">
          <thead><tr>
            <th>ID</th><th>Full Name</th><th>Created</th>
          </tr></thead>
          <tbody>
            <tr v-for="a in ea.items.value" :key="a.id">
              <td class="col-id fs-mono">{{ a.id }}</td>
              <td class="col-name fs-mono">{{ a.fullName }}</td>
              <td class="col-muted">{{ formatDate(a.createdAt) }}</td>
            </tr>
            <tr v-if="!ea.loading.value && ea.items.value.length === 0">
              <td colspan="3" class="empty-row">No empty artifacts found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="ea.total.value > PAGE_SIZE" class="pagination-row">
        <q-pagination v-model="ea.page.value" :max="Math.ceil(ea.total.value / PAGE_SIZE)" :max-pages="7"
          direction-links boundary-links size="sm" color="grey" active-color="primary" />
        <span class="pagination-hint">{{ ea.total.value }} total</span>
      </div>
    </CanvasPanel>

    <!-- ── Versions Without Files ─────────────────────────────────────────────── -->
    <CanvasPanel
      title="Versions Without Files"
      icon="mdi-code-tags-check"
      :wide="true"
      :loading="vf.loading.value"
      :error="vf.error.value ?? undefined"
      @refresh="loadVersionsWithoutFiles"
    >
      <template #actions>
        <span class="section-hint">{{ vf.total.value }} found</span>
        <select v-model="vf.olderThanMs.value" class="older-than-select">
          <option v-for="o in OLDER_THAN_OPTIONS" :key="o.ms" :value="o.ms">older than {{ o.label }}</option>
        </select>
        <button
          v-if="can('index:admin:manage')"
          class="fs-btn fs-btn--danger"
          :disabled="vf.total.value === 0 || vf.deleting.value"
          @click="deleteVersionsWithoutFiles"
        >
          <q-icon name="mdi-delete-sweep-outline" size="14px" />
          Delete All
        </button>
      </template>

      <div v-if="vf.result.value" class="result-bar result-bar--done">
        Deleted {{ vf.result.value.deleted }}<span v-if="vf.result.value.skipped"> · {{ vf.result.value.skipped }} skipped (protected)</span>
      </div>

      <div class="table-wrap">
        <table class="cleanup-table">
          <thead><tr>
            <th>Version ID</th><th>Artifact ID</th><th>Version</th><th>Created</th>
          </tr></thead>
          <tbody>
            <tr v-for="v in vf.items.value" :key="v.id">
              <td class="col-id fs-mono">{{ v.id }}</td>
              <td class="col-id fs-mono">{{ v.artifactId }}</td>
              <td class="col-name fs-mono">{{ v.version }}</td>
              <td class="col-muted">{{ formatDate(v.createdAt) }}</td>
            </tr>
            <tr v-if="!vf.loading.value && vf.items.value.length === 0">
              <td colspan="4" class="empty-row">No empty versions found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="vf.total.value > PAGE_SIZE" class="pagination-row">
        <q-pagination v-model="vf.page.value" :max="Math.ceil(vf.total.value / PAGE_SIZE)" :max-pages="7"
          direction-links boundary-links size="sm" color="grey" active-color="primary" />
        <span class="pagination-hint">{{ vf.total.value }} total</span>
      </div>
    </CanvasPanel>

    <!-- ── Artifacts Without Files ────────────────────────────────────────────── -->
    <CanvasPanel
      title="Artifacts Without Files"
      icon="mdi-folder-open-outline"
      :wide="true"
      :loading="af.loading.value"
      :error="af.error.value ?? undefined"
      @refresh="loadArtifactsWithoutFiles"
    >
      <template #actions>
        <span class="section-hint">{{ af.total.value }} found</span>
        <select v-model="af.olderThanMs.value" class="older-than-select">
          <option v-for="o in OLDER_THAN_OPTIONS" :key="o.ms" :value="o.ms">older than {{ o.label }}</option>
        </select>
        <button
          v-if="can('index:admin:manage')"
          class="fs-btn fs-btn--danger"
          :disabled="af.total.value === 0 || af.deleting.value"
          @click="deleteArtifactsWithoutFiles"
        >
          <q-icon name="mdi-delete-sweep-outline" size="14px" />
          Delete All
        </button>
      </template>

      <div v-if="af.result.value" class="result-bar result-bar--done">
        Deleted {{ af.result.value.deleted }}<span v-if="af.result.value.skipped"> · {{ af.result.value.skipped }} skipped (protected)</span>
      </div>

      <div class="table-wrap">
        <table class="cleanup-table">
          <thead><tr>
            <th>ID</th><th>Full Name</th><th>Created</th>
          </tr></thead>
          <tbody>
            <tr v-for="a in af.items.value" :key="a.id">
              <td class="col-id fs-mono">{{ a.id }}</td>
              <td class="col-name fs-mono">{{ a.fullName }}</td>
              <td class="col-muted">{{ formatDate(a.createdAt) }}</td>
            </tr>
            <tr v-if="!af.loading.value && af.items.value.length === 0">
              <td colspan="3" class="empty-row">No file-less artifacts found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="af.total.value > PAGE_SIZE" class="pagination-row">
        <q-pagination v-model="af.page.value" :max="Math.ceil(af.total.value / PAGE_SIZE)" :max-pages="7"
          direction-links boundary-links size="sm" color="grey" active-color="primary" />
        <span class="pagination-hint">{{ af.total.value }} total</span>
      </div>
    </CanvasPanel>

  </div>
</template>

<style scoped>
.no-perm {
  padding: 32px;
  color: var(--fs-text-muted);
  font-size: 13px;
}

.page-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 16px;
  align-content: start;
}

/* Actions slot */
.section-hint {
  font-size: 11px;
  color: var(--fs-text-muted);
  margin-right: 4px;
}

.older-than-select {
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: inherit;
  color: var(--fs-text-primary);
  cursor: pointer;
  outline: none;
}
.older-than-select:focus { border-color: var(--fs-accent); }

.fs-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity var(--fs-ease);
}
.fs-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fs-btn--danger {
  background: color-mix(in srgb, var(--fs-neg, #e57373) 15%, transparent);
  border-color: var(--fs-neg, #e57373);
  color: var(--fs-neg, #e57373);
}
.fs-btn--danger:not(:disabled):hover { background: color-mix(in srgb, var(--fs-neg, #e57373) 25%, transparent); }

/* Result bar */
.result-bar {
  padding: 7px 12px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 10px;
}
.result-bar--done {
  background: color-mix(in srgb, var(--fs-pos, #4caf50) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fs-pos, #4caf50) 30%, transparent);
  color: var(--fs-pos, #4caf50);
}

/* Table */
.table-wrap { overflow-x: auto; }
.cleanup-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.cleanup-table th {
  text-align: left;
  padding: 6px 10px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.cleanup-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--fs-border);
  color: var(--fs-text-primary);
  vertical-align: middle;
}
.cleanup-table tbody tr:last-child td { border-bottom: none; }

.col-id   { width: 72px; color: var(--fs-text-muted); font-size: 12px; }
.col-name { font-weight: 500; }
.col-muted { color: var(--fs-text-muted); font-size: 12px; }
.empty-row { text-align: center; color: var(--fs-text-muted); padding: 28px 10px !important; }

/* Pagination */
.pagination-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 12px;
}
.pagination-hint { font-size: 11px; color: var(--fs-text-muted); }
.fs-mono { font-family: var(--fs-font-mono); }
</style>
