<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { LogSnapshot } from '@/api/weaveMonitorApi'

// Shared log tail: Weave run steps, WeaveApp services and WeaveApp job executions all
// feed it a fetch function. Polls while mounted — a parent q-dialog unmounts it on close,
// which stops the timer without any extra wiring.

const props = withDefaults(defineProps<{
  title:        string
  fetchLogs:    (opts: { setup: boolean }) => Promise<LogSnapshot>
  setupToggle?: boolean   // offer the code-loader ("setup") container log
  maxHeight?:   string
}>(), { setupToggle: false, maxHeight: '420px' })

const lines       = ref<string[]>([])
const podName     = ref('')
const loading     = ref(true)
const error       = ref<string | null>(null)
const autoRefresh = ref(true)
const interval    = ref(10)       // seconds, user-configurable
const refreshing  = ref(false)    // background poll in flight
const flash       = ref(false)
const setup       = ref(false)
const preEl       = ref<HTMLPreElement | null>(null)
// Follow the newest line until the user scrolls up; re-applied on reflow (width changes
// re-wrap the lines without any scroll event).
const follow      = ref(true)
let   timer: ReturnType<typeof setInterval> | null = null
let   resizeObs: ResizeObserver | null = null

function isAtBottom(): boolean {
  const el = preEl.value
  if (!el) return true
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 4
}

function scrollToBottom() {
  const el = preEl.value
  if (el) el.scrollTop = el.scrollHeight
}

function onScroll() {
  follow.value = isAtBottom()
}

watch(preEl, el => {
  resizeObs?.disconnect()
  resizeObs = null
  if (el) {
    resizeObs = new ResizeObserver(() => { if (follow.value) scrollToBottom() })
    resizeObs.observe(el)
  }
})

function stopPolling() {
  if (timer) { clearInterval(timer); timer = null }
}

function startPolling() {
  stopPolling()
  if (autoRefresh.value) timer = setInterval(refresh, interval.value * 1_000)
}

// Full (re)load with spinner and visible errors — on mount and when the source changes.
async function load() {
  loading.value = true
  error.value   = null
  lines.value   = []
  podName.value = ''
  follow.value  = true
  try {
    const resp = await props.fetchLogs({ setup: setup.value })
    lines.value   = resp.lines
    podName.value = resp.podName
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load logs'
  } finally {
    loading.value = false
  }
  // only after loading=false is the <pre> rendered — scrolling earlier hits nothing
  await nextTick().then(scrollToBottom)
  startPolling()
}

// Background poll — silent on failure so displayed content isn't overwritten.
async function refresh() {
  if (refreshing.value || loading.value) return
  refreshing.value = true
  try {
    const resp = await props.fetchLogs({ setup: setup.value })
    lines.value   = resp.lines
    podName.value = resp.podName
    error.value   = null
    flash.value   = true
    setTimeout(() => { flash.value = false }, 400)
    if (follow.value) await nextTick().then(scrollToBottom)
  } catch {
    // keep last good snapshot
  } finally {
    refreshing.value = false
  }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  startPolling()
}

watch(interval, startPolling)
watch(setup, load)
watch(() => props.fetchLogs, load)

onMounted(load)
onUnmounted(() => { stopPolling(); resizeObs?.disconnect() })
</script>

