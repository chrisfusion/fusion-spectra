<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { bffAdminApi } from '@/api/bffAdminApi'
import { getSystemHealth, type LiveResult, type ServiceOverride } from '@/api/bffStatusApi'
import { usePermission } from '@/composables/usePermission'

const $q = useQuasar()
const { can } = usePermission()

interface ServiceEntry {
  name:     string
  label:    string
  icon:     string
  live:     LiveResult | null
  override: ServiceOverride | null
}

const SERVICE_META: { name: string; label: string; icon: string }[] = [
  { name: 'forge',   label: 'Forge',        icon: 'mdi-hammer-wrench' },
  { name: 'index',   label: 'Fusion Index', icon: 'mdi-database-search-outline' },
  { name: 'weave',   label: 'Weave',        icon: 'mdi-share-variant-outline' },
  { name: 'spectra', label: 'Spectra',      icon: 'mdi-application-outline' },
]

const STATUS_OPTIONS = ['Healthy', 'Unhealthy', 'Offline', 'Maintenance'] as const

const OVERRIDE_BADGE: Record<string, string> = {
  Healthy:     'pos',
  Unhealthy:   'neg',
  Offline:     'info',
  Maintenance: 'warn',
}

const OVERRIDE_DOT: Record<string, string> = {
  Healthy:     'ok',
  Unhealthy:   'failed',
  Offline:     'idle',
  Maintenance: 'pending',
}

const entries  = ref<ServiceEntry[]>([])
const loading  = ref(false)
const error    = ref<string | null>(null)

const editingService = ref<string | null>(null)
const editStatus     = ref('')
const editDesc       = ref('')
const saving         = ref(false)
const saveError      = ref('')

const deleting = ref<Set<string>>(new Set())

async function load() {
  loading.value = true
  error.value   = null
  try {
    const [overrides, health] = await Promise.all([
      bffAdminApi.listServiceStatusOverrides(),
      getSystemHealth(),
    ])
    const overrideMap = Object.fromEntries(overrides.map(o => [o.service, o]))
    const liveMap     = Object.fromEntries((health.services ?? []).map(s => [s.name, s.live]))
    entries.value = SERVICE_META.map(m => ({
      name:     m.name,
      label:    m.label,
      icon:     m.icon,
      live:     liveMap[m.name] ?? null,
      override: overrideMap[m.name] ?? null,
    }))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load service status'
  } finally {
    loading.value = false
  }
}

function overallDotClass(entry: ServiceEntry): string {
  if (entry.override) return `fs-dot--${OVERRIDE_DOT[entry.override.status] ?? 'idle'}`
  if (entry.live === null) return 'fs-dot--idle'
  return entry.live.reachable ? 'fs-dot--ok' : 'fs-dot--failed'
}

function startEdit(entry: ServiceEntry) {
  editingService.value = entry.name
  editStatus.value     = entry.override?.status ?? 'Healthy'
  editDesc.value       = entry.override?.description ?? ''
  saveError.value      = ''
}

function cancelEdit() {
  editingService.value = null
  saveError.value      = ''
}

async function confirmEdit(serviceName: string) {
  if (!editStatus.value) { saveError.value = 'Status is required'; return }
  saving.value    = true
  saveError.value = ''
  try {
    const updated = await bffAdminApi.upsertServiceStatusOverride(serviceName, editStatus.value, editDesc.value.trim())
    const idx = entries.value.findIndex(e => e.name === serviceName)
    if (idx !== -1) entries.value[idx] = { ...entries.value[idx], override: updated }
    editingService.value = null
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save override'
  } finally {
    saving.value = false
  }
}

