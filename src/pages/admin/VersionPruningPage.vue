<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { usePermission } from '@/composables/usePermission'
import { formatSize } from '@/utils/format'
import * as indexApi from '@/api/indexApi'

const $q    = useQuasar()
const { can } = usePermission()

const PAGE_SIZE = 20
const MB = 1_048_576
const SEMVER_RE = /^\d+\.\d+\.\d+$/

// ── Filter form (raw inputs; converted to an indexApi.VersionFilter) ──────────

type TriState = '' | 'true' | 'false'

const form = reactive({
  keepLast:           '' as string | number,
  olderThanDays:      '' as string | number,
  from:               '',
  below:              '',
  hasFiles:           '' as TriState,
  hasIncompleteFiles: '' as TriState,
  minMB:              '' as string | number,
  maxMB:              '' as string | number,
})

function num(v: string | number): number | undefined {
  return v === '' || v === null ? undefined : Number(v)
}
function tri(v: TriState): boolean | undefined {
  return v === '' ? undefined : v === 'true'
}

const formError = computed<string | null>(() => {
  const kl = num(form.keepLast), days = num(form.olderThanDays)
  if (kl !== undefined && (!Number.isInteger(kl) || kl < 1)) return 'Keep last must be a whole number ≥ 1'
  if (days !== undefined && !(days > 0)) return 'Older than must be > 0 days'
  if (form.from && !SEMVER_RE.test(form.from)) return 'From must be a semver like 1.2.0'
  if (form.below && !SEMVER_RE.test(form.below)) return 'Below must be a semver like 2.0.0'
  for (const [label, v] of [['Min size', form.minMB], ['Max size', form.maxMB]] as const) {
    const n = num(v)
    if (n !== undefined && !(n >= 0)) return `${label} must be ≥ 0`
  }
  return null
})

// Built when Preview is clicked and reused unchanged for paging and Delete, so the delete
// always matches what was previewed (olderThan is fixed at that moment).
function buildFilter(): indexApi.VersionFilter {
  const days = num(form.olderThanDays)
  const minMB = num(form.minMB), maxMB = num(form.maxMB)
  return {
    keepLast:           num(form.keepLast),
    olderThan:          days !== undefined ? new Date(Date.now() - days * 86_400_000).toISOString() : undefined,
    from:               form.from || undefined,
    below:              form.below || undefined,
    hasFiles:           tri(form.hasFiles),
    hasIncompleteFiles: tri(form.hasIncompleteFiles),
    minBytes:           minMB !== undefined ? Math.round(minMB * MB) : undefined,
    maxBytes:           maxMB !== undefined ? Math.round(maxMB * MB) : undefined,
  }
}

const hasAnyFilter = computed(() => Object.values(buildFilter()).some(v => v !== undefined))

// ── Preview ───────────────────────────────────────────────────────────────────

const filter   = ref<indexApi.VersionFilter | null>(null)
const loading  = ref(false)
const error    = ref<string | null>(null)
const items    = ref<indexApi.ArtifactVersion[]>([])
const total    = ref(0)
const page     = ref(1)
const dryRun   = ref<indexApi.BulkVersionDeleteResult | null>(null)
const deleting = ref(false)
const result   = ref<indexApi.BulkVersionDeleteResult | null>(null)

async function loadPage() {
  if (!filter.value) return
  loading.value = true; error.value = null
  try {
    const r = await indexApi.listAllVersions(filter.value, page.value - 1, PAGE_SIZE, true)
    items.value = r.items ?? []; total.value = r.total
  } catch (e) { error.value = e instanceof Error ? e.message : 'Failed to load' }
  finally { loading.value = false }
}

async function preview() {
  if (formError.value || !hasAnyFilter.value) return
  filter.value = buildFilter()
  page.value = 1
  result.value = null
  loading.value = true; error.value = null
  try {
    // List (what goes) and dry run (how many are kept back) in parallel
    const [list, dry] = await Promise.all([
      indexApi.listAllVersions(filter.value, 0, PAGE_SIZE, true),
      indexApi.bulkDeleteVersions(filter.value, true),
    ])
    items.value = list.items ?? []; total.value = list.total
    dryRun.value = dry
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Preview failed'
    filter.value = null
  } finally { loading.value = false }
}

watch(page, loadPage)
// Any form change invalidates the preview — Delete only acts on a fresh one
watch(form, () => { filter.value = null; dryRun.value = null; items.value = []; total.value = 0 })

