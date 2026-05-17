<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import JsonEditor from '@/components/JsonEditor.vue'
import { usePermission } from '@/composables/usePermission'
import * as weaveApi from '@/api/weaveApi'

const router = useRouter()
const $q     = useQuasar()
const { can } = usePermission()

const PAGE_SIZE = 20

const loading = ref(false)
const error   = ref<string | null>(null)
const result  = ref<weaveApi.WeaveServiceTemplateList | null>(null)

const nameSearch  = ref('')
const currentPage = ref(1)

const deletingNames = ref<Set<string>>(new Set())

// detail / edit dialog
const selectedTemplate   = ref<weaveApi.WeaveServiceTemplate | null>(null)
const templateDialogOpen = ref(false)
const editMode           = ref(false)
const editSpecJson       = ref('')
const editSpecValid      = ref(true)
const editSubmitting     = ref(false)
const editError          = ref<string | null>(null)
const secCtxExpanded     = ref(false)

interface SecCtxState {
  runAsUser:           string
  runAsGroup:          string
  fsGroup:             string
  runAsNonRoot:        string
  allowPrivEscalation: string
}
const editSecCtx = ref<SecCtxState>({
  runAsUser: '', runAsGroup: '', fsGroup: '', runAsNonRoot: '', allowPrivEscalation: '',
})

function openTemplateDialog(t: weaveApi.WeaveServiceTemplate) {
  selectedTemplate.value   = t
  templateDialogOpen.value = true
  editMode.value           = false
  editError.value          = null
}

function enterEditMode() {
  const spec = selectedTemplate.value!.spec
  const pod  = spec.podSecurityContext
  const ctr  = spec.containerSecurityContext
  editSecCtx.value = {
    runAsUser:           pod?.runAsUser    != null ? String(pod.runAsUser)    : '',
    runAsGroup:          pod?.runAsGroup   != null ? String(pod.runAsGroup)   : '',
    fsGroup:             pod?.fsGroup      != null ? String(pod.fsGroup)      : '',
    runAsNonRoot:        ctr?.runAsNonRoot != null ? String(ctr.runAsNonRoot) : '',
    allowPrivEscalation: ctr?.allowPrivilegeEscalation != null ? String(ctr.allowPrivilegeEscalation) : '',
  }
  secCtxExpanded.value = Object.values(editSecCtx.value).some(v => v !== '')
  const { podSecurityContext: _p, containerSecurityContext: _c, ...rest } = spec
  editSpecJson.value  = JSON.stringify(rest, null, 2)
  editSpecValid.value = true
  editError.value     = null
  editMode.value      = true
}

function cancelEdit() {
  editMode.value       = false
  editError.value      = null
  secCtxExpanded.value = false
}

function applySecCtx(spec: weaveApi.WeaveServiceTemplateSpec) {
  const sc = editSecCtx.value
  const pod: weaveApi.PodSecurityContext = {}
  if (sc.runAsUser  !== '') pod.runAsUser  = Number(sc.runAsUser)
  if (sc.runAsGroup !== '') pod.runAsGroup = Number(sc.runAsGroup)
  if (sc.fsGroup    !== '') pod.fsGroup    = Number(sc.fsGroup)
  if (Object.keys(pod).length) spec.podSecurityContext = pod
  const ctr: weaveApi.ContainerSecurityContext = {}
  if (sc.runAsNonRoot        !== '') ctr.runAsNonRoot             = sc.runAsNonRoot === 'true'
  if (sc.allowPrivEscalation !== '') ctr.allowPrivilegeEscalation = sc.allowPrivEscalation === 'true'
  if (Object.keys(ctr).length) spec.containerSecurityContext = ctr
}

async function performUpdate(newSpec: weaveApi.WeaveServiceTemplateSpec) {
  const t = selectedTemplate.value!
  editSubmitting.value = true
  editError.value      = null
  try {
    const updated = await weaveApi.updateServiceTemplate(t, newSpec)
    result.value = result.value
      ? { ...result.value, items: result.value.items.map(i => i.metadata.name === t.metadata.name ? updated : i) }
      : result.value
    selectedTemplate.value = updated
    editMode.value = false
  } catch (e) {
    editError.value = e instanceof Error ? e.message : 'Update failed'
  } finally {
    editSubmitting.value = false
  }
}

