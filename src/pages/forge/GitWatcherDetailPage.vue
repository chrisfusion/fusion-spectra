<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { usePermission } from '@/composables/usePermission'
import * as forgeApi from '@/api/forgeApi'

const route  = useRoute()
const router = useRouter()
const $q     = useQuasar()
const { can } = usePermission()

const name = route.params.name as string

const loading = ref(true)
const error   = ref<string | null>(null)
const watcher = ref<forgeApi.GitWatcher | null>(null)

const toggling = ref(false)
const deleting = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

function isInFlight(w: forgeApi.GitWatcher) {
  return !!w.status.lastBuildName
}

async function loadWatcher() {
  error.value = null
  try {
    watcher.value = await forgeApi.getGitWatcher(name)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load watcher'
  } finally {
    loading.value = false
  }
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    if (!watcher.value) return
    try {
      const updated = await forgeApi.getGitWatcher(name)
      watcher.value = updated
      if (!isInFlight(updated)) stopPolling()
    } catch { /* ignore poll errors */ }
  }, 15_000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

async function toggleEnabled() {
  if (!watcher.value) return
  toggling.value = true
  const next = !(watcher.value.spec.enabled ?? true)
  try {
    const spec = watcher.value.spec
    await forgeApi.updateGitWatcher(name, {
      repo_url:         spec.repoURL,
      repo_ref:         spec.repoRef,
      build_type:       spec.buildType,
      enabled:          next,
      token_secret_ref: spec.tokenSecretRef,
      artifact_name:    spec.name,
      metadata_source:  spec.metadataSource,
      version:          spec.version,
      python_version:   spec.pythonVersion,
      entrypoint_file:  spec.entrypointFile,
      project_dir:      spec.projectDir,
      description:      spec.description,
    })
    $q.notify({ type: 'positive', message: `Watcher ${next ? 'enabled' : 'disabled'}.` })
    await loadWatcher()
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Toggle failed' })
  } finally {
    toggling.value = false
  }
}

