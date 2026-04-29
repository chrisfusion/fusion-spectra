<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { usePermission } from '@/composables/usePermission'
import * as weaveApi from '@/api/weaveApi'

const router = useRouter()
const $q     = useQuasar()
const { can } = usePermission()

const PAGE_SIZE = 20

const loading = ref(false)
const error   = ref<string | null>(null)
const result  = ref<weaveApi.WeaveChainList | null>(null)

const nameSearch  = ref('')
const currentPage = ref(1)

const deletingNames = ref<Set<string>>(new Set())

async function loadChains() {
  loading.value = true
  error.value   = null
  try {
    result.value = await weaveApi.listWeaveChains()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load chains'
  } finally {
    loading.value = false
  }
}

const allItems = computed(() => result.value?.items ?? [])

const filteredItems = computed(() => {
  const q = nameSearch.value.trim().toLowerCase()
  return q ? allItems.value.filter(c => c.metadata.name.toLowerCase().includes(q)) : allItems.value
})

const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredItems.value.slice(start, start + PAGE_SIZE)
})

function onSearch() {
  currentPage.value = 1
}

function chainAge(c: weaveApi.WeaveChain): string {
  const ts = c.metadata.creationTimestamp
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

function confirmDelete(c: weaveApi.WeaveChain) {
  $q.dialog({
    title:   'Delete Chain',
    message: `Delete <strong>${c.metadata.name}</strong>? This cannot be undone.`,
    html:    true,
    ok:     { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deletingNames.value = new Set([...deletingNames.value, c.metadata.name])
    try {
      await weaveApi.deleteWeaveChain(c.metadata.name)
      await loadChains()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
    } finally {
      deletingNames.value = new Set([...deletingNames.value].filter(n => n !== c.metadata.name))
    }
  })
}

onMounted(loadChains)
</script>

<template>
  <div class="page-grid">
    <CanvasPanel
      title="Weave Chains"
      icon="mdi-link-chain"
      :wide="true"
      :loading="loading"
      :error="error ?? undefined"
      @refresh="loadChains"
    >
      <template #actions>
        <button
          v-if="can('weave:chains:write')"
          class="fs-btn fs-btn--primary"
          @click="router.push('/pipelines/weave/chains/create')"
        >
          <q-icon name="mdi-plus" size="14px" />
          Create
        </button>
      </template>

      <!-- Search -->
      <div class="toolbar">
        <input
          v-model="nameSearch"
          class="fs-input search-input"
          placeholder="Search by name…"
          @input="onSearch"
        />
        <span class="total-hint">{{ filteredItems.length }} chain{{ filteredItems.length !== 1 ? 's' : '' }}</span>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Steps</th>
              <th>Failure Policy</th>
              <th>Concurrency</th>
              <th>Valid</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in pagedItems" :key="c.metadata.name">
              <td class="col-name fs-mono">{{ c.metadata.name }}</td>
              <td class="col-num">{{ c.spec.steps.length }}</td>
              <td class="col-policy">
                <span class="policy-badge">{{ c.spec.failurePolicy ?? 'StopAll' }}</span>
              </td>
              <td class="col-policy">{{ c.spec.concurrencyPolicy ?? 'Wait' }}</td>
              <td>
                <span v-if="c.status?.valid === true"  class="valid-badge valid-badge--ok">
                  <q-icon name="mdi-check-circle-outline" size="12px" /> Valid
                </span>
                <span v-else-if="c.status?.valid === false" class="valid-badge valid-badge--err"
                      :title="c.status.validationMessage">
                  <q-icon name="mdi-alert-circle-outline" size="12px" /> Invalid
                </span>
                <span v-else class="valid-badge valid-badge--pending">
                  <q-icon name="mdi-clock-outline" size="12px" /> Pending
                </span>
              </td>
              <td class="col-muted">{{ chainAge(c) }}</td>
              <td class="col-actions">
                <button
                  v-if="can('weave:chains:delete')"
                  class="icon-btn icon-btn--danger"
                  :disabled="deletingNames.has(c.metadata.name)"
                  :title="`Delete ${c.metadata.name}`"
                  @click.stop="confirmDelete(c)"
                >
                  <q-spinner v-if="deletingNames.has(c.metadata.name)" size="13px" />
                  <q-icon v-else name="mdi-delete-outline" size="16px" />
                </button>
              </td>
            </tr>
            <tr v-if="!loading && pagedItems.length === 0">
              <td colspan="7" class="empty-row">No chains found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="filteredItems.length > PAGE_SIZE" class="pagination-row">
        <q-pagination
          v-model="currentPage"
          :max="Math.ceil(filteredItems.length / PAGE_SIZE)"
          :max-pages="7"
          direction-links
          boundary-links
          size="sm"
          color="grey"
          active-color="primary"
        />
        <span class="pagination-hint">{{ filteredItems.length }} total</span>
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

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
}
.search-input { width: 220px; }
.total-hint {
  margin-left: auto;
  font-size: 11px;
  color: var(--fs-text-muted);
}

/* Table */
.table-wrap { overflow-x: auto; }
.tpl-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.tpl-table th {
  text-align: left;
  padding: 6px 10px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.tpl-table td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--fs-border);
  color: var(--fs-text-primary);
  vertical-align: middle;
}
.tpl-table tbody tr:last-child td { border-bottom: none; }
.tpl-table tbody tr:hover td { background: var(--fs-bg-hover); }

.col-name    { font-weight: 500; color: var(--fs-accent); }
.col-num     { color: var(--fs-text-muted); text-align: center; }
.col-policy  { font-size: 12px; color: var(--fs-text-muted); }
.col-muted   { color: var(--fs-text-muted); font-size: 12px; }
.col-actions { width: 40px; text-align: center; }

.policy-badge {
  font-family: var(--fs-font-mono);
  font-size: 11px;
  color: var(--fs-text-secondary, var(--fs-text-muted));
}

.empty-row {
  text-align: center;
  color: var(--fs-text-muted);
  padding: 32px 10px !important;
}

/* Valid badges */
.valid-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.valid-badge--ok      { color: var(--fs-pos, #4caf50);  background: color-mix(in srgb, var(--fs-pos, #4caf50)  10%, transparent); }
.valid-badge--err     { color: var(--fs-neg, #e57373);  background: color-mix(in srgb, var(--fs-neg, #e57373)  10%, transparent); cursor: help; }
.valid-badge--pending { color: var(--fs-text-muted);    background: color-mix(in srgb, var(--fs-text-muted)    10%, transparent); }

/* Icon buttons */
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  color: var(--fs-text-muted);
  transition: color var(--fs-ease), background var(--fs-ease);
}
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.icon-btn--danger:hover:not(:disabled) { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

/* Pagination */
.pagination-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 12px;
}
.pagination-hint { font-size: 11px; color: var(--fs-text-muted); }

/* Shared */
.fs-input {
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--fs-text-primary);
  outline: none;
  transition: border-color var(--fs-ease);
  box-sizing: border-box;
}
.fs-input:focus { border-color: var(--fs-accent); }

.fs-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--fs-ease), filter var(--fs-ease);
}
.fs-btn--primary {
  background: var(--fs-accent);
  color: #fff;
  border-color: var(--fs-accent);
}
.fs-btn--primary:hover { filter: brightness(1.1); }

.fs-mono { font-family: var(--fs-font-mono); }
</style>