function saveEdit() {
  let newSpec: weaveApi.WeaveServiceTemplateSpec
  try {
    newSpec = JSON.parse(editSpecJson.value) as weaveApi.WeaveServiceTemplateSpec
  } catch {
    editError.value = 'Invalid JSON — fix syntax before saving'
    return
  }
  if (!editSpecValid.value) {
    editError.value = 'Invalid JSON — fix syntax before saving'
    return
  }

  applySecCtx(newSpec)

  const t            = selectedTemplate.value!
  const imageChanged = newSpec.image !== t.spec.image

  if (imageChanged) {
    $q.dialog({
      title:   'Change Container Image?',
      message: `You are changing the image from <code>${t.spec.image}</code> to <code>${newSpec.image}</code>.<br>This will affect all future runs using this template.`,
      html:    true,
      ok:     { label: 'Apply Change', color: 'warning', flat: true },
      cancel: { label: 'Cancel', flat: true },
    }).onOk(() => performUpdate(newSpec))
    return
  }

  performUpdate(newSpec)
}

function formatSpecJson(t: weaveApi.WeaveServiceTemplate): string {
  return JSON.stringify(t.spec, null, 2)
}

async function loadTemplates() {
  loading.value = true
  error.value   = null
  try {
    result.value = await weaveApi.listServiceTemplates()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load service templates'
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

function onSearch() { currentPage.value = 1 }

function templateAge(t: weaveApi.WeaveServiceTemplate): string {
  const ts = t.metadata.creationTimestamp
  return ts ? new Date(ts).toLocaleString() : '—'
}

function confirmDelete(t: weaveApi.WeaveServiceTemplate) {
  $q.dialog({
    title:   'Delete Service Template',
    message: `Delete <strong>${t.metadata.name}</strong>? This cannot be undone.`,
    html:    true,
    ok:     { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deletingNames.value = new Set([...deletingNames.value, t.metadata.name])
    try {
      await weaveApi.deleteServiceTemplate(t.metadata.name)
      await loadTemplates()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
    } finally {
      deletingNames.value = new Set([...deletingNames.value].filter(n => n !== t.metadata.name))
    }
  })
}

onMounted(loadTemplates)
</script>

<template>
  <div class="page-grid">
    <CanvasPanel
      title="Service Templates"
      icon="mdi-server-outline"
      :wide="true"
      :loading="loading"
      :error="error ?? undefined"
      @refresh="loadTemplates"
    >
      <template #actions>
        <button
          v-if="can('weave:servicetemplates:write')"
          class="fs-btn fs-btn--primary"
          @click="router.push('/pipelines/weave/servicetemplates/create')"
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
        <span class="total-hint">{{ filteredItems.length }} template{{ filteredItems.length !== 1 ? 's' : '' }}</span>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <table class="tpl-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Image</th>
              <th>Replicas</th>
              <th>Service Type</th>
              <th>Valid</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in pagedItems" :key="t.metadata.name" class="clickable-row" @click="openTemplateDialog(t)">
              <td class="col-name fs-mono">{{ t.metadata.name }}</td>
              <td class="col-image fs-mono">{{ t.spec.image }}</td>
              <td class="col-num">{{ t.spec.replicas ?? 1 }}</td>
              <td class="col-muted">{{ t.spec.serviceType ?? 'ClusterIP' }}</td>
              <td>
                <span v-if="t.status?.valid === true"  class="valid-badge valid-badge--ok">
                  <q-icon name="mdi-check-circle-outline" size="12px" /> Valid
                </span>
                <span v-else-if="t.status?.valid === false" class="valid-badge valid-badge--err"
                      :title="t.status.validationMessage">
                  <q-icon name="mdi-alert-circle-outline" size="12px" /> Invalid
                </span>
                <span v-else class="valid-badge valid-badge--pending">
                  <q-icon name="mdi-clock-outline" size="12px" /> Pending
                </span>
              </td>
              <td class="col-muted">{{ templateAge(t) }}</td>
              <td class="col-actions" @click.stop>
                <button
                  v-if="can('weave:servicetemplates:delete')"
                  class="icon-btn icon-btn--danger"
                  :disabled="deletingNames.has(t.metadata.name)"
                  :title="`Delete ${t.metadata.name}`"
                  @click="confirmDelete(t)"
                >
                  <q-spinner v-if="deletingNames.has(t.metadata.name)" size="13px" />
                  <q-icon v-else name="mdi-delete-outline" size="16px" />
                </button>
              </td>
            </tr>
            <tr v-if="!loading && pagedItems.length === 0">
              <td colspan="7" class="empty-row">No service templates found.</td>
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

  <!-- Template detail / edit dialog -->
  <q-dialog v-model="templateDialogOpen" :persistent="editMode">
    <q-card class="tpl-dialog" v-if="selectedTemplate">
      <q-card-section class="tpl-dialog__header">
        <div class="tpl-dialog__title">
          <q-icon name="mdi-server-outline" size="16px" />
          <span class="fs-mono">{{ selectedTemplate.metadata.name }}</span>
          <span v-if="editMode" class="tpl-dialog__mode-badge">Editing</span>
        </div>
        <div class="tpl-dialog__actions">
          <template v-if="!editMode">
            <button
              v-if="can('weave:servicetemplates:write')"
              class="fs-btn fs-btn--ghost fs-btn--sm"
              @click="enterEditMode"
            >
              <q-icon name="mdi-pencil-outline" size="13px" /> Edit
            </button>
            <q-btn flat round dense icon="mdi-close" @click="templateDialogOpen = false" />
          </template>
          <template v-else>
            <button class="fs-btn fs-btn--ghost fs-btn--sm" :disabled="editSubmitting" @click="cancelEdit">
              Cancel
            </button>
            <button class="fs-btn fs-btn--primary fs-btn--sm" :disabled="editSubmitting || !editSpecValid" @click="saveEdit">
              <q-spinner v-if="editSubmitting" size="12px" color="white" />
              <q-icon v-else name="mdi-check-outline" size="13px" />
              {{ editSubmitting ? 'Saving…' : 'Save' }}
            </button>
          </template>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="tpl-dialog__meta">
        <div class="tdl-grid">
          <div class="tdl-row">
            <span class="tdl-label">Name</span>
            <span class="tdl-value fs-mono">
              {{ selectedTemplate.metadata.name }}
              <q-icon name="mdi-lock-outline" size="11px" class="tdl-lock-icon" />
              <q-tooltip>Template names are immutable in Kubernetes</q-tooltip>
            </span>
          </div>
          <div class="tdl-row">
            <span class="tdl-label">Namespace</span>
            <span class="tdl-value fs-mono">{{ selectedTemplate.metadata.namespace ?? '—' }}</span>
          </div>
          <div class="tdl-row">
            <span class="tdl-label">Created</span>
            <span class="tdl-value">{{ selectedTemplate.metadata.creationTimestamp ? new Date(selectedTemplate.metadata.creationTimestamp).toLocaleString() : '—' }}</span>
          </div>
          <div class="tdl-row">
            <span class="tdl-label">Valid</span>
            <span class="tdl-value">
              <span v-if="selectedTemplate.status?.valid === true"  class="valid-badge valid-badge--ok"><q-icon name="mdi-check-circle-outline" size="12px" /> Valid</span>
              <span v-else-if="selectedTemplate.status?.valid === false" class="valid-badge valid-badge--err"><q-icon name="mdi-alert-circle-outline" size="12px" /> Invalid — {{ selectedTemplate.status.validationMessage }}</span>
              <span v-else class="valid-badge valid-badge--pending"><q-icon name="mdi-clock-outline" size="12px" /> Pending</span>
            </span>
          </div>
          <div class="tdl-row" v-if="selectedTemplate.metadata.uid">
            <span class="tdl-label">UID</span>
            <span class="tdl-value fs-mono tdl-value--uid">{{ selectedTemplate.metadata.uid }}</span>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="tpl-dialog__spec">
        <!-- Security context — view mode -->
        <template v-if="!editMode && (selectedTemplate.spec.podSecurityContext || selectedTemplate.spec.containerSecurityContext)">
          <details class="sec-ctx-details">
            <summary class="sec-ctx-summary">
              <q-icon name="mdi-shield-lock-outline" size="13px" />
              Security Context
            </summary>
            <div class="sec-ctx-view-grid">
              <template v-if="selectedTemplate.spec.podSecurityContext">
                <span class="sec-ctx-key">runAsUser</span>
                <span class="sec-ctx-val fs-mono">{{ selectedTemplate.spec.podSecurityContext.runAsUser ?? '—' }}</span>
                <span class="sec-ctx-key">runAsGroup</span>
                <span class="sec-ctx-val fs-mono">{{ selectedTemplate.spec.podSecurityContext.runAsGroup ?? '—' }}</span>
                <span class="sec-ctx-key">fsGroup</span>
                <span class="sec-ctx-val fs-mono">{{ selectedTemplate.spec.podSecurityContext.fsGroup ?? '—' }}</span>
              </template>
              <template v-if="selectedTemplate.spec.containerSecurityContext">
                <span class="sec-ctx-key">runAsNonRoot</span>
                <span class="sec-ctx-val fs-mono">{{ selectedTemplate.spec.containerSecurityContext.runAsNonRoot ?? '—' }}</span>
                <span class="sec-ctx-key">allowPrivilegeEscalation</span>
                <span class="sec-ctx-val fs-mono">{{ selectedTemplate.spec.containerSecurityContext.allowPrivilegeEscalation ?? '—' }}</span>
              </template>
            </div>
          </details>
        </template>

        <!-- Security context — edit mode -->
        <template v-if="editMode">
          <div class="sec-ctx-toggle-row" @click="secCtxExpanded = !secCtxExpanded">
            <q-icon :name="secCtxExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right'" size="14px" />
            <span class="sec-ctx-toggle-label">Security Context</span>
            <span class="sec-ctx-toggle-hint">(optional)</span>
          </div>
          <div v-show="secCtxExpanded" class="sec-ctx-edit-grid">
            <label class="sec-ctx-key">runAsUser</label>
            <input v-model="editSecCtx.runAsUser" type="number" min="0" placeholder="— not set —" class="fs-input sec-ctx-input" />
            <label class="sec-ctx-key">runAsGroup</label>
            <input v-model="editSecCtx.runAsGroup" type="number" min="0" placeholder="— not set —" class="fs-input sec-ctx-input" />
            <label class="sec-ctx-key">fsGroup</label>
            <input v-model="editSecCtx.fsGroup" type="number" min="0" placeholder="— not set —" class="fs-input sec-ctx-input" />
            <label class="sec-ctx-key">runAsNonRoot</label>
            <select v-model="editSecCtx.runAsNonRoot" class="fs-input sec-ctx-input">
              <option value="">— not set —</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
            <label class="sec-ctx-key">allowPrivilegeEscalation</label>
            <select v-model="editSecCtx.allowPrivEscalation" class="fs-input sec-ctx-input">
              <option value="">— not set —</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
        </template>

        <div class="spec-label">Spec</div>
        <pre v-if="!editMode" class="spec-pre">{{ formatSpecJson(selectedTemplate) }}</pre>
        <JsonEditor
          v-else
          v-model="editSpecJson"
          min-height="220px"
          max-height="45vh"
          @valid="editSpecValid = $event"
        />
        <div v-if="editError" class="edit-error">
          <q-icon name="mdi-alert-circle-outline" size="13px" /> {{ editError }}
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>

</template>

<style scoped>
.page-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 16px;
  align-content: start;
}
.toolbar { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; }
.search-input { width: 220px; }
.total-hint { margin-left: auto; font-size: 11px; color: var(--fs-text-muted); }
.table-wrap { overflow-x: auto; }
.tpl-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.tpl-table th {
  text-align: left; padding: 6px 10px; font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.tpl-table td {
  padding: 9px 10px; border-bottom: 1px solid var(--fs-border);
  color: var(--fs-text-primary); vertical-align: middle;
}
.tpl-table tbody tr:last-child td { border-bottom: none; }
.tpl-table tbody tr:hover td { background: var(--fs-bg-hover); }
.tpl-table tbody tr.clickable-row { cursor: pointer; }
.col-name    { font-weight: 500; color: var(--fs-accent); }
.col-image   { color: var(--fs-text-muted); font-size: 12px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-num     { color: var(--fs-text-muted); text-align: center; }
.col-muted   { color: var(--fs-text-muted); font-size: 12px; }
.col-actions { width: 40px; text-align: center; }
.empty-row   { text-align: center; color: var(--fs-text-muted); padding: 32px 10px !important; }
.valid-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.valid-badge--ok      { color: var(--fs-pos, #4caf50); background: color-mix(in srgb, var(--fs-pos, #4caf50) 10%, transparent); }
.valid-badge--err     { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); cursor: help; }
.valid-badge--pending { color: var(--fs-text-muted);   background: color-mix(in srgb, var(--fs-text-muted)   10%, transparent); }
.icon-btn { background: none; border: none; cursor: pointer; padding: 4px 6px; border-radius: 3px; display: inline-flex; align-items: center; color: var(--fs-text-muted); transition: color var(--fs-ease), background var(--fs-ease); }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.icon-btn--danger:hover:not(:disabled) { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }
.pagination-row { display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding-top: 12px; }
.pagination-hint { font-size: 11px; color: var(--fs-text-muted); }
.fs-input { background: var(--fs-bg-input, var(--fs-bg-hover)); border: 1px solid var(--fs-border); border-radius: 4px; padding: 6px 10px; font-size: 12.5px; font-family: inherit; color: var(--fs-text-primary); outline: none; transition: border-color var(--fs-ease); box-sizing: border-box; }
.fs-input:focus { border-color: var(--fs-accent); }
.fs-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 4px; font-size: 12px; font-family: inherit; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: background var(--fs-ease), filter var(--fs-ease); }
.fs-btn--primary { background: var(--fs-accent); color: #fff; border-color: var(--fs-accent); }
.fs-btn--primary:hover { filter: brightness(1.1); }
.fs-mono { font-family: var(--fs-font-mono); }
</style>

<style>
.tpl-dialog {
  width: 640px;
  max-width: 96vw;
  background: var(--fs-bg-surface);
  color: var(--fs-text-primary);
}
.tpl-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px !important;
}
.tpl-dialog__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fs-text-primary);
}
.tpl-dialog__mode-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--fs-warn, #ff9800);
  background: color-mix(in srgb, var(--fs-warn, #ff9800) 12%, transparent);
}
.tpl-dialog__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tpl-dialog__meta { padding: 12px 16px !important; }
.tpl-dialog__spec { padding: 12px 16px !important; }

.tdl-grid { display: flex; flex-direction: column; }
.tdl-row {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 8px;
  align-items: baseline;
  padding: 6px 0;
  border-bottom: 1px solid var(--fs-border);
}
.tdl-row:last-child { border-bottom: none; }
.tdl-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
}
.tdl-value {
  font-size: 12.5px;
  color: var(--fs-text-primary);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.tdl-value--uid { font-size: 11px; color: var(--fs-text-muted); }
.tdl-lock-icon  { color: var(--fs-text-muted); opacity: 0.6; }

.spec-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  margin-bottom: 8px;
}
.spec-pre {
  margin: 0;
  padding: 12px;
  font-family: var(--fs-font-mono);
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--fs-text-primary);
  background: var(--fs-bg-elevated, var(--fs-bg-surface));
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  white-space: pre;
  overflow-x: auto;
  max-height: 55vh;
  overflow-y: auto;
}

.edit-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--fs-neg, #e57373);
}

