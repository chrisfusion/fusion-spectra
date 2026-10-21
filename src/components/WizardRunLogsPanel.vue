<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import CanvasPanel from '@/components/CanvasPanel.vue'
import LogViewer from '@/components/LogViewer.vue'
import LogDialog from '@/components/LogDialog.vue'
import WeaveAppLogs from '@/components/WeaveAppLogs.vue'
import * as monitorApi from '@/api/weaveMonitorApi'
import * as forgeApi from '@/api/forgeApi'
import type { WizardRun } from '@/api/wizardApi'
import type { LogSnapshot } from '@/api/weaveMonitorApi'
import { useRunsPolling } from '@/composables/useRunsPolling'
import { formatDurationMs } from '@/utils/format'

// Logs of whatever a wizard run provisioned, derived from its step outputs:
//   waitBuild step              → the fusion-forge build (buildId is published while it still waits)
//   app step                    → WeaveApp: service = live pod log, job = one log per execution
//   trigger / batchTrigger step → the Weave runs those triggers created (label fusion-platform.io/trigger)
// Works in Simple mode — it never links into Weave pages.

const props = defineProps<{ run: WizardRun }>()
const emit  = defineEmits<{ loaded: [] }>()

const TRIGGER_LABEL = 'fusion-platform.io/trigger'
const RECENT_RUNS   = 10

const outputNames = (types: string[]) => (props.run.status.steps ?? [])
  .filter(s => types.includes(s.type ?? '') && s.outputs?.name)
  .map(s => s.outputs!.name)

const buildId      = computed(() => Number((props.run.status.steps ?? []).find(s => s.type === 'waitBuild')?.outputs?.buildId) || null)
const appNames     = computed(() => outputNames(['app']))
const triggerNames = computed(() => outputNames(['trigger', 'batchTrigger']))

const build       = ref<forgeApi.AppBuild | null>(null)
const buildMissing = ref(false)
const apps        = ref<monitorApi.WeaveApp[]>([])
const missingApps = ref<string[]>([])
const weaveRuns   = ref<monitorApi.WeaveRun[]>([])
const loading     = ref(true)
const loadError   = ref<string | null>(null)

