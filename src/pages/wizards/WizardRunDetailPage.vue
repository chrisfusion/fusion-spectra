<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as wizardApi from '@/api/wizardApi'
import { usePermission } from '@/composables/usePermission'

// The one place that polls and renders a WizardRun's progress — used both right after creation
// (WizardCreatePage.vue redirects here on success) and when revisiting a run later from
// WizardRunsPage.vue. Navigating away and back never loses track of a run: its state lives at
// this URL, not in component memory.

const route  = useRoute()
const router = useRouter()
const $q     = useQuasar()
const { can } = usePermission()
const runName = route.params.name as string

type ProgressStatus = 'pending' | 'running' | 'done' | 'error' | 'rolledback'

const run       = ref<wizardApi.WizardRun | null>(null)
const loadError = ref<string | null>(null)
const loading   = ref(true)
const acting    = ref(false)

const TERMINAL_PHASES: wizardApi.RunPhase[] = ['Ready', 'Failed', 'RolledBack', 'RollbackFailed']

let pollTimer: ReturnType<typeof setInterval> | null = null
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}
function startPolling() {
  stopPolling()
  pollTimer = setInterval(loadRun, 2000)
}
onUnmounted(stopPolling)

async function loadRun() {
  try {
    const r = await wizardApi.getRun(runName)
    run.value = r
    loadError.value = null
    if (r.status.phase && TERMINAL_PHASES.includes(r.status.phase)) {
      stopPolling()
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load this run'
    stopPolling()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadRun()
  if (run.value?.status.phase && !TERMINAL_PHASES.includes(run.value.status.phase)) {
    startPolling()
  }
})

// ─── Actions ────────────────────────────────────────────────────────────────

async function retry() {
  acting.value = true
  try {
    await wizardApi.retryRun(runName)
    await loadRun()
    startPolling()
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Retry failed' })
  } finally {
    acting.value = false
  }
}

function confirmRollback() {
  $q.dialog({
    title:   'Roll Back Run',
    message: `Roll back <strong>${runName}</strong>? Everything it provisioned will be deleted.`,
    html:    true,
    ok:     { label: 'Roll Back', color: 'warning', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    acting.value = true
    try {
      await wizardApi.rollbackRun(runName)
      await loadRun()
      startPolling()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Rollback failed' })
    } finally {
      acting.value = false
    }
  })
}

function confirmDelete() {
  $q.dialog({
    title:   'Delete Run',
    message: `Delete <strong>${runName}</strong>? If it still owns provisioned resources, they are rolled back first. This cannot be undone.`,
    html:    true,
    ok:     { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    acting.value = true
    try {
      await wizardApi.deleteRun(runName)
      router.push('/wizards/runs')
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
      acting.value = false
    }
  })
}

// ─── Progress list ──────────────────────────────────────────────────────────

const STEP_TYPE_LABEL: Record<string, string> = {
  gitWatcher:  'GitOps watcher',
  waitBuild:   'Building artifact',
  tag:         'Assigning tag',
  jobTemplate: 'Job blueprint',
  chain:       'Run blueprint (chain)',
  trigger:     'Trigger',
  batchTrigger: 'BatchCron trigger',
}
function stepLabel(name: string, type?: string, item?: string): string {
  const base = (type && STEP_TYPE_LABEL[type]) || name
  return item ? `${base} — ${item}` : base
}

// RolledBack is a successful, intentional outcome — visually distinct from an actual failure
// (Failed / RollbackFailed), even though all three are "not Succeeded".
const STEP_PHASE_TO_PROGRESS: Record<string, ProgressStatus> = {
  Pending: 'pending', Running: 'running', Succeeded: 'done',
  Failed: 'error', RollbackFailed: 'error', RolledBack: 'rolledback',
}

interface ProgressItem { key: string, label: string, status: ProgressStatus, detail?: string }

const progress = computed<ProgressItem[]>(() =>
  (run.value?.status.steps ?? []).map(s => ({
    key:    s.key,
    label:  stepLabel(s.name, s.type, s.item),
    status: (s.phase ? STEP_PHASE_TO_PROGRESS[s.phase] : 'pending') ?? 'pending',
    detail: s.message,
  })))

const STATUS_ICON: Record<ProgressStatus, string> = {
  pending:    'mdi-circle-outline',
  running:    'mdi-loading',
  done:       'mdi-check-circle-outline',
  error:      'mdi-alert-circle-outline',
  rolledback: 'mdi-undo-variant',
}

const PHASE_LABEL: Record<string, string> = {
  Pending: 'Pending', Running: 'Running', Ready: 'Ready', Failed: 'Failed',
  RollingBack: 'Rolling Back', RolledBack: 'Rolled Back', RollbackFailed: 'Rollback Failed',
}

const chainName = computed(() => run.value?.status.steps?.find(s => s.type === 'chain')?.outputs?.name)
const TRIGGER_STEP_TYPES = new Set(['trigger', 'batchTrigger'])
const triggerNames = computed(() =>
  (run.value?.status.steps ?? [])
    .filter(s => s.type && TRIGGER_STEP_TYPES.has(s.type) && s.outputs?.name)
    .map(s => s.outputs!.name))
</script>

<template>
  <div class="page-grid">

    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/wizards/runs')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Wizard Runs
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current fs-mono">{{ runName }}</span>
    </div>

    <CanvasPanel title="Wizard Run" icon="mdi-creation" :wide="true" :loading="loading" :error="loadError" @refresh="loadRun">

      <template v-if="run">

        <div class="run-meta">
          <div class="run-meta__row">
            <span class="run-meta__label">Name</span>
            <span class="fs-mono">{{ run.name }}</span>
          </div>
          <div class="run-meta__row">
            <span class="run-meta__label">Definition</span>
            <span class="fs-mono">{{ run.definition }}</span>
          </div>
          <div class="run-meta__row">
            <span class="run-meta__label">Phase</span>
            <span class="phase-badge" :class="`phase-badge--${run.status.phase?.toLowerCase()}`">
              {{ run.status.phase ? PHASE_LABEL[run.status.phase] ?? run.status.phase : 'Unknown' }}
            </span>
          </div>
          <div v-if="run.createdBy" class="run-meta__row">
            <span class="run-meta__label">Created By</span>
            <span>{{ run.createdByEmail || run.createdBy }}</span>
          </div>
          <div class="run-meta__row">
            <span class="run-meta__label">Created At</span>
            <span>{{ new Date(run.createdAt).toLocaleString() }}</span>
          </div>
        </div>

        <div v-if="run.status.message" class="inline-msg" :class="run.status.phase === 'Failed' || run.status.phase === 'RollbackFailed' ? 'inline-msg--error' : 'inline-msg--info'">
          <q-icon name="mdi-information-outline" size="13px" />
          {{ run.status.message }}
        </div>

        <div class="progress-list">
          <div v-for="item in progress" :key="item.key" class="progress-item">
            <q-spinner v-if="item.status === 'running'" size="16px" class="progress-item__spinner" />
            <q-icon
              v-else
              :name="STATUS_ICON[item.status]"
              size="16px"
              :class="`progress-item__icon progress-item__icon--${item.status}`"
            />
            <span class="progress-item__label" :class="`progress-item__label--${item.status}`">{{ item.label }}</span>
            <span v-if="item.detail" class="progress-item__detail">{{ item.detail }}</span>
          </div>
          <div v-if="progress.length === 0" class="progress-empty">Waiting for the run to start…</div>
        </div>

        <div class="run-actions">
          <button v-if="chainName" class="fs-btn fs-btn--ghost" @click="router.push(`/pipelines/weave/chains/${encodeURIComponent(chainName)}`)">
            <q-icon name="mdi-link-chain" size="14px" /> View Chain
          </button>
          <button v-for="t in triggerNames" :key="t" class="fs-btn fs-btn--ghost" @click="router.push('/pipelines/weave/triggers')">
            <q-icon name="mdi-lightning-bolt-outline" size="14px" /> View Trigger — {{ t }}
          </button>
          <div class="run-actions__spacer" />
          <button v-if="run.status.phase === 'Failed' && can('wizard:runs:retry')" class="fs-btn fs-btn--primary" :disabled="acting" @click="retry">
            <q-icon name="mdi-refresh" size="14px" /> Retry
          </button>
          <button v-if="run.status.phase !== 'RolledBack' && run.status.phase !== 'RollingBack' && can('wizard:runs:rollback')" class="fs-btn fs-btn--ghost" :disabled="acting" @click="confirmRollback">
            <q-icon name="mdi-undo-variant" size="14px" /> Roll Back
          </button>
          <button v-if="can('wizard:runs:delete')" class="fs-btn fs-btn--ghost fs-btn--danger" :disabled="acting" @click="confirmDelete">
            <q-icon name="mdi-delete-outline" size="14px" /> Delete
          </button>
        </div>

      </template>

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

.breadcrumb {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 4px;
}
.breadcrumb__back {
  display: flex; align-items: center; gap: 5px;
  background: none; border: none; padding: 4px 8px; border-radius: 4px;
  cursor: pointer; color: var(--fs-text-muted); font-size: 12px; font-family: inherit;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.breadcrumb__back:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.breadcrumb__current { font-size: 12px; color: var(--fs-accent); font-weight: 500; }
.muted-icon { color: var(--fs-text-muted); }
.fs-mono { font-family: var(--fs-font-mono); }

.run-meta { display: flex; flex-direction: column; gap: 6px; padding: 12px 10px; }
.run-meta__row { display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 12px; font-size: 12.5px; }
.run-meta__label {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted);
}

.phase-badge {
  display: inline-flex; align-items: center; gap: 4px; width: fit-content;
  padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
}
.phase-badge--pending        { color: var(--fs-text-muted); background: color-mix(in srgb, var(--fs-text-muted) 10%, transparent); }
.phase-badge--running        { color: var(--fs-accent);     background: color-mix(in srgb, var(--fs-accent) 10%, transparent); }
.phase-badge--ready          { color: var(--fs-pos, #4caf50); background: color-mix(in srgb, var(--fs-pos, #4caf50) 10%, transparent); }
.phase-badge--failed         { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }
.phase-badge--rollingback    { color: var(--fs-warn, #ffa726); background: color-mix(in srgb, var(--fs-warn, #ffa726) 10%, transparent); }
.phase-badge--rolledback     { color: var(--fs-text-muted); background: color-mix(in srgb, var(--fs-text-muted) 10%, transparent); }
.phase-badge--rollbackfailed { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

/* Progress checklist */
.progress-list { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; }
.progress-item { display: flex; align-items: center; gap: 10px; padding: 8px 4px; }
.progress-item__spinner { color: var(--fs-accent); }
.progress-item__icon--pending { color: var(--fs-text-muted); opacity: 0.5; }
.progress-item__icon--done    { color: var(--fs-pos, #4caf50); }
.progress-item__icon--error   { color: var(--fs-neg, #e57373); }
.progress-item__icon--rolledback { color: var(--fs-text-muted); }
.progress-item__label { font-size: 12.5px; color: var(--fs-text-muted); }
.progress-item__label--done  { color: var(--fs-text-primary); }
.progress-item__label--error { color: var(--fs-neg, #e57373); }
.progress-item__label--rolledback { color: var(--fs-text-muted); }
.progress-item__detail { font-size: 11px; color: var(--fs-text-muted); margin-left: auto; }
.progress-empty { font-size: 12px; color: var(--fs-text-muted); padding: 8px 4px; }

/* Info / inline messages */
.inline-msg { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 8px 10px; margin: 0 10px; border-radius: 4px; }
.inline-msg--error { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }
.inline-msg--info  { color: var(--fs-text-muted); background: var(--fs-bg-hover); }

.run-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 10px; }
.run-actions__spacer { flex: 1; }

.fs-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px;
  border-radius: 4px; font-size: 12.5px; font-family: inherit; font-weight: 500;
  cursor: pointer; border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease), filter var(--fs-ease);
}
.fs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fs-btn--primary { background: var(--fs-accent); color: #fff; border-color: var(--fs-accent); }
.fs-btn--primary:hover:not(:disabled) { filter: brightness(1.1); }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.fs-btn--ghost:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.fs-btn--danger:hover:not(:disabled) { color: var(--fs-neg, #e57373); border-color: var(--fs-neg, #e57373); }
</style>
