<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import ManagedByBadge from '@/components/ManagedByBadge.vue'
import WeaveAppLogs from '@/components/WeaveAppLogs.vue'
import * as monitorApi from '@/api/weaveMonitorApi'
import * as wizardApi from '@/api/wizardApi'
import { usePermission } from '@/composables/usePermission'
import { useRunsPolling } from '@/composables/useRunsPolling'
import { useImageOverrideOptions } from '@/composables/useImageOverrideOptions'
import { validateAppImage } from '@/utils/imagePolicy'
import { managedBy } from '@/utils/managedBy'
import { appSource } from '@/utils/weaveApp'
import { getServiceUrlPattern } from '@/config/runtime'
import { escapeHtml } from '@/utils/format'

// One WeaveApp: what it runs, its executions/logs, and the two expert actions — Change image
// (image apps only; PUT straight to weave) and Run now (job entrypoints, fire annotation).
// A wizard-created app is changed behind the wizard's back: its ledger still records the old
// image and a retry of that wizard run may restore it (accepted drift).

const route  = useRoute()
const router = useRouter()
const $q     = useQuasar()
const { can } = usePermission()
const { allowedPrefixes } = useImageOverrideOptions()

const appName = route.params.name as string

const app       = ref<monitorApi.WeaveApp | null>(null)
const loading   = ref(false)
const error     = ref<string | null>(null)
const wizardRun = ref<string | null>(null)
const imageBusy = ref(false)
const firing    = ref<Set<string>>(new Set())

async function loadApp() {
  if (!app.value) loading.value = true
  error.value = null
  try {
    app.value = await monitorApi.getApp(appName)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load app'
  } finally {
    loading.value = false
  }
}

// The app carries no back-reference to its wizard run — find the run whose app step created it.
async function findWizardRun() {
  if (managedBy(app.value?.metadata) !== 'wizard') return
  try {
    const { items } = await wizardApi.listRuns()
    wizardRun.value = items.find(r => (r.status.steps ?? [])
      .some(s => s.type === 'app' && s.outputs?.name === appName))?.name ?? null
  } catch {
    // best-effort link only
  }
}

const { polling, startPolling, togglePolling } = useRunsPolling(loadApp)

onMounted(async () => {
  await loadApp()
  findWizardRun()
  startPolling()
})

// ─── Derived ──────────────────────────────────────────────────────────────────

const phase      = computed(() => app.value?.status?.phase ?? 'Pending')
const isService  = computed(() => app.value?.spec.type === 'service')
const port       = computed(() => app.value?.spec.service?.ports?.[0]?.port)
const ingress    = computed(() => app.value?.spec.service?.ingressName ?? '')
// Weave appends its cluster host suffix itself; the URL pattern is config (same as wizard runs).
const serviceUrl = computed(() => {
  const pattern = getServiceUrlPattern()
  return ingress.value && pattern ? pattern.replace('{name}', ingress.value) : null
})
const canChangeImage = computed(() => !!app.value && !app.value.spec.codeSource && can('weave:apps:write'))