function confirmDelete() {
  $q.dialog({
    title:   'Delete Watcher',
    message: `Delete watcher <strong>${name}</strong>? The watcher CR will be removed; existing builds are not affected.`,
    html:    true,
    ok:     { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deleting.value = true
    try {
      await forgeApi.deleteGitWatcher(name)
      $q.notify({ type: 'positive', message: `Watcher ${name} deleted.` })
      router.push('/forge/gitwatchers')
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
      deleting.value = false
    }
  })
}

function formatDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

function shortSha(sha?: string) {
  if (!sha) return '—'
  return sha.slice(0, 8)
}

const isEnabled  = computed(() => watcher.value?.spec.enabled ?? true)
const phase      = computed(() => watcher.value?.status.phase ?? '')
const phaseClass = computed(() => phase.value === 'Active' ? 'badge badge--active' : 'badge badge--disabled')

// forge-app-13 → /forge/appbuilds/13 ; forge-git-7 → /forge/gitbuilds/7
const buildDetailRoute = computed(() => {
  const n = watcher.value?.status.lastBuildName
  if (!n) return null
  const appM = n.match(/^forge-app-(\d+)$/)
  if (appM) return `/forge/appbuilds/${appM[1]}`
  const gitM = n.match(/^forge-git-(\d+)$/)
  if (gitM) return `/forge/gitbuilds/${gitM[1]}`
  return null
})

onMounted(async () => {
  await loadWatcher()
  if (watcher.value && isInFlight(watcher.value)) startPolling()
})
onUnmounted(stopPolling)
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/forge/gitwatchers')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Watchers
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current fs-mono">{{ name }}</span>
    </div>

    <!-- ── Spec panel (left) ── -->
    <CanvasPanel
      title="Configuration"
      icon="mdi-cog-outline"
      :loading="loading"
      :error="error ?? undefined"
      @refresh="loadWatcher"
    >
      <template v-if="watcher" #actions>
        <button
          v-if="can('forge:gitwatchers:write')"
          class="fs-btn fs-btn--ghost"
          @click="router.push(`/forge/gitwatchers/${encodeURIComponent(name)}/edit`)"
        >
          <q-icon name="mdi-pencil-outline" size="14px" />
          Edit
        </button>
      </template>

      <div v-if="watcher" class="spec-body">
        <div class="kv-table">
          <div class="kv-row">
            <span class="kv-key">Name</span>
            <span class="kv-val fs-mono">{{ watcher.name }}</span>
          </div>
          <div class="kv-row">
            <span class="kv-key">Build Type</span>
            <span class="kv-val">
              <span class="type-badge" :class="watcher.spec.buildType === 'git' ? 'type-badge--git' : 'type-badge--app'">
                <q-icon :name="watcher.spec.buildType === 'git' ? 'mdi-git' : 'mdi-rocket-launch-outline'" size="11px" />
                {{ watcher.spec.buildType }}
              </span>
            </span>
          </div>
          <div class="kv-row">
            <span class="kv-key">Repo URL</span>
            <span class="kv-val fs-mono url-val">{{ watcher.spec.repoURL }}</span>
          </div>
          <div class="kv-row">
            <span class="kv-key">Ref</span>
            <span class="kv-val fs-mono">{{ watcher.spec.repoRef || 'main' }}</span>
          </div>
          <div v-if="watcher.spec.projectDir" class="kv-row">
            <span class="kv-key">Project Dir</span>
            <span class="kv-val fs-mono">{{ watcher.spec.projectDir }}</span>
          </div>
          <template v-if="watcher.spec.buildType === 'git'">
            <div v-if="watcher.spec.name" class="kv-row">
              <span class="kv-key">Artifact</span>
              <span class="kv-val fs-mono">{{ watcher.spec.name }}</span>
            </div>
            <div v-if="watcher.spec.metadataSource" class="kv-row">
              <span class="kv-key">Metadata Src</span>
              <span class="kv-val">{{ watcher.spec.metadataSource }}</span>
            </div>
            <div v-if="watcher.spec.version" class="kv-row">
              <span class="kv-key">Version</span>
              <span class="kv-val fs-mono">{{ watcher.spec.version }}</span>
            </div>
            <div v-if="watcher.spec.pythonVersion" class="kv-row">
              <span class="kv-key">Python</span>
              <span class="kv-val fs-mono">{{ watcher.spec.pythonVersion }}</span>
            </div>
            <div v-if="watcher.spec.entrypointFile" class="kv-row">
              <span class="kv-key">Entrypoint</span>
              <span class="kv-val fs-mono">{{ watcher.spec.entrypointFile }}</span>
            </div>
          </template>
          <div v-if="watcher.spec.description" class="kv-row">
            <span class="kv-key">Description</span>
            <span class="kv-val">{{ watcher.spec.description }}</span>
          </div>
          <div v-if="watcher.spec.tokenSecretRef" class="kv-row">
            <span class="kv-key">Token Secret</span>
            <span class="kv-val fs-mono">{{ watcher.spec.tokenSecretRef.name }} / {{ watcher.spec.tokenSecretRef.key }}</span>
          </div>
          <div class="kv-row">
            <span class="kv-key">Created</span>
            <span class="kv-val">{{ formatDate(watcher.createdAt) }}</span>
          </div>
        </div>
      </div>
    </CanvasPanel>

    <!-- ── Status panel (right) ── -->
    <CanvasPanel
      title="Status"
      icon="mdi-pulse"
    >
      <template v-if="watcher" #actions>
        <button
          v-if="can('forge:gitwatchers:write')"
          class="fs-btn"
          :class="isEnabled ? 'fs-btn--warn' : 'fs-btn--ghost'"
          :disabled="toggling"
          @click="toggleEnabled"
        >
          <q-spinner v-if="toggling" size="13px" />
          <q-icon v-else :name="isEnabled ? 'mdi-pause' : 'mdi-play'" size="14px" />
          {{ toggling ? '…' : isEnabled ? 'Disable' : 'Enable' }}
        </button>
        <button
          v-if="can('forge:gitwatchers:delete')"
          class="fs-btn fs-btn--danger"
          :disabled="deleting"
          @click="confirmDelete"
        >
          <q-spinner v-if="deleting" size="13px" />
          <q-icon v-else name="mdi-delete-outline" size="14px" />
          Delete
        </button>
      </template>

      <div v-if="watcher" class="status-body">
        <div class="phase-row">
          <span :class="phaseClass">{{ phase || 'Unknown' }}</span>
          <span class="enabled-chip" :class="isEnabled ? 'enabled-chip--on' : 'enabled-chip--off'">
            <q-icon :name="isEnabled ? 'mdi-check-circle-outline' : 'mdi-pause-circle-outline'" size="12px" />
            {{ isEnabled ? 'Enabled' : 'Disabled' }}
          </span>
          <span v-if="watcher.status.lastBuildName" class="inflight-chip">
            <q-spinner size="10px" />
            Build in progress
          </span>
        </div>

        <div class="kv-table">
          <div class="kv-row">
            <span class="kv-key">Last Checked</span>
            <span class="kv-val">{{ formatDate(watcher.status.lastCheckedAt) }}</span>
          </div>
          <div class="kv-row">
            <span class="kv-key">Last Commit</span>
            <span class="kv-val fs-mono">{{ shortSha(watcher.status.lastSeenCommit) }}</span>
          </div>
          <div class="kv-row">
            <span class="kv-key">Last Built</span>
            <span class="kv-val fs-mono">{{ watcher.status.lastBuiltVersion || '—' }}</span>
          </div>
          <div v-if="watcher.status.lastBuildName" class="kv-row">
            <span class="kv-key">In-flight Build</span>
            <span class="kv-val fs-mono">
              <button v-if="buildDetailRoute" class="build-link" @click="router.push(buildDetailRoute)">
                <q-icon name="mdi-open-in-new" size="11px" />
                {{ watcher.status.lastBuildName }}
              </button>
              <span v-else>{{ watcher.status.lastBuildName }}</span>
            </span>
          </div>
          <div v-if="watcher.status.lastBuildVersion" class="kv-row">
            <span class="kv-key">Building Version</span>
            <span class="kv-val fs-mono">{{ watcher.status.lastBuildVersion }}</span>
          </div>
          <div class="kv-row">
            <span class="kv-key">Failures</span>
            <span class="kv-val">
              <span
                v-if="watcher.status.consecutiveFailures > 0"
                class="failures-badge"
              >{{ watcher.status.consecutiveFailures }}</span>
              <span v-else class="muted">0</span>
            </span>
          </div>
        </div>

        <div
          v-if="watcher.status.lastError"
          class="error-box"
        >
          <div class="error-box__header">
            <q-icon name="mdi-alert-circle-outline" size="13px" />
            Last Error
          </div>
          <pre class="error-box__body">{{ watcher.status.lastError }}</pre>
        </div>

        <div v-if="watcher.status.message" class="info-box">
          <q-icon name="mdi-information-outline" size="13px" />
          {{ watcher.status.message }}
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
.muted   { color: var(--fs-text-muted); }

.spec-body,
.status-body { padding: 0 10px 10px; }

/* Key-value table */
.kv-table { display: flex; flex-direction: column; }
.kv-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid var(--fs-border);
  font-size: 12.5px;
  align-items: start;
}
.kv-row:last-child { border-bottom: none; }
.kv-key {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--fs-text-muted); padding-top: 1px;
}
.kv-val { color: var(--fs-text-primary); word-break: break-all; }
.url-val { font-size: 11.5px; }

