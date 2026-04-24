<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as forgeApi from '@/api/forgeApi'

const route  = useRoute()
const router = useRouter()

const POLL_INTERVAL_MS = 5_000

// ─── Route param guard ────────────────────────────────────────────────────────

const buildId = Number(route.params.id)
if (Number.isNaN(buildId)) {
  router.replace('/forge/venvs')
}

// ─── State ────────────────────────────────────────────────────────────────────

const build        = ref<forgeApi.VenvBuild | null>(null)
const buildLoading = ref(false)
const buildError   = ref<string | null>(null)

const logs        = ref('')
const logsLoading = ref(false)
const logsError   = ref<string | null>(null)
const logsEl      = ref<HTMLElement | null>(null)

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadBuild() {
  buildLoading.value = true
  buildError.value   = null
  try {
    build.value = await forgeApi.getVenv(buildId)
  } catch (e) {
    buildError.value = e instanceof Error ? e.message : 'Failed to load build'
  } finally {
    buildLoading.value = false
  }
}

async function loadLogs() {
  logsLoading.value = true
  logsError.value   = null
  try {
    logs.value = await forgeApi.getVenvLogs(buildId)
    scrollLogs()
  } catch (e) {
    logsError.value = e instanceof Error ? e.message : 'Failed to load logs'
  } finally {
    logsLoading.value = false
  }
}

function scrollLogs() {
  nextTick(() => {
    if (logsEl.value) logsEl.value.scrollTop = logsEl.value.scrollHeight
  })
}

// ─── Polling ──────────────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null

function isTerminal(status: forgeApi.VenvBuild['status']) {
  return status === 'SUCCEEDED' || status === 'FAILED'
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    await Promise.all([loadBuild(), loadLogs()])
    if (build.value && isTerminal(build.value.status)) stopPolling()
  }, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

onUnmounted(stopPolling)

onMounted(async () => {
  await Promise.all([loadBuild(), loadLogs()])
  if (build.value && !isTerminal(build.value.status)) startPolling()
})

// ─── Manual refresh ───────────────────────────────────────────────────────────

async function refreshBuild() {
  await loadBuild()
  if (build.value && isTerminal(build.value.status)) stopPolling()
}

