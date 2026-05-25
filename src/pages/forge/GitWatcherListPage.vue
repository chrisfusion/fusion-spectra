<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { usePermission } from '@/composables/usePermission'
import * as forgeApi from '@/api/forgeApi'

const router  = useRouter()
const $q      = useQuasar()
const { can } = usePermission()

const loading = ref(false)
const error   = ref<string | null>(null)
const items   = ref<forgeApi.GitWatcher[]>([])

const nameSearch  = ref('')
const currentPage = ref(1)
const PAGE_SIZE   = 20

const togglingNames  = ref<Set<string>>(new Set())
const deletingNames  = ref<Set<string>>(new Set())

async function loadWatchers() {
  loading.value = true
  error.value   = null
  try {
    const result = await forgeApi.listGitWatchers({ page: 0, pageSize: 200 })
    items.value  = result.items
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load watchers'
  } finally {
    loading.value = false
  }
}

const filteredItems = computed(() => {
  const q = nameSearch.value.trim().toLowerCase()
  return q ? items.value.filter(w => w.name.toLowerCase().includes(q)) : items.value
})

const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredItems.value.slice(start, start + PAGE_SIZE)
})

function onSearch() { currentPage.value = 1 }

function phaseClass(phase: string) {
  return phase === 'Active' ? 'badge badge--active' : 'badge badge--disabled'
}

function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

function truncateUrl(url: string) {
  return url.length > 50 ? url.slice(0, 47) + '…' : url
}

async function toggleEnabled(w: forgeApi.GitWatcher) {
  togglingNames.value = new Set([...togglingNames.value, w.name])
  try {
    const enabled = !(w.spec.enabled ?? true)
    await forgeApi.updateGitWatcher(w.name, {
      repo_url:         w.spec.repoURL,
      repo_ref:         w.spec.repoRef,
      build_type:       w.spec.buildType,
      enabled,
      token_secret_ref: w.spec.tokenSecretRef,
      artifact_name:    w.spec.name,
      metadata_source:  w.spec.metadataSource,
      version:          w.spec.version,
      python_version:   w.spec.pythonVersion,
      entrypoint_file:  w.spec.entrypointFile,
      project_dir:      w.spec.projectDir,
      description:      w.spec.description,
    })
    $q.notify({ type: 'positive', message: `GitOps poller ${w.name} ${enabled ? 'enabled' : 'disabled'}.` })
    await loadWatchers()
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Toggle failed' })
  } finally {
    togglingNames.value = new Set([...togglingNames.value].filter(n => n !== w.name))
  }
}

function confirmDelete(w: forgeApi.GitWatcher) {
  $q.dialog({
    title:   'Delete GitOps Poller',
    message: `Delete poller <strong>${w.name}</strong>? The poller CR will be removed; existing builds are not affected.`,
    html:    true,
    ok:     { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deletingNames.value = new Set([...deletingNames.value, w.name])
    try {
      await forgeApi.deleteGitWatcher(w.name)
      $q.notify({ type: 'positive', message: `GitOps poller ${w.name} deleted.` })
      await loadWatchers()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
    } finally {
      deletingNames.value = new Set([...deletingNames.value].filter(n => n !== w.name))
    }
  })
}

onMounted(loadWatchers)
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/forge')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Forge
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">GitOps Builds</span>
    </div>

    <CanvasPanel
      title="GitOps Builds"
      icon="mdi-source-branch-sync"
      :wide="true"
      :loading="loading"
      :error="error ?? undefined"
      @refresh="loadWatchers"
    >
      <template #actions>
        <button
          v-if="can('forge:gitwatchers:write')"
          class="fs-btn fs-btn--primary"
          @click="router.push('/forge/gitops-builder/create')"
        >
          <q-icon name="mdi-source-branch-plus" size="14px" />
          GitOps Builder
        </button>
      </template>

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="search-wrap">
          <q-icon name="mdi-magnify" size="14px" class="search-icon" />
          <input
            v-model="nameSearch"
            class="fs-input search-input"
            placeholder="Filter by name…"
            @input="onSearch"
          />
        </div>
      </div>

      <!-- Table -->
      <div v-if="filteredItems.length" class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Repository</th>
              <th>Phase</th>
              <th>Enabled</th>
              <th>Last Version</th>
              <th>Last Checked</th>
              <th>Failures</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="w in pagedItems"
              :key="w.name"
              class="data-row"
              @click="router.push(`/forge/gitwatchers/${encodeURIComponent(w.name)}`)"
            >
              <td class="cell-name fs-mono">{{ w.name }}</td>
              <td>
                <span class="type-badge" :class="w.spec.buildType === 'git' ? 'type-badge--git' : 'type-badge--app'">
                  <q-icon :name="w.spec.buildType === 'git' ? 'mdi-language-python' : 'mdi-rocket-launch-outline'" size="11px" />
                  {{ w.spec.buildType === 'git' ? 'Python Builder' : 'Generic Builder' }}
                </span>
              </td>
              <td class="cell-url fs-mono">
                <span :title="w.spec.repoURL">{{ truncateUrl(w.spec.repoURL) }}</span>
              </td>
              <td>
                <span :class="phaseClass(w.status.phase)">{{ w.status.phase || '—' }}</span>
              </td>
              <td>
                <q-icon
                  :name="(w.spec.enabled ?? true) ? 'mdi-check-circle-outline' : 'mdi-pause-circle-outline'"
                  size="16px"
                  :style="{ color: (w.spec.enabled ?? true) ? 'var(--fs-pos)' : 'var(--fs-text-muted)' }"
                />
              </td>
              <td class="fs-mono">{{ w.status.lastBuiltVersion || '—' }}</td>
              <td class="cell-date">{{ formatDate(w.status.lastCheckedAt) }}</td>
              <td>
                <span
                  v-if="w.status.consecutiveFailures > 0"
                  class="failures-badge"
                >{{ w.status.consecutiveFailures }}</span>
                <span v-else class="muted">0</span>
              </td>
              <td class="cell-actions" @click.stop>
                <button
                  v-if="can('forge:gitwatchers:write')"
                  class="icon-btn"
                  :title="(w.spec.enabled ?? true) ? 'Disable' : 'Enable'"
                  :disabled="togglingNames.has(w.name)"
                  @click="toggleEnabled(w)"
                >
                  <q-spinner v-if="togglingNames.has(w.name)" size="13px" />
                  <q-icon
                    v-else
                    :name="(w.spec.enabled ?? true) ? 'mdi-pause' : 'mdi-play'"
                    size="15px"
                  />
                </button>
                <button
                  v-if="can('forge:gitwatchers:write')"
                  class="icon-btn"
                  title="Edit"
                  @click="router.push(`/forge/gitwatchers/${encodeURIComponent(w.name)}/edit`)"
                >
                  <q-icon name="mdi-pencil-outline" size="15px" />
                </button>
                <button
                  v-if="can('forge:gitwatchers:delete')"
                  class="icon-btn icon-btn--danger"
                  title="Delete"
                  :disabled="deletingNames.has(w.name)"
                  @click="confirmDelete(w)"
                >
                  <q-spinner v-if="deletingNames.has(w.name)" size="13px" />
                  <q-icon v-else name="mdi-delete-outline" size="15px" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty state -->
      <div v-else-if="!loading && !error" class="empty-state">
        <q-icon name="mdi-source-branch-sync" size="36px" class="empty-icon" />
        <p class="empty-title">No GitOps pollers yet</p>
        <p class="empty-sub">GitOps pollers automatically trigger builds when new versions appear in a repository.</p>
        <button
          v-if="can('forge:gitwatchers:write')"
          class="fs-btn fs-btn--primary"
          @click="router.push('/forge/gitops-builder/create')"
        >
          <q-icon name="mdi-source-branch-plus" size="14px" />
          GitOps Builder
        </button>
      </div>

      <!-- Pagination -->
      <div v-if="filteredItems.length > PAGE_SIZE" class="pagination">
        <q-pagination
          v-model="currentPage"
          :max="Math.ceil(filteredItems.length / PAGE_SIZE)"
          :max-pages="7"
          boundary-numbers
          color="grey"
          active-color="primary"
          size="sm"
        />
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
.breadcrumb__back:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.breadcrumb__current { font-size: 12px; color: var(--fs-accent); font-weight: 500; }
.muted-icon { color: var(--fs-text-muted); }

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px 6px;
}
.search-wrap {
  position: relative;
  flex: 1;
  max-width: 280px;
}
.search-icon {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fs-text-muted);
  pointer-events: none;
}
.search-input { padding-left: 30px; }