/* Phase / enabled */
.phase-row { display: flex; align-items: center; gap: 8px; padding: 10px 0 14px; flex-wrap: wrap; }

.badge {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 3px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
}
.badge--active   { background: color-mix(in srgb, var(--fs-pos, #4caf50) 15%, transparent); color: var(--fs-pos, #4caf50); }
.badge--disabled { background: var(--fs-bg-hover); color: var(--fs-text-muted); }

.enabled-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 3px; font-size: 10.5px; font-weight: 600;
}
.enabled-chip--on  { background: color-mix(in srgb, var(--fs-pos, #4caf50) 10%, transparent); color: var(--fs-pos, #4caf50); }
.enabled-chip--off { background: var(--fs-bg-hover); color: var(--fs-text-muted); }

.inflight-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 8px; border-radius: 3px; font-size: 10.5px; font-weight: 600;
  background: color-mix(in srgb, var(--fs-accent) 12%, transparent); color: var(--fs-accent);
}

/* Build type badge */
.type-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px; border-radius: 3px; font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em;
}
.type-badge--git { background: color-mix(in srgb, var(--fs-accent) 15%, transparent); color: var(--fs-accent); }
.type-badge--app { background: color-mix(in srgb, #e8732a 15%, transparent); color: #e8732a; }

/* Failures badge */
.failures-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 20px; padding: 1px 6px; border-radius: 10px;
  font-size: 10.5px; font-weight: 700;
  background: color-mix(in srgb, var(--fs-neg, #e57373) 15%, transparent); color: var(--fs-neg, #e57373);
}

/* Error / info boxes */
.error-box {
  margin-top: 14px;
  border: 1px solid color-mix(in srgb, var(--fs-neg, #e57373) 40%, transparent);
  border-radius: 5px; overflow: hidden;
}
.error-box__header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; font-size: 11.5px; font-weight: 600;
  color: var(--fs-neg, #e57373);
  background: color-mix(in srgb, var(--fs-neg, #e57373) 8%, transparent);
}
.error-box__body {
  margin: 0; padding: 10px 12px;
  font-family: var(--fs-font-mono); font-size: 11.5px;
  color: var(--fs-text-primary); white-space: pre-wrap; word-break: break-word;
}

.info-box {
  margin-top: 10px; display: flex; align-items: flex-start; gap: 6px;
  font-size: 11.5px; color: var(--fs-text-muted);
  background: var(--fs-bg-hover); border: 1px solid var(--fs-border);
  border-radius: 4px; padding: 8px 12px; line-height: 1.5;
}

/* Buttons */
.fs-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px;
  border-radius: 4px; font-size: 12.5px; font-family: inherit; font-weight: 500;
  cursor: pointer; border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease), filter var(--fs-ease);
}
.fs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.build-link {
  display: inline-flex; align-items: center; gap: 4px;
  background: none; border: none; padding: 0; cursor: pointer;
  font-family: var(--fs-font-mono); font-size: inherit;
  color: var(--fs-accent); text-decoration: underline; text-decoration-style: dotted;
}
.build-link:hover { text-decoration-style: solid; }
.fs-btn--ghost:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.fs-btn--warn {
  background: color-mix(in srgb, var(--fs-warn, #ff9800) 15%, transparent);
  color: var(--fs-warn, #ff9800);
  border-color: color-mix(in srgb, var(--fs-warn, #ff9800) 30%, transparent);
}
.fs-btn--warn:hover:not(:disabled) { filter: brightness(1.1); }
.fs-btn--danger {
  background: color-mix(in srgb, var(--fs-neg, #e57373) 12%, transparent);
  color: var(--fs-neg, #e57373);
  border-color: color-mix(in srgb, var(--fs-neg, #e57373) 30%, transparent);
}
.fs-btn--danger:hover:not(:disabled) { filter: brightness(1.1); }
</style>
