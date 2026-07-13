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
const result  = ref<weaveApi.WeaveTriggerList | null>(null)

const nameSearch  = ref('')
const currentPage = ref(1)

const deletingNames = ref<Set<string>>(new Set())
const firingNames   = ref<Set<string>>(new Set())
const pausingNames  = ref<Set<string>>(new Set())

async function loadTriggers() {
  loading.value = true
  error.value   = null
  try {
    result.value = await weaveApi.listWeaveTriggers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load triggers'
  } finally {
    loading.value = false
  }
}

const allItems = computed(() => result.value?.items ?? [])

const filteredItems = computed(() => {
  const q = nameSearch.value.trim().toLowerCase()
  return q ? allItems.value.filter(t => t.metadata.name.toLowerCase().includes(q)) : allItems.value
})

const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredItems.value.slice(start, start + PAGE_SIZE)
})

function onSearch() {
  currentPage.value = 1
}

function triggerAge(t: weaveApi.WeaveTrigger): string {
  const ts = t.metadata.creationTimestamp
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

const TYPE_ICONS: Record<string, string> = {
  Cron:      'mdi-clock-outline',
  Webhook:   'mdi-webhook',
  BatchCron: 'mdi-calendar-multiple',
  Kafka:     'mdi-apache-kafka',
  OnDemand:  'mdi-hand-back-right-outline',
}
function typeIcon(t: weaveApi.WeaveTrigger): string {
  return TYPE_ICONS[t.spec.type] ?? TYPE_ICONS.OnDemand
}

function confirmFire(t: weaveApi.WeaveTrigger) {
  $q.dialog({
    title:   'Fire Trigger',
    message: `Fire <strong>${t.metadata.name}</strong> now? A new WeaveRun will be created for chain <strong>${t.spec.chainRef.name}</strong>.`,
    html:    true,
    ok:     { label: 'Fire', color: 'warning', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    firingNames.value = new Set([...firingNames.value, t.metadata.name])
    try {
      await weaveApi.fireWeaveTrigger(t.metadata.name)
      $q.notify({ type: 'positive', message: `Trigger ${t.metadata.name} fired — run created.` })
      await loadTriggers()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Fire failed' })
    } finally {
      firingNames.value = new Set([...firingNames.value].filter(n => n !== t.metadata.name))
    }
  })
}

function canDelete(t: weaveApi.WeaveTrigger): boolean {
  if (t.spec.type === 'Kafka') return can('weave:kafkatriggers:delete')
  if (t.spec.type === 'BatchCron') return can('weave:batchtriggers:delete')
  return can('weave:triggers:delete')
}

function confirmDelete(t: weaveApi.WeaveTrigger) {
  $q.dialog({
    title:   'Delete Trigger',
    message: `Delete <strong>${t.metadata.name}</strong>? This cannot be undone.`,
    html:    true,
    ok:     { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deletingNames.value = new Set([...deletingNames.value, t.metadata.name])
    try {
      if (t.spec.type === 'Kafka') {
        await weaveApi.deleteKafkaTrigger(t.metadata.name)
      } else if (t.spec.type === 'BatchCron') {
        await weaveApi.deleteBatchTrigger(t.metadata.name)
      } else {
        await weaveApi.deleteWeaveTrigger(t.metadata.name)
      }
      await loadTriggers()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
    } finally {
      deletingNames.value = new Set([...deletingNames.value].filter(n => n !== t.metadata.name))
    }
  })
}

async function togglePause(t: weaveApi.WeaveTrigger) {
  pausingNames.value = new Set([...pausingNames.value, t.metadata.name])
  try {
    if (t.spec.paused) {
      await weaveApi.unpauseBatchTrigger(t.metadata.name)
      $q.notify({ type: 'positive', message: `Trigger ${t.metadata.name} resumed.` })
    } else {
      await weaveApi.pauseBatchTrigger(t.metadata.name)
      $q.notify({ type: 'positive', message: `Trigger ${t.metadata.name} paused.` })
    }
    await loadTriggers()
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Failed to update pause state' })
  } finally {
    pausingNames.value = new Set([...pausingNames.value].filter(n => n !== t.metadata.name))
  }
}

onMounted(loadTriggers)
</script>

<template>
  <div class="page-grid">
    <CanvasPanel
      title="Weave Triggers"
      icon="mdi-lightning-bolt-outline"
      :wide="true"
      :loading="loading"
      :error="error ?? undefined"
      @refresh="loadTriggers"
    >
      <template #actions>
        <button
          v-if="can('weave:triggers:write')"
          class="fs-btn fs-btn--primary"
          @click="router.push('/pipelines/weave/triggers/create')"
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
        <span class="total-hint">{{ filteredItems.length }} trigger{{ filteredItems.length !== 1 ? 's' : '' }}</span>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Chain</th>
              <th>Schedule / Path</th>
              <th>Active</th>
              <th>Last Run</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in pagedItems" :key="t.metadata.name">
              <td class="col-name fs-mono">
                {{ t.metadata.name }}
                <q-icon
                  v-if="t.spec.authSecretRefOverride"
                  name="mdi-key-outline"
                  size="12px"
                  class="auth-secret-icon"
                >
                  <q-tooltip :delay="400" anchor="top middle">
                    Auth secret override: {{ t.spec.authSecretRefOverride.name }}
                  </q-tooltip>
                </q-icon>
              </td>
              <td>
                <span class="type-badge" :class="`type-badge--${t.spec.type.toLowerCase()}`">
                  <q-icon :name="typeIcon(t)" size="11px" />
                  {{ t.spec.type }}
                </span>
              </td>
              <td class="col-chain fs-mono">{{ t.spec.chainRef.name }}</td>
              <td class="col-muted fs-mono">
                <span v-if="t.spec.type === 'Cron'">{{ t.spec.schedule ?? '—' }}</span>
                <span v-else-if="t.spec.type === 'Webhook'">{{ t.spec.webhook?.path ?? '—' }}</span>
                <span v-else-if="t.spec.type === 'Kafka'">{{ t.spec.kafka?.topic ?? '—' }}</span>
                <span v-else-if="t.spec.type === 'BatchCron'">
                  {{ t.status?.batchJobCount ?? 0 }} job{{ t.status?.batchJobCount === 1 ? '' : 's' }}
                  <q-icon
                    v-if="t.status?.batchJobErrors"
                    name="mdi-alert-outline"
                    size="12px"
                    class="batch-error-icon"
                  >
                    <q-tooltip :delay="400" anchor="top middle">
                      {{ t.status.batchJobErrors }} invalid job entr{{ t.status.batchJobErrors === 1 ? 'y' : 'ies' }}
                    </q-tooltip>
                  </q-icon>
                </span>
                <span v-else>—</span>
              </td>
              <td>
                <span v-if="t.status?.active" class="active-badge active-badge--on">
                  <q-icon name="mdi-check-circle-outline" size="12px" /> Active
                </span>
                <span v-else class="active-badge active-badge--off">
                  <q-icon name="mdi-pause-circle-outline" size="12px" /> Inactive
                </span>
                <span v-if="t.spec.paused" class="active-badge active-badge--paused">
                  <q-icon name="mdi-pause" size="12px" /> Paused
                </span>
              </td>
              <td class="col-muted fs-mono">{{ t.status?.lastRunName ?? '—' }}</td>
              <td class="col-muted">{{ triggerAge(t) }}</td>
              <td class="col-actions">
                <button
                  v-if="t.spec.type === 'BatchCron' && can('weave:batchtriggers:write')"
                  class="icon-btn"
                  :class="t.spec.paused ? 'icon-btn--fire' : 'icon-btn--danger'"
                  :disabled="pausingNames.has(t.metadata.name)"
                  :title="t.spec.paused ? 'Resume trigger' : 'Pause trigger'"
                  @click.stop="togglePause(t)"
                >
                  <q-spinner v-if="pausingNames.has(t.metadata.name)" size="13px" />
                  <q-icon v-else :name="t.spec.paused ? 'mdi-play-circle-outline' : 'mdi-pause-circle-outline'" size="16px" />
                </button>
                <button
                  v-if="t.spec.type === 'OnDemand' && can('weave:triggers:write')"
                  class="icon-btn icon-btn--fire"
                  :disabled="firingNames.has(t.metadata.name)"
                  title="Fire trigger"
                  @click.stop="confirmFire(t)"
                >
                  <q-spinner v-if="firingNames.has(t.metadata.name)" size="13px" />
                  <q-icon v-else name="mdi-play-circle-outline" size="16px" />
                </button>
                <button
                  v-if="canDelete(t)"
                  class="icon-btn icon-btn--danger"
                  :disabled="deletingNames.has(t.metadata.name)"
                  :title="`Delete ${t.metadata.name}`"
                  @click.stop="confirmDelete(t)"
                >
                  <q-spinner v-if="deletingNames.has(t.metadata.name)" size="13px" />
                  <q-icon v-else name="mdi-delete-outline" size="16px" />
                </button>
              </td>
            </tr>
            <tr v-if="!loading && pagedItems.length === 0">
              <td colspan="8" class="empty-row">No triggers found.</td>
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

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
}
.search-input { width: 220px; }
.total-hint { margin-left: auto; font-size: 11px; color: var(--fs-text-muted); }

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
.auth-secret-icon { color: var(--fs-text-muted); margin-left: 4px; vertical-align: middle; }
.col-chain   { color: var(--fs-text-secondary, var(--fs-text-muted)); font-size: 12px; }
.col-muted   { color: var(--fs-text-muted); font-size: 12px; }
.col-actions { width: 96px; text-align: center; white-space: nowrap; }

/* Type badge */
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background: color-mix(in srgb, var(--fs-accent) 10%, transparent);
  color: var(--fs-accent);
}
.type-badge--ondemand  { background: color-mix(in srgb, var(--fs-text-muted) 12%, transparent); color: var(--fs-text-muted); }
.type-badge--cron      { background: color-mix(in srgb, var(--fs-accent) 12%, transparent);     color: var(--fs-accent); }
.type-badge--webhook   { background: color-mix(in srgb, var(--fs-pos, #4caf50) 12%, transparent); color: var(--fs-pos, #4caf50); }
.type-badge--batchcron { background: color-mix(in srgb, #9575cd 12%, transparent); color: #9575cd; }
.type-badge--kafka     { background: color-mix(in srgb, var(--fs-warn, #ffa726) 12%, transparent); color: var(--fs-warn, #ffa726); }

.batch-error-icon { color: var(--fs-warn, #ffa726); margin-left: 3px; vertical-align: middle; }

/* Active badge */
.active-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.active-badge + .active-badge { margin-left: 4px; }
.active-badge--on     { color: var(--fs-pos, #4caf50); background: color-mix(in srgb, var(--fs-pos, #4caf50) 10%, transparent); }
.active-badge--off    { color: var(--fs-text-muted);   background: color-mix(in srgb, var(--fs-text-muted)   10%, transparent); }
.active-badge--paused { color: var(--fs-warn, #ffa726); background: color-mix(in srgb, var(--fs-warn, #ffa726) 10%, transparent); }

.empty-row { text-align: center; color: var(--fs-text-muted); padding: 32px 10px !important; }

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
.icon-btn--fire:hover:not(:disabled)   { color: var(--fs-warn, #ffa726); background: color-mix(in srgb, var(--fs-warn, #ffa726) 10%, transparent); }
.icon-btn--danger:hover:not(:disabled) { color: var(--fs-neg, #e57373);  background: color-mix(in srgb, var(--fs-neg, #e57373)  10%, transparent); }

.pagination-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 12px;
}
.pagination-hint { font-size: 11px; color: var(--fs-text-muted); }

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
.fs-btn--primary { background: var(--fs-accent); color: #fff; border-color: var(--fs-accent); }
.fs-btn--primary:hover { filter: brightness(1.1); }

.fs-mono { font-family: var(--fs-font-mono); }
</style>