.fs-input {
  width: 100%;
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

.table-wrap { overflow-x: auto; padding: 0 10px 10px; }

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.data-table th {
  text-align: left;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  padding: 6px 10px;
  border-bottom: 1px solid var(--fs-border);
  white-space: nowrap;
}
.data-row {
  cursor: pointer;
  transition: background var(--fs-ease);
}
.data-row:hover { background: var(--fs-bg-hover); }
.data-row td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--fs-border);
  color: var(--fs-text-primary);
  vertical-align: middle;
}
.data-row:last-child td { border-bottom: none; }

.cell-name  { font-weight: 500; white-space: nowrap; }
.cell-url   { font-size: 11.5px; color: var(--fs-text-muted); max-width: 260px; }
.cell-date  { font-size: 11.5px; color: var(--fs-text-muted); white-space: nowrap; }

.fs-mono { font-family: var(--fs-font-mono); }
.muted   { color: var(--fs-text-muted); }

/* Phase badge */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.badge--active   { background: color-mix(in srgb, var(--fs-pos, #4caf50) 15%, transparent); color: var(--fs-pos, #4caf50); }
.badge--disabled { background: var(--fs-bg-hover); color: var(--fs-text-muted); }

/* Build type badge */
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 3px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.type-badge--git { background: color-mix(in srgb, var(--fs-accent) 15%, transparent); color: var(--fs-accent); }
.type-badge--app { background: color-mix(in srgb, #e8732a 15%, transparent); color: #e8732a; }

/* Failures badge */
.failures-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10.5px;
  font-weight: 700;
  background: color-mix(in srgb, var(--fs-neg, #e57373) 15%, transparent);
  color: var(--fs-neg, #e57373);
}

.cell-actions {
  display: flex;
  gap: 4px;
  align-items: center;
  white-space: nowrap;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--fs-text-muted);
  transition: background var(--fs-ease), color var(--fs-ease);
}
.icon-btn:hover:not(:disabled) { background: var(--fs-bg-hover); color: var(--fs-text-primary); }
.icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.icon-btn--danger:hover:not(:disabled) { color: var(--fs-neg, #e57373); }

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 52px 24px 44px;
  text-align: center;
}
.empty-icon  { color: var(--fs-text-muted); opacity: 0.5; }
.empty-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--fs-text-primary); }
.empty-sub   { margin: 0; font-size: 12px; color: var(--fs-text-muted); max-width: 380px; }

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  padding: 12px 0 4px;
}

/* Action bar */
.fs-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 4px;
  font-size: 12.5px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease), filter var(--fs-ease);
}
.fs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fs-btn--primary { background: var(--fs-accent); color: #fff; border-color: var(--fs-accent); }
.fs-btn--primary:hover:not(:disabled) { filter: brightness(1.1); }
</style>