/* ─── Security context ───────────────────────────────────────────────────────── */

.sec-ctx-details { margin-bottom: 12px; }
.sec-ctx-summary {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  cursor: pointer;
  user-select: none;
  list-style: none;
  padding: 4px 0;
}
.sec-ctx-summary::-webkit-details-marker { display: none; }
.sec-ctx-view-grid {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 4px 12px;
  padding: 8px 0 4px;
}
.sec-ctx-toggle-row {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  user-select: none;
  margin-bottom: 8px;
  padding: 4px 0;
}
.sec-ctx-toggle-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
}
.sec-ctx-toggle-hint { font-size: 10.5px; color: var(--fs-text-muted); opacity: 0.7; }
.sec-ctx-edit-grid {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 6px 12px;
  align-items: center;
  margin-bottom: 14px;
  padding: 8px 12px;
  background: var(--fs-bg-elevated, var(--fs-bg-surface));
  border: 1px solid var(--fs-border);
  border-radius: 4px;
}
.sec-ctx-key { font-size: 11.5px; font-family: var(--fs-font-mono); color: var(--fs-text-secondary); }
.sec-ctx-val { font-size: 12px; color: var(--fs-text-primary); }
.sec-ctx-input { width: 100%; font-size: 12px; padding: 4px 8px; }

.fs-btn--sm { padding: 5px 10px; font-size: 11.5px; }

.tpl-dialog .fs-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 4px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--fs-ease), filter var(--fs-ease), color var(--fs-ease);
}
.tpl-dialog .fs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tpl-dialog .fs-btn--primary  { background: var(--fs-accent); color: #fff; border-color: var(--fs-accent); }
.tpl-dialog .fs-btn--primary:hover:not(:disabled) { filter: brightness(1.1); }
.tpl-dialog .fs-btn--ghost    { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.tpl-dialog .fs-btn--ghost:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
</style>