function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '—'
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function changeImage() {
  if (!app.value) return
  const driftNote = wizardRun.value || managedBy(app.value.metadata) === 'wizard'
    ? '<br><br>This app was created by a wizard run. Retrying that run may set the old image again.'
    : ''
  $q.dialog({
    title:   'Change Image',
    message: `New image for <strong>${escapeHtml(appName)}</strong> — ${isService.value ? 'the Deployment is rolled to it.' : 'future executions use it.'}${driftNote}`,
    html:    true,
    prompt:  {
      model:   app.value.spec.image,
      type:    'text',
      isValid: (v: string) => validateAppImage(v, allowedPrefixes.value) === null,
    },
    ok:     { label: 'Apply', color: 'warning', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async (image: string) => {
    imageBusy.value = true
    try {
      app.value = await monitorApi.setAppImage(appName, image.trim())
      $q.notify({ type: 'positive', message: `${appName} now uses ${image.trim()}` })
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Image update failed' })
    } finally {
      imageBusy.value = false
    }
  })
}

async function runNow(entrypoint: string) {
  firing.value = new Set([...firing.value, entrypoint])
  try {
    await monitorApi.fireAppEntrypoint(appName, entrypoint)
    $q.notify({ type: 'positive', message: `${entrypoint} started — the execution shows up below shortly` })
    setTimeout(loadApp, 2000)
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Run failed' })
  } finally {
    firing.value = new Set([...firing.value].filter(n => n !== entrypoint))
  }
}

function isRunning(entrypoint: string): boolean {
  return (app.value?.status?.executions ?? []).some(e => e.entrypoint === entrypoint && e.phase === 'Running')
}
</script>

<template>
  <div class="page-grid">
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/pipelines/weave/apps')">
        <q-icon name="mdi-arrow-left" size="14px" /> Apps
      </button>
    </div>

    <!-- Left: what the app runs -->
    <CanvasPanel
      title="App"
      icon="mdi-application-outline"
      :loading="loading && !app"
      :error="error ?? undefined"
      @refresh="loadApp"
    >
      <template #actions>
        <button
          class="icon-btn"
          :class="{ 'icon-btn--active': polling }"
          :title="polling ? 'Pause auto-refresh' : 'Resume auto-refresh'"
          @click="togglePolling"
        >
          <q-icon :name="polling ? 'mdi-pause-circle-outline' : 'mdi-play-circle-outline'" size="16px" />
          <q-tooltip>{{ polling ? 'Pause' : 'Resume' }} auto-refresh (10s)</q-tooltip>
        </button>
      </template>

      <div v-if="app" class="meta-body">
        <h2 class="app-name fs-mono">{{ appName }}</h2>

        <div class="phase-row">
          <span class="phase-badge" :class="`phase-badge--${phase.toLowerCase()}`">{{ phase }}</span>
          <ManagedByBadge :meta="app.metadata" />
        </div>
        <p v-if="app.status?.validationMessage" class="app-message">{{ app.status.validationMessage }}</p>

        <dl class="meta-list">
          <dt>Type</dt>
          <dd>{{ isService ? 'Service' : 'Job' }}</dd>

          <template v-if="app.spec.codeSource">
            <dt>Code</dt>
            <dd class="fs-mono">{{ appSource(app) }}</dd>
            <dt>Runner image</dt>
            <dd class="fs-mono col-muted">{{ app.spec.image }}</dd>
          </template>
          <template v-else>
            <dt>Image</dt>
            <dd class="fs-mono">{{ app.spec.image }}</dd>
          </template>

          <template v-if="app.spec.externalAuthRef">
            <dt>Token</dt>
            <dd class="fs-mono">{{ app.spec.externalAuthRef.mode }} · {{ app.spec.externalAuthRef.name }}</dd>
          </template>

          <template v-if="wizardRun">
            <dt>Wizard run</dt>
            <dd>
              <a class="link fs-mono" @click="router.push(`/wizards/runs/${encodeURIComponent(wizardRun)}`)">{{ wizardRun }}</a>
            </dd>
          </template>

          <dt>Created</dt>
          <dd>{{ formatDate(app.metadata.creationTimestamp) }}</dd>
        </dl>

        <div v-if="canChangeImage" class="action-row">
          <button class="fs-btn fs-btn--warn" :disabled="imageBusy" @click="changeImage">
            <q-spinner v-if="imageBusy" size="14px" style="margin-right:6px" />
            <q-icon v-else name="mdi-docker" size="14px" style="margin-right:4px" />
            Change image
          </button>
        </div>
        <p v-else-if="app.spec.codeSource" class="col-muted hint">
          The code version follows the tag <span class="fs-mono">{{ app.spec.codeSource.tag }}</span> in fusion-index — move the tag to deploy another version.
        </p>
      </div>
    </CanvasPanel>

    <!-- Right: service endpoint or job entrypoints -->
    <CanvasPanel
      v-if="app"
      :title="isService ? 'Service' : 'Entrypoints'"
      :icon="isService ? 'mdi-server-network' : 'mdi-play-box-multiple-outline'"
    >
      <dl v-if="isService" class="meta-list">
        <dt>Deployment</dt>
        <dd class="fs-mono">{{ app.status?.deploymentName ?? '—' }}</dd>
        <dt>Port</dt>
        <dd class="fs-mono">{{ port ?? '—' }}</dd>
        <dt>Ingress</dt>
        <dd class="fs-mono">{{ ingress || '—' }}</dd>
        <template v-if="serviceUrl">
          <dt>URL</dt>
          <dd><a class="link fs-mono" :href="serviceUrl" target="_blank" rel="noopener">{{ serviceUrl }}</a></dd>
        </template>
      </dl>

      <table v-else class="tpl-table">
        <thead>
          <tr><th>Entrypoint</th><th>Schedule</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="ep in app.spec.entrypoints ?? []" :key="ep.name">
            <td class="col-name fs-mono">{{ ep.name }}</td>
            <td class="fs-mono" :class="{ 'col-muted': !ep.schedule }">{{ ep.schedule || 'on demand' }}</td>
            <td class="col-actions">
              <button
                v-if="can('weave:apps:write')"
                class="fs-btn fs-btn--ghost fs-btn--sm"
                :disabled="firing.has(ep.name) || isRunning(ep.name)"
                :title="isRunning(ep.name) ? 'An execution of this entrypoint is still running' : ''"
                @click="runNow(ep.name)"
              >
                <q-spinner v-if="firing.has(ep.name)" size="12px" style="margin-right:4px" />
                <q-icon v-else name="mdi-play" size="13px" style="margin-right:4px" />
                Run now
              </button>
            </td>
          </tr>
          <tr v-if="!(app.spec.entrypoints ?? []).length">
            <td colspan="3" class="empty-row">No entrypoints.</td>
          </tr>
        </tbody>
      </table>
    </CanvasPanel>

    <!-- Logs / executions -->
    <CanvasPanel
      v-if="app"
      :title="isService ? 'Logs' : 'Executions'"
      icon="mdi-text-box-multiple-outline"
      :wide="true"
    >
      <WeaveAppLogs :app="app" />
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

.breadcrumb { grid-column: span 2; }
.breadcrumb__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--fs-text-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 0;
  font-family: inherit;
}
.breadcrumb__back:hover { color: var(--fs-accent); }

.meta-body { display: flex; flex-direction: column; gap: 12px; }

.app-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--fs-text-primary);
  margin: 0 0 4px 0;
  word-break: break-all;
}