async function refreshLogs() {
  await loadLogs()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

const STATUS_ICON: Record<forgeApi.VenvBuild['status'], string> = {
  PENDING:   'mdi-clock-outline',
  BUILDING:  'mdi-cog-sync-outline',
  SUCCEEDED: 'mdi-check-circle-outline',
  FAILED:    'mdi-alert-circle-outline',
}
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/forge/venvs')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Venv Builds
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">
        <template v-if="build">
          <span class="fs-mono">{{ build.name }}:{{ build.version }}</span>
          &nbsp;#{{ build.id }}
        </template>
        <template v-else>Build #{{ buildId }}</template>
      </span>
    </div>

    <!-- Left: metadata -->
    <CanvasPanel
      title="Build Info"
      icon="mdi-information-outline"
      :loading="buildLoading"
      :error="buildError ?? undefined"
      @refresh="refreshBuild"
    >
      <div v-if="build" class="meta-grid">

        <div class="meta-row">
          <span class="meta-label">Status</span>
          <span class="status-badge" :class="`status--${build.status.toLowerCase()}`">
            <q-icon :name="STATUS_ICON[build.status]" size="13px" />
            {{ build.status }}
            <q-spinner v-if="build.status === 'BUILDING'" size="11px" class="spinning-icon" />
          </span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Name</span>
          <span class="meta-value fs-mono">{{ build.name }}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Version</span>
          <span class="meta-value fs-mono">{{ build.version }}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Build ID</span>
          <span class="meta-value fs-mono">#{{ build.id }}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Build Type</span>
          <span class="meta-value">{{ build.buildType }}</span>
        </div>

        <div v-if="build.description" class="meta-row meta-row--top">
          <span class="meta-label">Description</span>
          <span class="meta-value meta-value--wrap">{{ build.description }}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Creator</span>
          <span class="meta-value">{{ build.creatorEmail ?? '—' }}</span>
        </div>

        <div v-if="build.indexArtifactId" class="meta-row">
          <span class="meta-label">Index Artifact</span>
          <button
            class="artifact-link"
            @click="router.push(`/fusion-index/artifacts/${build.indexArtifactId}`)"
          >
            <q-icon name="mdi-package-variant-closed" size="13px" />
            #{{ build.indexArtifactId }}
            <template v-if="build.indexArtifactVersion">
              &nbsp;{{ build.indexArtifactVersion }}
            </template>
          </button>
        </div>

        <div class="meta-row">
          <span class="meta-label">Created</span>
          <span class="meta-value">{{ formatDate(build.createdAt) }}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Updated</span>
          <span class="meta-value">{{ formatDate(build.updatedAt) }}</span>
        </div>

      </div>
    </CanvasPanel>

    <!-- Right: logs -->
    <CanvasPanel
      title="Build Logs"
      icon="mdi-console"
      :loading="logsLoading && !logs"
      :error="logsError ?? undefined"
      @refresh="refreshLogs"
    >
      <div
        v-if="!logs && build?.status === 'PENDING'"
        class="logs-placeholder"
      >
        <q-icon name="mdi-clock-outline" size="24px" class="logs-placeholder__icon" />
        <p>No logs yet — build is queued.</p>
      </div>

      <div
        v-else-if="!logs && !logsLoading"
        class="logs-placeholder"
      >
        <q-icon name="mdi-text-box-outline" size="24px" class="logs-placeholder__icon" />
        <p>No logs available.</p>
      </div>

      <pre
        v-else
        ref="logsEl"
        class="logs-block"
      >{{ logs }}</pre>
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

/* Breadcrumb */
.breadcrumb {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 4px;
}
.breadcrumb__back {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--fs-text-muted);
  font-size: 12px;
  font-family: inherit;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.breadcrumb__back:hover {
  color: var(--fs-text-primary);
  background: var(--fs-bg-hover);
}
.breadcrumb__current {
  font-size: 12px;
  color: var(--fs-accent);
  font-weight: 500;
}
.muted-icon { color: var(--fs-text-muted); }

/* Metadata grid */
.meta-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.meta-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--fs-border);
}
.meta-row:last-child { border-bottom: none; }
.meta-row--top { align-items: start; padding-top: 10px; }

.meta-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  flex-shrink: 0;
}
.meta-value {
  font-size: 12.5px;
  color: var(--fs-text-primary);
}
.meta-value--wrap { white-space: pre-wrap; word-break: break-word; }

/* Status badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 10px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.03em;
}
.status--pending   { color: var(--fs-accent);       background: color-mix(in srgb, var(--fs-accent)        10%, transparent); }
.status--building  { color: var(--fs-warn, #ff9800); background: color-mix(in srgb, var(--fs-warn, #ff9800) 10%, transparent); }
.status--succeeded { color: var(--fs-pos, #4caf50);  background: color-mix(in srgb, var(--fs-pos, #4caf50)  10%, transparent); }
.status--failed    { color: var(--fs-neg, #e57373);  background: color-mix(in srgb, var(--fs-neg, #e57373)  10%, transparent); }
.spinning-icon { margin-left: 2px; opacity: 0.8; }

/* Artifact link */
.artifact-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-family: var(--fs-font-mono);
  color: var(--fs-accent);
  transition: background var(--fs-ease);
}
.artifact-link:hover { background: var(--fs-bg-hover); }

/* Logs */
.logs-block {
  margin: 0;
  padding: 10px 12px;
  font-family: var(--fs-font-mono);
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--fs-text-primary);
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border-radius: 4px;
  overflow-y: auto;
  max-height: 520px;
  white-space: pre-wrap;
  word-break: break-all;
}

.logs-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 24px;
  text-align: center;
  color: var(--fs-text-muted);
  font-size: 12.5px;
}
.logs-placeholder p  { margin: 0; }
.logs-placeholder__icon { opacity: 0.5; }

.fs-mono { font-family: var(--fs-font-mono); }
</style>