function deleteMatching() {
  if (!filter.value || !dryRun.value) return
  const f = filter.value
  $q.dialog({
    title: 'Delete versions',
    message: `Delete ${dryRun.value.deleted} versions and their files across all artifacts? `
      + `${dryRun.value.skipped} tagged or protected versions are kept. This cannot be undone.`,
    ok: { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deleting.value = true
    try {
      result.value = await indexApi.bulkDeleteVersions(f, false)
      // Refresh the preview with the same filter — it should now be empty
      const [list, dry] = await Promise.all([
        indexApi.listAllVersions(f, 0, PAGE_SIZE, true),
        indexApi.bulkDeleteVersions(f, true),
      ])
      page.value = 1
      items.value = list.items ?? []; total.value = list.total
      dryRun.value = dry
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
    } finally { deleting.value = false }
  })
}

function reset() {
  Object.assign(form, { keepLast: '', olderThanDays: '', from: '', below: '', hasFiles: '', hasIncompleteFiles: '', minMB: '', maxMB: '' })
  result.value = null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div v-if="!can('index:admin:manage')" class="no-perm">
    You do not have permission to access index maintenance.
  </div>
  <div v-else class="page-grid">

    <!-- ── Filters ───────────────────────────────────────────────────────────── -->
    <CanvasPanel title="Version Pruning" icon="mdi-content-cut" :wide="true" @refresh="filter && loadPage()">
      <div class="panel-hint">
        Deletes versions and their files across <strong>all</strong> artifacts. All set filters must match.
        Versions a tag points at and artifacts carrying the protection tag are never deleted.
      </div>

      <div class="filter-grid">
        <label class="form-row">
          <span class="form-label">Keep newest</span>
          <input v-model="form.keepLast" type="number" min="1" class="fs-field" placeholder="—" />
          <span class="form-help">per artifact</span>
        </label>
        <label class="form-row">
          <span class="form-label">Older than</span>
          <input v-model="form.olderThanDays" type="number" min="1" class="fs-field" placeholder="—" />
          <span class="form-help">days</span>
        </label>
        <label class="form-row">
          <span class="form-label">From version</span>
          <input v-model.trim="form.from" class="fs-field fs-mono" placeholder="e.g. 1.0.0" />
          <span class="form-help">inclusive</span>
        </label>
        <label class="form-row">
          <span class="form-label">Below version</span>
          <input v-model.trim="form.below" class="fs-field fs-mono" placeholder="e.g. 2.0.0" />
          <span class="form-help">exclusive</span>
        </label>
        <label class="form-row">
          <span class="form-label">Has files</span>
          <select v-model="form.hasFiles" class="fs-field">
            <option value="">any</option>
            <option value="true">yes</option>
            <option value="false">no file at all</option>
          </select>
        </label>
        <label class="form-row">
          <span class="form-label">Incomplete files</span>
          <select v-model="form.hasIncompleteFiles" class="fs-field">
            <option value="">any</option>
            <option value="true">has PENDING/ERROR</option>
            <option value="false">none</option>
          </select>
        </label>
        <label class="form-row">
          <span class="form-label">Min size</span>
          <input v-model="form.minMB" type="number" min="0" step="any" class="fs-field" placeholder="—" />
          <span class="form-help">MB</span>
        </label>
        <label class="form-row">
          <span class="form-label">Max size</span>
          <input v-model="form.maxMB" type="number" min="0" step="any" class="fs-field" placeholder="—" />
          <span class="form-help">MB</span>
        </label>
      </div>

      <div class="form-actions">
        <span v-if="formError" class="form-error">{{ formError }}</span>
        <span v-else-if="!hasAnyFilter" class="form-help">Set at least one filter.</span>
        <button class="fs-btn" @click="reset">Reset</button>
        <button class="fs-btn fs-btn--primary" :disabled="!!formError || !hasAnyFilter || loading" @click="preview">
          <q-icon name="mdi-eye-outline" size="14px" />
          Preview
        </button>
      </div>
    </CanvasPanel>

    <!-- ── Preview ───────────────────────────────────────────────────────────── -->
    <CanvasPanel
      title="Matching Versions"
      icon="mdi-format-list-checks"
      :wide="true"
      :loading="loading"
      :error="error ?? undefined"
      @refresh="filter && loadPage()"
    >
      <template #actions>
        <button
          class="fs-btn fs-btn--danger"
          :disabled="!dryRun || dryRun.deleted === 0 || deleting"
          @click="deleteMatching"
        >
          <q-icon name="mdi-delete-sweep-outline" size="14px" />
          Delete {{ dryRun ? dryRun.deleted : '' }}
        </button>
      </template>

      <div v-if="result" class="result-bar result-bar--done">
        Deleted {{ result.deleted }} versions<span v-if="result.skipped"> · {{ result.skipped }} kept (tagged or protected)</span>
      </div>
      <div v-if="dryRun" class="result-bar result-bar--info">
        {{ dryRun.deleted }} versions would be deleted<span v-if="dryRun.skipped"> · {{ dryRun.skipped }} match but are kept (tagged or protected)</span>
      </div>

      <div v-if="!filter" class="empty-row">Set filters and click Preview.</div>
      <template v-else>
        <div class="table-wrap">
          <table class="admin-table">
            <thead><tr>
              <th>Artifact ID</th><th>Version</th><th>Size</th><th>Created</th>
            </tr></thead>
            <tbody>
              <tr v-for="v in items" :key="v.id">
                <td class="col-id fs-mono"><router-link :to="`/fusion-index/artifacts/${v.artifactId}`">{{ v.artifactId }}</router-link></td>
                <td class="col-name fs-mono">{{ v.version }}</td>
                <td class="col-muted">{{ formatSize(v.totalBytes) }}</td>
                <td class="col-muted">{{ formatDate(v.createdAt) }}</td>
              </tr>
              <tr v-if="!loading && items.length === 0">
                <td colspan="4" class="empty-row">No deletable versions match.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="total > PAGE_SIZE" class="pagination-row">
          <q-pagination v-model="page" :max="Math.ceil(total / PAGE_SIZE)" :max-pages="7"
            direction-links boundary-links size="sm" color="grey" active-color="primary" />
          <span class="pagination-hint">{{ total }} total</span>
        </div>
      </template>
    </CanvasPanel>

  </div>
</template>

<style scoped lang="scss">
@use '@/css/admin-page';

.panel-hint {
  font-size: 12px;
  color: var(--fs-text-muted);
  margin-bottom: 14px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 12px 18px;
}
.form-row {
  display: grid;
  grid-template-columns: 110px minmax(80px, 1fr) auto;
  align-items: center;
  gap: 8px;
}
.form-label { font-size: 12px; color: var(--fs-text-muted); }
.form-row .fs-field { width: 100%; min-width: 0; }
.form-help  { font-size: 11px; color: var(--fs-text-muted); }
.form-error { font-size: 12px; color: var(--fs-neg, #e57373); }

.form-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}
</style>