.phase-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.app-message { font-size: 11.5px; color: var(--fs-neg, #e57373); margin: 0; line-height: 1.5; }

.meta-list {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 6px 12px;
  font-size: 12.5px;
  margin: 0;
}
.meta-list dt {
  color: var(--fs-text-muted);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
}
.meta-list dd {
  color: var(--fs-text-primary);
  margin: 0;
  word-break: break-all;
}

.action-row { display: flex; gap: 8px; margin-top: 8px; }
.hint { font-size: 11.5px; margin: 4px 0 0; line-height: 1.5; }

.link { color: var(--fs-accent); cursor: pointer; text-decoration: none; }
.link:hover { text-decoration: underline; }

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
.col-name    { font-weight: 500; color: var(--fs-accent); }
.col-actions { text-align: right; white-space: nowrap; }
.col-muted   { color: var(--fs-text-muted); }
.empty-row   { text-align: center; color: var(--fs-text-muted); padding: 24px 10px !important; }

.fs-mono { font-family: var(--fs-font-mono); }

/* Phase badges — Pending / Ready / Running / Invalid */
.phase-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.phase-badge--pending { color: var(--fs-accent);         background: color-mix(in srgb, var(--fs-accent) 12%, transparent); }
.phase-badge--running { color: var(--fs-warn, #ff9800); background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent); }
.phase-badge--ready   { color: var(--fs-pos, #81c784);   background: color-mix(in srgb, var(--fs-pos, #81c784) 12%, transparent); }
.phase-badge--invalid { color: var(--fs-neg, #e57373);   background: color-mix(in srgb, var(--fs-neg, #e57373) 12%, transparent); }

/* Buttons */
.fs-btn {
  display: inline-flex;
  align-items: center;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 14px;
  cursor: pointer;
  transition: opacity var(--fs-ease), background var(--fs-ease);
  font-family: inherit;
}
.fs-btn--sm { font-size: 11.5px; padding: 4px 10px; }
.fs-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fs-btn--warn { background: color-mix(in srgb, var(--fs-warn, #ff9800) 15%, transparent); color: var(--fs-warn, #ff9800); border: 1px solid color-mix(in srgb, var(--fs-warn, #ff9800) 30%, transparent); }
.fs-btn--warn:hover:not(:disabled) { background: color-mix(in srgb, var(--fs-warn, #ff9800) 25%, transparent); }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border: 1px solid var(--fs-border); }
.fs-btn--ghost:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }

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
.icon-btn:hover   { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.icon-btn--active { color: var(--fs-accent); }
</style>
