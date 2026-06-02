<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { usePermission } from '@/composables/usePermission'
import * as forgeApi from '@/api/forgeApi'

const $q    = useQuasar()
const { can } = usePermission()

const OLDER_THAN_OPTIONS = [
  { label: '1 hour',   ms: 3_600_000 },
  { label: '6 hours',  ms: 21_600_000 },
  { label: '24 hours', ms: 86_400_000 },
  { label: '7 days',   ms: 604_800_000 },
  { label: '30 days',  ms: 2_592_000_000 },
]

const BUILD_TYPE_OPTIONS = [
  { label: 'All types',        value: '' },
  { label: 'Requirements',     value: 'requirements' },
  { label: 'Python Builder',   value: 'git' },
  { label: 'Generic Builder',  value: 'app' },
]

const STATUS_OPTIONS = [
  { label: 'Failed',    value: 'FAILED' },
  { label: 'Succeeded', value: 'SUCCESS' },
]

// ─── Bulk delete state ────────────────────────────────────────────────────────

const olderThanMs  = ref(86_400_000)
const buildType    = ref('')
const statuses     = ref<string[]>(['FAILED'])
const deleting     = ref(false)
const result       = ref<forgeApi.BulkDeleteBuildsResult | null>(null)

// ─── Zombie cleanup state ─────────────────────────────────────────────────────

const zombieOlderThanMs = ref(86_400_000)
const zombieBuildType   = ref('')
const zombieRunning     = ref(false)
const zombieResult      = ref<forgeApi.BulkDeleteBuildsResult | null>(null)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

function doDelete() {
  if (statuses.value.length === 0) {
    $q.notify({ type: 'warning', message: 'Select at least one status.' })
    return
  }

  const typLabel  = BUILD_TYPE_OPTIONS.find(o => o.value === buildType.value)?.label ?? 'all types'
  const stLabel   = statuses.value.map(s => s === 'FAILED' ? 'Failed' : 'Succeeded').join(' + ')
  const ageLabel  = OLDER_THAN_OPTIONS.find(o => o.ms === olderThanMs.value)?.label ?? '?'

  $q.dialog({
    title: 'Confirm bulk delete',
    message: `Delete all ${stLabel} ${typLabel} builds older than ${ageLabel}? This cannot be undone.`,
    ok:     { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deleting.value = true
    result.value   = null
    try {
      result.value = await forgeApi.bulkDeleteBuilds({
        statuses:    statuses.value,
        older_than:  toISO(olderThanMs.value),
        build_type:  buildType.value || undefined,
      })
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
    } finally {
      deleting.value = false
    }
  })
}

function doZombieCleanup() {
  const typLabel = BUILD_TYPE_OPTIONS.find(o => o.value === zombieBuildType.value)?.label ?? 'all types'
  const ageLabel = OLDER_THAN_OPTIONS.find(o => o.ms === zombieOlderThanMs.value)?.label ?? '?'

  $q.dialog({
    title: 'Confirm zombie cleanup',
    message: `Remove stuck PENDING/BUILDING ${typLabel} builds older than ${ageLabel} whose Kubernetes CIBuild CR no longer exists? This cannot be undone.`,
    ok:     { label: 'Run Cleanup', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    zombieRunning.value = true
    zombieResult.value  = null
    try {
      zombieResult.value = await forgeApi.zombieCleanupBuilds({
        older_than: toISO(zombieOlderThanMs.value),
        build_type: zombieBuildType.value || undefined,
      })
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Zombie cleanup failed' })
    } finally {
      zombieRunning.value = false
    }
  })
}
</script>

<template>
  <div v-if="!can('forge:builds:delete') && !can('forge:admin:manage')" class="no-perm">
    You do not have permission to manage forge builds.
  </div>
  <div v-else class="page-grid">

    <CanvasPanel
      v-if="can('forge:builds:delete')"
      title="Forge Build Cleanup"
      icon="mdi-broom"
      :wide="true"
    >
      <div class="cleanup-form">
        <div class="form-row">
          <label class="form-label">Build type</label>
          <select v-model="buildType" class="ctrl-select">
            <option v-for="o in BUILD_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>

        <div class="form-row">
          <label class="form-label">Statuses</label>
          <div class="status-checks">
            <label
              v-for="s in STATUS_OPTIONS"
              :key="s.value"
              class="check-label"
            >
              <input
                type="checkbox"
                :value="s.value"
                v-model="statuses"
                class="check-input"
              />
              {{ s.label }}
            </label>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">Older than</label>
          <select v-model="olderThanMs" class="ctrl-select">
            <option v-for="o in OLDER_THAN_OPTIONS" :key="o.ms" :value="o.ms">{{ o.label }}</option>
          </select>
        </div>

        <div class="form-row form-row--action">
          <button
            class="fs-btn fs-btn--danger"
            :disabled="deleting || statuses.length === 0"
            @click="doDelete"
          >
            <q-icon name="mdi-delete-sweep-outline" size="14px" />
            {{ deleting ? 'Deleting…' : 'Delete Builds' }}
          </button>
          <span class="form-hint">
            Deletes matching terminal builds and their associated CIBuild CRs.
            In-progress builds (PENDING / BUILDING) are never touched.
            At most 1 000 builds per call.
          </span>
        </div>
      </div>

      <div v-if="result" class="result-bar" :class="result.failed.length ? 'result-bar--warn' : 'result-bar--done'">
        <span>Deleted {{ result.deleted.length }} build{{ result.deleted.length !== 1 ? 's' : '' }}</span>
        <span v-if="result.failed.length" class="result-failed">
          · {{ result.failed.length }} failed to delete
        </span>
        <div v-if="result.failed.length" class="failure-list">
          <div v-for="f in result.failed" :key="f.id" class="failure-row">
            <span class="fs-mono">id {{ f.id }}</span> — {{ f.error }}
          </div>
        </div>
      </div>
    </CanvasPanel>

    <CanvasPanel
      v-if="can('forge:admin:manage')"
      title="Zombie Build Cleanup"
      icon="mdi-ghost-outline"
      :wide="true"
    >
      <div class="cleanup-form">
        <div class="form-row">
          <label class="form-label">Build type</label>
          <select v-model="zombieBuildType" class="ctrl-select">
            <option v-for="o in BUILD_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>

        <div class="form-row">
          <label class="form-label">Older than</label>
          <select v-model="zombieOlderThanMs" class="ctrl-select">
            <option v-for="o in OLDER_THAN_OPTIONS" :key="o.ms" :value="o.ms">{{ o.label }}</option>
          </select>
        </div>

        <div class="form-row form-row--action">
          <button
            class="fs-btn fs-btn--danger"
            :disabled="zombieRunning"
            @click="doZombieCleanup"
          >
            <q-icon name="mdi-ghost-off-outline" size="14px" />
            {{ zombieRunning ? 'Running…' : 'Run Zombie Cleanup' }}
          </button>
          <span class="form-hint">
            Removes PENDING/BUILDING builds whose Kubernetes CIBuild CR no longer exists.
            Cleans up orphaned index versions (best-effort).
            At most 1 000 builds inspected per call.
          </span>
        </div>
      </div>

      <div v-if="zombieResult" class="result-bar" :class="zombieResult.failed.length ? 'result-bar--warn' : 'result-bar--done'">
        <span>Removed {{ zombieResult.deleted.length }} zombie build{{ zombieResult.deleted.length !== 1 ? 's' : '' }}</span>
        <span v-if="zombieResult.failed.length" class="result-failed">
          · {{ zombieResult.failed.length }} failed to remove
        </span>
        <div v-if="zombieResult.failed.length" class="failure-list">
          <div v-for="f in zombieResult.failed" :key="f.id" class="failure-row">
            <span class="fs-mono">id {{ f.id }}</span> — {{ f.error }}
          </div>
        </div>
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
  grid-template-columns: 1fr;
  gap: 14px;
  padding: 16px;
  max-width: 680px;
}

.cleanup-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 8px;
}