<template>
  <div class="log-viewer">
    <div class="log-viewer__header">
      <div class="log-viewer__title">
        <q-icon name="mdi-text-box-outline" size="15px" />
        <span class="log-viewer__name fs-mono" :title="title">{{ title }}</span>
        <span v-if="podName" class="log-viewer__pod fs-mono">— {{ podName }}</span>
        <q-spinner v-if="refreshing" size="11px" color="grey" class="log-viewer__poll-spinner" />
      </div>
      <div class="log-viewer__controls">
        <label v-if="setupToggle" class="log-viewer__setup">
          <input v-model="setup" type="checkbox" />
          Setup log
          <q-tooltip>Log of the code-loader init container — look here when the app fails to start</q-tooltip>
        </label>
        <label class="log-viewer__interval-label">
          <input v-model.number="interval" type="number" min="5" max="300" class="log-viewer__interval-input" />
          <span class="log-viewer__interval-unit">s</span>
        </label>
        <button class="icon-btn" :class="{ 'icon-btn--active': autoRefresh }" @click="toggleAutoRefresh">
          <q-icon :name="autoRefresh ? 'mdi-pause-circle-outline' : 'mdi-play-circle-outline'" size="15px" />
          <q-tooltip>{{ autoRefresh ? 'Pause' : 'Resume' }} auto-refresh ({{ interval }}s)</q-tooltip>
        </button>
        <button class="icon-btn" :disabled="loading || refreshing" @click="refresh">
          <q-icon name="mdi-refresh" size="15px" />
          <q-tooltip>Refresh now</q-tooltip>
        </button>
        <slot name="actions" />
      </div>
    </div>

    <div class="log-viewer__body" :style="{ maxHeight }">
      <div v-if="loading" class="log-viewer__loading">
        <q-spinner size="14px" />
        <span>Loading logs…</span>
      </div>
      <p v-else-if="error" class="log-viewer__error">{{ error }}</p>
      <pre
        v-else-if="lines.length"
        ref="preEl"
        class="log-viewer__pre"
        :class="{ 'log-viewer__pre--flash': flash }"
        @scroll="onScroll"
      >{{ lines.join('\n') }}</pre>
      <p v-else class="log-viewer__empty">EOF — No LOG available at moment or yet</p>
    </div>
  </div>
</template>

<style scoped>
.log-viewer { display: flex; flex-direction: column; min-height: 0; }

.log-viewer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--fs-border);
}

.log-viewer__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--fs-text-primary);
}

.log-viewer__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.log-viewer__pod {
  font-size: 11px;
  font-weight: 400;
  color: var(--fs-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-viewer__poll-spinner { opacity: 0.5; }

.log-viewer__controls { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.log-viewer__setup {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 6px;
  font-size: 11.5px;
  color: var(--fs-text-secondary);
  cursor: pointer;
}

.log-viewer__interval-label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--fs-text-muted);
}

.log-viewer__interval-input {
  width: 40px;
  background: var(--fs-bg-elevated, var(--fs-bg-surface));
  border: 1px solid var(--fs-border);
  border-radius: 3px;
  padding: 2px 4px;
  font-size: 11px;
  font-family: var(--fs-font-mono);
  color: var(--fs-text-primary);
  text-align: center;
  outline: none;
}
.log-viewer__interval-input:focus { border-color: var(--fs-accent); }
.log-viewer__interval-unit { font-size: 11px; color: var(--fs-text-muted); }

.log-viewer__body { overflow: hidden; display: flex; flex-direction: column; }

.log-viewer__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  font-size: 12px;
  color: var(--fs-text-muted);
}

.log-viewer__error { padding: 16px; margin: 0; font-size: 12px; color: var(--fs-neg, #e57373); }
.log-viewer__empty { padding: 20px 16px; margin: 0; font-size: 12px; color: var(--fs-text-muted); }

.log-viewer__pre {
  margin: 0;
  padding: 14px 16px;
  font-family: var(--fs-font-mono);
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--fs-text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  overflow-y: auto;
  flex: 1;
  background: var(--fs-bg-elevated, var(--fs-bg-surface));
}

@keyframes log-flash {
  0%   { background: color-mix(in srgb, var(--fs-accent) 14%, var(--fs-bg-elevated, var(--fs-bg-surface))); }
  100% { background: var(--fs-bg-elevated, var(--fs-bg-surface)); }
}
.log-viewer__pre--flash { animation: log-flash 0.4s ease-out; }

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 4px; border: none; background: transparent;
  color: var(--fs-text-muted); cursor: pointer; transition: color var(--fs-ease), background var(--fs-ease);
}
.icon-btn:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.icon-btn--active { color: var(--fs-accent); }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fs-mono { font-family: var(--fs-font-mono); }
</style>
