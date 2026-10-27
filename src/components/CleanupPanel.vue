<script setup lang="ts" generic="T extends { id: number }">
// One fusion-index age-based cleanup (GET/DELETE /admin/<path>?olderThan=): preview table,
// pagination and "Delete All" with confirm. Used by IndexCleanupPage for every such cleanup.
import { ref, shallowRef, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as indexApi from '@/api/indexApi'

interface CleanupColumn<R> {
  label:  string
  value:  (row: R) => string | number
  class?: string
  // Route to link the cell to, e.g. the artifact detail page
  link?:  (row: R) => string
}

const props = defineProps<{
  title:     string
  icon:      string
  path:      indexApi.AdminCleanupPath
  columns:   CleanupColumn<T>[]
  itemLabel: string   // plural noun for counts and the confirm dialog, e.g. "empty artifacts"
  hint?:     string   // one-line explanation shown above the table
  defaultOlderThanMs?: number
  // Bump to reload — a delete in one cleanup changes what the others match
  // (e.g. removing incomplete files leaves a version without files)
  refreshKey?: number
}>()

const emit = defineEmits<{ deleted: [result: indexApi.BulkDeleteResult] }>()

const $q = useQuasar()
const PAGE_SIZE = 20

const OLDER_THAN_OPTIONS = [
  { label: '1 hour',   ms: 3_600_000 },
  { label: '6 hours',  ms: 21_600_000 },
  { label: '24 hours', ms: 86_400_000 },
  { label: '7 days',   ms: 604_800_000 },
  { label: '30 days',  ms: 2_592_000_000 },
]

const olderThanMs = ref(props.defaultOlderThanMs ?? 86_400_000)
const loading     = ref(false)
const error       = ref<string | null>(null)
const items       = shallowRef<T[]>([])
const total       = ref(0)
const page        = ref(1)
const deleting    = ref(false)
const result      = ref<indexApi.BulkDeleteResult | null>(null)

function olderThanISO(): string {
  return new Date(Date.now() - olderThanMs.value).toISOString()
}

async function load() {
  loading.value = true; error.value = null
  try {
    const r = await indexApi.adminList<T>(props.path, { olderThan: olderThanISO(), page: page.value - 1, pageSize: PAGE_SIZE })
    items.value = r.items ?? []; total.value = r.total
  } catch (e) { error.value = e instanceof Error ? e.message : 'Failed to load' }
  finally { loading.value = false }
}

watch(page, load)
watch(() => props.refreshKey, load)
watch(olderThanMs, () => { page.value = 1; result.value = null; load() })
onMounted(load)

function deleteAll() {
  $q.dialog({
    title: 'Confirm bulk delete',
    message: `Delete all ${total.value} ${props.itemLabel} older than the selected threshold? Items carrying the protected tag will be skipped. This cannot be undone.`,
    ok: { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deleting.value = true
    try {
      result.value = await indexApi.adminDelete(props.path, olderThanISO())
      emit('deleted', result.value)
      page.value = 1
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
    } finally { deleting.value = false }
  })
}
</script>

<template>
  <CanvasPanel :title="title" :icon="icon" :wide="true" :loading="loading" :error="error ?? undefined" @refresh="load">
    <template #actions>
      <span class="section-hint">{{ total }} found</span>
      <select v-model="olderThanMs" class="fs-field">
        <option v-for="o in OLDER_THAN_OPTIONS" :key="o.ms" :value="o.ms">older than {{ o.label }}</option>
      </select>
      <button class="fs-btn fs-btn--danger" :disabled="total === 0 || deleting" @click="deleteAll">
        <q-icon name="mdi-delete-sweep-outline" size="14px" />
        Delete All
      </button>
    </template>

    <div v-if="hint" class="panel-hint">{{ hint }}</div>

    <div v-if="result" class="result-bar result-bar--done">
      Deleted {{ result.deleted }}<span v-if="result.skipped"> · {{ result.skipped }} skipped (protected)</span>
    </div>

    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th v-for="c in columns" :key="c.label">{{ c.label }}</th></tr></thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td v-for="c in columns" :key="c.label" :class="c.class">
              <router-link v-if="c.link" :to="c.link(row)">{{ c.value(row) }}</router-link>
              <template v-else>{{ c.value(row) }}</template>
            </td>
          </tr>
          <tr v-if="!loading && items.length === 0">
            <td :colspan="columns.length" class="empty-row">No {{ itemLabel }} found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > PAGE_SIZE" class="pagination-row">
      <q-pagination v-model="page" :max="Math.ceil(total / PAGE_SIZE)" :max-pages="7"
        direction-links boundary-links size="sm" color="grey" active-color="primary" />
      <span class="pagination-hint">{{ total }} total</span>
    </div>
  </CanvasPanel>
</template>

<style scoped lang="scss">
@use '@/css/admin-page';

.panel-hint {
  font-size: 12px;
  color: var(--fs-text-muted);
  margin-bottom: 10px;
}
</style>