function confirmClear(entry: ServiceEntry) {
  $q.dialog({
    title: 'Clear override',
    message: `Remove the manual override for <b>${entry.label}</b>?`,
    html: true,
    ok:     { label: 'Clear', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deleting.value = new Set([...deleting.value, entry.name])
    try {
      await bffAdminApi.deleteServiceStatusOverride(entry.name)
      const idx = entries.value.findIndex(e => e.name === entry.name)
      if (idx !== -1) entries.value[idx] = { ...entries.value[idx], override: null }
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Failed to clear override' })
    } finally {
      deleting.value = new Set([...deleting.value].filter(n => n !== entry.name))
    }
  })
}

onMounted(load)
</script>

<template>
  <div class="page-grid">
    <CanvasPanel
      title="Service Status Overrides"
      icon="mdi-heart-pulse"
      :wide="true"
      :loading="loading && entries.length === 0"
      :error="error"
      @refresh="load"
    >
      <template #actions>
        <q-spinner v-if="loading && entries.length > 0" size="14px" color="grey-6" />
        <q-btn flat round dense icon="mdi-refresh" size="sm" :disable="loading" @click="load" />
      </template>

      <div class="svc-grid">
        <div v-for="entry in entries" :key="entry.name" class="svc-card">

          <!-- View mode -->
          <template v-if="editingService !== entry.name">
            <div class="svc-card__header">
              <span class="fs-dot" :class="overallDotClass(entry)" />
              <q-icon :name="entry.icon" size="14px" class="svc-card__icon" />
              <span class="svc-card__name">{{ entry.label }}</span>
              <button
                v-if="can('admin:health:manage')"
                class="action-btn"
                :disabled="deleting.has(entry.name)"
                @click="startEdit(entry)"
              >
                {{ entry.override ? 'Edit' : 'Set Override' }}
              </button>
            </div>

            <div class="svc-row">
              <span class="svc-row__label">Live</span>
              <template v-if="entry.live !== null">
                <span class="fs-dot svc-row__dot" :class="entry.live.reachable ? 'fs-dot--ok' : 'fs-dot--failed'" />
                <span class="svc-row__val fs-mono">
                  {{ entry.live.reachable ? 'Reachable' : 'Unreachable' }}
                  <span v-if="entry.live.latency_ms != null" class="svc-row__meta">
                    · {{ entry.live.latency_ms }} ms
                  </span>
                </span>
              </template>
              <span v-else class="svc-row__val svc-row__none">— no probe</span>
            </div>

            <div class="svc-row">
              <span class="svc-row__label">Override</span>
              <template v-if="entry.override">
                <span class="fs-badge" :class="`fs-badge--${OVERRIDE_BADGE[entry.override.status] ?? 'info'}`">
                  {{ entry.override.status }}
                </span>
                <span v-if="entry.override.description" class="svc-row__desc">
                  {{ entry.override.description }}
                </span>
                <button
                  v-if="can('admin:health:manage')"
                  class="icon-btn icon-btn--danger"
                  :disabled="deleting.has(entry.name)"
                  title="Clear override"
                  @click="confirmClear(entry)"
                >
                  <q-spinner v-if="deleting.has(entry.name)" size="11px" />
                  <q-icon v-else name="mdi-trash-can-outline" size="13px" />
                </button>
              </template>
              <span v-else class="svc-row__val svc-row__none">No override</span>
            </div>
          </template>

          <!-- Edit mode -->
          <template v-else>
            <div class="svc-card__header">
              <q-icon :name="entry.icon" size="14px" class="svc-card__icon" />
              <span class="svc-card__name">{{ entry.label }}</span>
            </div>

            <div class="svc-row">
              <span class="svc-row__label">Status</span>
              <select v-model="editStatus" class="inline-select" :disabled="saving">
                <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>

            <div class="svc-row">
              <span class="svc-row__label">Notes</span>
              <input
                v-model="editDesc"
                class="inline-input"
                placeholder="Optional description"
                maxlength="500"
                :disabled="saving"
                @keydown.enter="confirmEdit(entry.name)"
                @keydown.escape="cancelEdit"
              />
            </div>

            <div class="edit-actions">
              <button class="icon-btn icon-btn--ok" :disabled="saving" title="Save" @click="confirmEdit(entry.name)">
                <q-spinner v-if="saving" size="11px" />
                <q-icon v-else name="mdi-check" size="13px" />
              </button>
              <button class="icon-btn" :disabled="saving" title="Cancel" @click="cancelEdit">
                <q-icon name="mdi-close" size="13px" />
              </button>
            </div>
            <span v-if="saveError" class="row-error">{{ saveError }}</span>
          </template>

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

.svc-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.svc-card {
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.svc-card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.svc-card__icon { color: var(--fs-text-muted); flex-shrink: 0; }

.svc-card__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--fs-text-primary);
  letter-spacing: 0.02em;
  flex: 1;
}

.svc-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
}

.svc-row__label {
  width: 56px;
  flex-shrink: 0;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fs-text-muted);
}

.svc-row__dot  { flex-shrink: 0; }

.svc-row__val {
  color: var(--fs-text-secondary);
  font-size: 11.5px;
}

.svc-row__meta {
  color: var(--fs-text-muted);
  font-size: 10.5px;
}

.svc-row__none {
  color: var(--fs-text-muted);
  font-style: italic;
}

.svc-row__desc {
  color: var(--fs-text-muted);
  font-size: 10.5px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.edit-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  justify-content: flex-end;
}

.row-error {
  font-size: 10.5px;
  color: var(--fs-neg, #e57373);
}

.inline-input {
  flex: 1;
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-accent);
  border-radius: 3px;
  padding: 4px 7px;
  font-size: 12px;
  color: var(--fs-text-primary);
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
  min-width: 0;
}
.inline-input:disabled { opacity: 0.5; }

.inline-select {
  flex: 1;
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-accent);
  border-radius: 3px;
  padding: 4px 7px;
  font-size: 12px;
  color: var(--fs-text-primary);
  outline: none;
  font-family: inherit;
  cursor: pointer;
}
.inline-select:disabled { opacity: 0.5; }

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 3px;
  font-size: 11px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  color: var(--fs-accent);
  background: none;
  border: 1px solid var(--fs-border-bright);
  transition: background var(--fs-ease), border-color var(--fs-ease);
  white-space: nowrap;
  flex-shrink: 0;
}
.action-btn:hover:not(:disabled) {
  background: var(--fs-bg-hover);
  border-color: var(--fs-accent);
}
.action-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.icon-btn {
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
  flex-shrink: 0;
}
.icon-btn:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.icon-btn--ok:hover:not(:disabled) {
  color: var(--fs-pos, #4caf50);
  background: color-mix(in srgb, var(--fs-pos, #4caf50) 10%, transparent);
}
.icon-btn--danger:hover:not(:disabled) {
  color: var(--fs-neg, #e57373);
  background: color-mix(in srgb, var(--fs-neg, #e57373) 8%, transparent);
}
</style>