async function load() {
  loadError.value = null
  try {
    if (buildId.value) {
      // by id, never the list — only GET /appbuilds/:id syncs status from the CIBuild CR
      build.value        = await forgeApi.getAppBuild(buildId.value).catch(() => null)
      buildMissing.value = !build.value
    }
    const results = await Promise.allSettled(appNames.value.map(n => monitorApi.getApp(n)))
    apps.value        = results.flatMap(r => r.status === 'fulfilled' ? [r.value] : [])
    missingApps.value = appNames.value.filter((_, i) => results[i].status === 'rejected')

    if (triggerNames.value.length) {
      const triggers = new Set(triggerNames.value)
      weaveRuns.value = (await monitorApi.listAllRuns())
        .filter(r => triggers.has(r.metadata.labels?.[TRIGGER_LABEL] ?? ''))
        .sort((a, b) => (b.metadata.creationTimestamp ?? '').localeCompare(a.metadata.creationTimestamp ?? ''))
        .slice(0, RECENT_RUNS)
    } else {
      weaveRuns.value = []
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load logs'
  } finally {
    loading.value = false
  }
}

const { startPolling } = useRunsPolling(load)
onMounted(async () => { await load(); emit('loaded'); startPolling() })
// The wizard run fills in step outputs while it provisions — pick up new apps/triggers.
watch(() => [buildId.value, ...appNames.value, ...triggerNames.value].join(','), load)

const serviceApps = computed(() => apps.value.filter(a => a.spec.type === 'service'))
const jobApps     = computed(() => apps.value.filter(a => a.spec.type === 'job'))
const isEmpty     = computed(() => !build.value && !buildMissing.value && !apps.value.length && !weaveRuns.value.length && !missingApps.value.length)
const building    = computed(() => build.value?.status === 'PENDING' || build.value?.status === 'BUILDING')

// Forge returns plain text, only while the build pod still exists (404 otherwise, 204 = empty).
// Cached per build id — LogViewer reloads whenever its fetchLogs prop changes, and every poll
// replaces the build object.
const buildFetchers = new Map<number, () => Promise<LogSnapshot>>()
function buildFetcher(id: number) {
  if (!buildFetchers.has(id)) {
    buildFetchers.set(id, async () => {
      const text = await forgeApi.getAppBuildLogs(id)
      return { lines: text ? text.replace(/\n$/, '').split('\n') : [], podName: build.value?.ciBuildName ?? '' }
    })
  }
  return buildFetchers.get(id)!
}

// ─── Log dialog (build, Weave run steps; job executions live in WeaveAppLogs) ─

const dialogOpen  = ref(false)
const dialogTitle = ref('')
const dialogSetup = ref(false)
const dialogFetch = ref<(o: { setup: boolean }) => Promise<LogSnapshot>>(() => Promise.resolve({ lines: [], podName: '' }))

function openBuildLogs(b: forgeApi.AppBuild) {
  dialogTitle.value = `build #${b.id} · ${b.name} ${b.version}`
  dialogSetup.value = false
  dialogFetch.value = buildFetcher(b.id)
  dialogOpen.value  = true
}

function openStepLogs(runName: string, step: string) {
  dialogTitle.value = `${runName} · ${step}`
  dialogSetup.value = false
  dialogFetch.value = () => monitorApi.getStepLogs(runName, step)
  dialogOpen.value  = true
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : '—'
}

function duration(start?: string | null, end?: string | null): string {
  if (!start) return '—'
  return formatDurationMs((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime())
}
</script>

<template>
  <CanvasPanel title="Logs" icon="mdi-text-box-multiple-outline" :wide="true" :loading="loading" :error="loadError" @refresh="load">

    <!-- Build (git wizards): live while it runs, then on demand -->
    <section v-if="build" class="logs-section">
      <div class="logs-section__hdr">
        <q-icon name="mdi-hammer-wrench" size="14px" />
        <span>Build</span>
        <span class="fs-mono">#{{ build.id }} {{ build.name }} {{ build.version }}</span>
        <span class="state-badge" :class="`state-badge--${build.status.toLowerCase()}`">{{ build.status }}</span>
        <span class="logs-section__sub">{{ formatDate(build.createdAt) }}<template v-if="!building"> · {{ duration(build.createdAt, build.updatedAt) }}</template></span>
        <button v-if="!building" class="fs-btn fs-btn--ghost fs-btn--sm logs-section__btn" @click="openBuildLogs(build)">
          <q-icon name="mdi-text-box-outline" size="13px" /> Logs
        </button>
      </div>
      <div v-if="building" class="logs-inline">
        <LogViewer :title="`build #${build.id}`" :fetch-logs="buildFetcher(build.id)" />
      </div>
      <p v-if="!building" class="logs-note">Build logs are available as long as the build pod exists.</p>
    </section>
    <p v-else-if="buildMissing" class="logs-note">Build #{{ buildId }} no longer exists in fusion-forge.</p>

    <!-- Services: live log inline -->
    <section v-for="app in serviceApps" :key="app.metadata.name" class="logs-section">
      <div class="logs-section__hdr">
        <q-icon name="mdi-server-outline" size="14px" />
        <span>Service</span>
        <span class="fs-mono">{{ app.metadata.name }}</span>
        <span class="state-badge" :class="`state-badge--${app.status?.phase?.toLowerCase()}`">{{ app.status?.phase ?? 'Pending' }}</span>
      </div>
      <WeaveAppLogs :app="app" />
    </section>

    <!-- Jobs: one log per execution -->
    <section v-for="app in jobApps" :key="app.metadata.name" class="logs-section">
      <div class="logs-section__hdr">
        <q-icon name="mdi-briefcase-outline" size="14px" />
        <span>Job</span>
        <span class="fs-mono">{{ app.metadata.name }}</span>
        <span class="state-badge" :class="`state-badge--${app.status?.phase?.toLowerCase()}`">{{ app.status?.phase ?? 'Pending' }}</span>
      </div>
      <WeaveAppLogs :app="app" />
    </section>

    <!-- Trigger-based wizards (batch, batchcron, older runs): the Weave runs they created -->
    <section v-if="weaveRuns.length" class="logs-section">
      <div class="logs-section__hdr">
        <q-icon name="mdi-play-network-outline" size="14px" />
        <span>Runs</span>
        <span class="logs-section__sub">latest {{ weaveRuns.length }}</span>
      </div>
      <table class="logs-table">
        <thead>
          <tr><th>Run</th><th>Status</th><th>Started</th><th>Duration</th><th>Step logs</th></tr>
        </thead>
        <tbody>
          <tr v-for="wr in weaveRuns" :key="wr.metadata.name">
            <td class="fs-mono">{{ wr.metadata.name }}</td>
            <td><span class="state-badge" :class="`state-badge--${wr.status?.phase?.toLowerCase()}`">{{ wr.status?.phase ?? 'Pending' }}</span></td>
            <td>{{ formatDate(wr.status?.startTime ?? wr.metadata.creationTimestamp) }}</td>
            <td class="fs-mono">{{ duration(wr.status?.startTime, wr.status?.completionTime) }}</td>
            <td class="logs-table__actions">
              <button
                v-for="st in wr.status?.steps ?? []" :key="st.name"
                class="fs-btn fs-btn--ghost fs-btn--sm"
                @click="openStepLogs(wr.metadata.name, st.name)"
              >
                <q-icon name="mdi-text-box-outline" size="13px" /> {{ st.name }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <p v-for="name in missingApps" :key="name" class="logs-note">
      <span class="fs-mono">{{ name }}</span> no longer exists — its workload and logs are gone (rolled back or deleted).
    </p>

    <div v-if="!loading && isEmpty" class="logs-empty">
      <template v-if="run.status.phase === 'RolledBack'">This run was rolled back — its workloads and logs are gone.</template>
      <template v-else-if="triggerNames.length">No runs yet — logs appear here once the trigger has fired.</template>
      <template v-else>No logs yet — they appear once the wizard has created the app.</template>
    </div>

    <LogDialog v-model="dialogOpen" :title="dialogTitle" :fetch-logs="dialogFetch" :setup-toggle="dialogSetup" />
  </CanvasPanel>
</template>

<style scoped>
.logs-section { padding: 10px 10px 4px; }
.logs-section + .logs-section { border-top: 1px solid var(--fs-border); }

.logs-section__hdr {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 2px 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fs-text-primary);
}
.logs-section__sub { font-weight: 400; font-size: 11.5px; color: var(--fs-text-muted); }
.logs-section__btn { margin-left: auto; }

.logs-inline {
  border: 1px solid var(--fs-border);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 8px;
}

.logs-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.logs-table thead th {
  text-align: left; padding: 6px 8px; font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.logs-table td { padding: 6px 8px; border-bottom: 1px solid var(--fs-border); color: var(--fs-text-primary); }
.logs-table__actions { display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; }

.logs-note { margin: 6px 2px 8px; font-size: 11.5px; color: var(--fs-text-muted); }
.logs-empty { padding: 24px 10px; text-align: center; font-size: 12.5px; color: var(--fs-text-muted); }

.state-badge {
  display: inline-flex; width: fit-content; padding: 2px 8px; border-radius: 10px;
  font-size: 11px; font-weight: 600;
  color: var(--fs-text-muted); background: color-mix(in srgb, var(--fs-text-muted) 10%, transparent);
}
.state-badge--building,
.state-badge--running   { color: var(--fs-accent); background: color-mix(in srgb, var(--fs-accent) 10%, transparent); }
.state-badge--ready,
.state-badge--succeeded { color: var(--fs-pos, #4caf50); background: color-mix(in srgb, var(--fs-pos, #4caf50) 10%, transparent); }
.state-badge--failed,
.state-badge--invalid   { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }
.state-badge--stopped   { color: var(--fs-warn, #ffa726); background: color-mix(in srgb, var(--fs-warn, #ffa726) 10%, transparent); }

.fs-mono { font-family: var(--fs-font-mono); }
.fs-btn {
  display: inline-flex; align-items: center; gap: 5px; border-radius: 4px;
  font-family: inherit; font-weight: 500; cursor: pointer; border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease);
}
.fs-btn--sm { padding: 4px 9px; font-size: 11.5px; }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.fs-btn--ghost:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
</style>