.form-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.form-label {
  width: 90px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--fs-text-secondary);
  padding-top: 6px;
}

.ctrl-select {
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--fs-text-primary);
  cursor: pointer;
  outline: none;
  min-width: 180px;
}
.ctrl-select:focus { border-color: var(--fs-accent); }

.status-checks {
  display: flex;
  gap: 18px;
  padding-top: 5px;
}
.check-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--fs-text-primary);
  cursor: pointer;
  user-select: none;
}
.check-input { cursor: pointer; }

.form-row--action {
  align-items: center;
  padding-top: 4px;
}

.form-hint {
  font-size: 11px;
  color: var(--fs-text-muted);
  max-width: 380px;
  line-height: 1.5;
}

.fs-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity var(--fs-ease);
  flex-shrink: 0;
}
.fs-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fs-btn--danger {
  background: color-mix(in srgb, var(--fs-neg, #e57373) 15%, transparent);
  border-color: var(--fs-neg, #e57373);
  color: var(--fs-neg, #e57373);
}
.fs-btn--danger:not(:disabled):hover { background: color-mix(in srgb, var(--fs-neg, #e57373) 25%, transparent); }

.result-bar {
  margin-top: 16px;
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 12.5px;
  line-height: 1.6;
}
.result-bar--done {
  background: color-mix(in srgb, var(--fs-pos, #4caf50) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fs-pos, #4caf50) 30%, transparent);
  color: var(--fs-pos, #4caf50);
}
.result-bar--warn {
  background: color-mix(in srgb, var(--fs-warn, #ffb74d) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fs-warn, #ffb74d) 30%, transparent);
  color: var(--fs-warn, #ffb74d);
}

.result-failed { opacity: 0.9; }

.failure-list {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.failure-row {
  font-size: 11.5px;
  opacity: 0.85;
}
.fs-mono { font-family: var(--fs-font-mono); }
</style>
