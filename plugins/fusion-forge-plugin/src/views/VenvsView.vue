<template>
  <q-page class="q-pa-lg">
    <div class="row items-center q-mb-lg">
      <div class="text-h5 text-weight-bold">Forge Venvs</div>
      <q-space />
      <q-btn label="New Venv" icon="add" color="primary" unelevated @click="openCreate()" />
    </div>

    <q-banner v-if="error" rounded class="bg-negative text-white q-mb-md">
      {{ error }}
    </q-banner>

    <!-- Tabs: All / Running -->
    <q-tabs v-model="activeTab" align="left" class="q-mb-md" dense>
      <q-tab name="all"     label="All" />
      <q-tab name="running" label="Running" />
    </q-tabs>

    <q-card flat bordered>
      <q-table
        :rows="builds"
        :columns="columns"
        row-key="id"
        flat
        :loading="loading"
        :pagination="pagination"
        binary-state-sort
        style="cursor: pointer"
        @request="onRequest"
        @row-click="openDetail"
      >
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="statusColor(props.value)" outline>
              <q-icon :name="statusIcon(props.value)" size="xs" class="q-mr-xs" />
              {{ props.value }}
            </q-badge>
          </q-td>
        </template>

        <template #body-cell-createdAt="props">
          <q-td :props="props">{{ formatDate(props.value) }}</q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" @click.stop>
            <q-btn
              icon="add_circle_outline"
              flat round dense
              color="primary"
              title="New version"
              @click="openCreate(props.row.name)"
            />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- ── Detail dialog ───────────────────────────────────────────────── -->
    <q-dialog v-model="detailOpen" maximized>
      <q-card v-if="selected" style="min-width: 560px; max-width: 800px; margin: auto">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ selected.name }} <span class="text-grey-6">v{{ selected.version }}</span></div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <q-list dense>
            <q-item v-for="field in detailFields" :key="field.label">
              <q-item-section>
                <q-item-label caption>{{ field.label }}</q-item-label>
                <q-item-label>
                  <q-badge v-if="field.badge" :color="statusColor(selected.status)" outline>
                    <q-icon :name="statusIcon(selected.status)" size="xs" class="q-mr-xs" />
                    {{ field.value }}
                  </q-badge>
                  <span v-else>{{ field.value }}</span>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-section>
          <div class="row items-center q-mb-sm">
            <div class="text-subtitle2">Build Logs</div>
            <q-space />
            <q-btn
              v-if="selected.status === 'BUILDING'"
              icon="refresh"
              flat round dense size="sm"
              :loading="logsLoading"
              title="Refresh logs"
              @click="loadLogs(selected!.id)"
            />
          </div>
          <q-banner v-if="logsError" rounded class="bg-warning text-white q-mb-sm" dense>
            {{ logsError }}
          </q-banner>
          <pre
            v-if="logs !== null"
            class="log-pre q-pa-sm rounded-borders bg-dark text-white"
            style="max-height: 320px; overflow-y: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all"
          >{{ logs || '(no output yet)' }}</pre>
          <div v-else class="text-grey-6 text-caption">No pod found — build may not have started yet.</div>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- ── Create / New-version dialog ────────────────────────────────── -->
    <q-dialog v-model="createOpen" persistent>
      <q-card style="min-width: 520px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ createForm.name ? 'New Version' : 'New Venv' }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-gutter-sm">
          <q-input
            v-model="createForm.name"
            label="Name *"
            outlined dense
            :rules="[v => /^[a-zA-Z0-9_-]+$/.test(v) || 'Only letters, numbers, _ and - allowed']"
            hint="Alphanumeric, underscore, hyphen"
          />
          <q-input
            v-model="createForm.version"
            label="Version *"
            outlined dense
            :rules="[v => /^[a-zA-Z0-9._-]+$/.test(v) || 'Only letters, numbers, ., _ and - allowed']"
            hint="e.g. 1.0.0"
          />
          <q-input
            v-model="createForm.description"
            label="Description"
            outlined dense
            type="textarea"
            autogrow
          />

          <!-- Requirements input: file or text -->
          <div class="text-caption text-grey-7 q-mt-sm">Requirements *</div>
          <q-tabs v-model="reqTab" align="left" dense class="q-mb-xs">
            <q-tab name="file" label="Upload file" />
            <q-tab name="text" label="Paste text" />
          </q-tabs>

          <q-tab-panels v-model="reqTab" animated>
            <q-tab-panel name="file" class="q-pa-none">
              <q-file
                v-model="reqFile"
                label="requirements.txt"
                outlined dense
                accept=".txt,text/plain"
                :rules="[v => !!v || 'File is required']"
              >
                <template #prepend><q-icon name="attach_file" /></template>
              </q-file>
            </q-tab-panel>

            <q-tab-panel name="text" class="q-pa-none">
              <q-input
                v-model="reqText"
                label="Paste requirements"
                outlined dense
                type="textarea"
                :input-style="{ fontFamily: 'monospace', fontSize: '12px', minHeight: '120px' }"
                :rules="[v => !!v.trim() || 'Requirements must not be empty']"
              />
            </q-tab-panel>
          </q-tab-panels>

          <!-- Validate button + violation list -->
          <div class="row items-center q-mt-sm q-gutter-sm">
            <q-btn
              label="Validate"
              icon="check_circle_outline"
              outline
              color="secondary"
              size="sm"
              :loading="validating"
              :disable="!canValidate"
              @click="runValidate"
            />
            <span v-if="violations.length === 0 && validated" class="text-positive text-caption">
              <q-icon name="check" /> Valid
            </span>
          </div>

          <q-list v-if="violations.length > 0" dense bordered class="rounded-borders q-mt-sm">
            <q-item-label header class="text-negative text-caption">Validation errors</q-item-label>
            <q-item v-for="v in violations" :key="v.line" dense>
              <q-item-section>
                <q-item-label class="text-caption">
                  <span class="text-weight-bold">Line {{ v.line }}:</span>
                  <code class="q-ml-xs">{{ v.content }}</code>
                </q-item-label>
                <q-item-label caption class="text-negative">{{ v.message }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <q-banner v-if="createError" rounded class="bg-negative text-white q-mt-sm" dense>
            {{ createError }}
          </q-banner>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn label="Cancel" flat v-close-popup />
          <q-btn
            label="Submit"
            color="primary"
            unelevated
            :loading="submitting"
            :disable="!canSubmit"
            @click="submitCreate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { QTableColumn, QTableProps } from 'quasar'
import { forgeClient } from '@/api/forgeClient'
import type { VenvBuild, BuildStatus, ValidationViolation } from '@/types'
import { formatDate } from '@/utils/format'

// ── List state ──────────────────────────────────────────────────────────────
const loading  = ref(false)
const error    = ref<string | null>(null)
const builds   = ref<VenvBuild[]>([])
const pagination = ref({ page: 1, rowsPerPage: 20, rowsNumber: 0 })
const activeTab = ref<'all' | 'running'>('all')

const columns: QTableColumn[] = [
  { name: 'name',    label: 'Name',    field: 'name',    align: 'left', sortable: true },
  { name: 'version', label: 'Version', field: 'version', align: 'left' },
  { name: 'status',  label: 'Status',  field: 'status',  align: 'left' },
  { name: 'creatorEmail', label: 'Creator', field: 'creatorEmail', align: 'left' },
  { name: 'createdAt', label: 'Created', field: 'createdAt', align: 'left', sortable: true },
  { name: 'actions', label: '', field: () => '', align: 'center' },
]

function statusColor(status: BuildStatus): string {
  if (status === 'SUCCESS')  return 'positive'
  if (status === 'BUILDING') return 'info'
  if (status === 'PENDING')  return 'warning'
  return 'negative'
}

function statusIcon(status: BuildStatus): string {
  if (status === 'SUCCESS')  return 'check_circle'
  if (status === 'BUILDING') return 'sync'
  if (status === 'PENDING')  return 'hourglass_empty'
  return 'error'
}

async function load(page: number) {
  loading.value = true
  error.value = null
  try {
    const statusFilter = activeTab.value === 'running' ? 'BUILDING' : undefined
    const res = await forgeClient.list(page - 1, pagination.value.rowsPerPage, statusFilter)
    builds.value = res.items
    pagination.value = { ...pagination.value, page, rowsNumber: Number(res.total) }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function onRequest(props: Parameters<NonNullable<QTableProps['onRequest']>>[0]) {
  load(props.pagination.page ?? 1)
}

watch(activeTab, () => load(1))
onMounted(() => load(1))

// ── Detail dialog ────────────────────────────────────────────────────────────
const detailOpen   = ref(false)
const selected     = ref<VenvBuild | null>(null)
const logs         = ref<string | null>(null)
const logsLoading  = ref(false)
const logsError    = ref<string | null>(null)

const detailFields = computed(() => {
  if (!selected.value) return []
  const b = selected.value
  return [
    { label: 'ID',              value: String(b.id),                    badge: false },
    { label: 'Name',            value: b.name,                          badge: false },
    { label: 'Version',         value: b.version,                       badge: false },
    { label: 'Description',     value: b.description ?? '—',            badge: false },
    { label: 'Status',          value: b.status,                        badge: true  },
    { label: 'Creator',         value: b.creatorEmail,                  badge: false },
    { label: 'K8s Job',         value: b.k8sJobName ?? '—',             badge: false },
    { label: 'Index Job ID',    value: b.indexBackendJobId != null ? String(b.indexBackendJobId) : '—', badge: false },
    { label: 'Created',         value: formatDate(b.createdAt),         badge: false },
    { label: 'Updated',         value: formatDate(b.updatedAt),         badge: false },
  ]
})

async function loadLogs(id: number) {
  logsLoading.value = true
  logsError.value = null
  try {
    logs.value = await forgeClient.getLogs(id)
  } catch (e) {
    logsError.value = e instanceof Error ? e.message : String(e)
  } finally {
    logsLoading.value = false
  }
}

function openDetail(_evt: Event, row: VenvBuild) {
  selected.value = row
  logs.value = null
  detailOpen.value = true
  void loadLogs(row.id)
}

// ── Create dialog ────────────────────────────────────────────────────────────
const createOpen  = ref(false)
const submitting  = ref(false)
const validating  = ref(false)
const validated   = ref(false)
const violations  = ref<ValidationViolation[]>([])
const createError = ref<string | null>(null)
const reqTab      = ref<'file' | 'text'>('file')
const reqFile     = ref<File | null>(null)
const reqText     = ref('')

const createForm = ref({ name: '', version: '', description: '' })

const canValidate = computed(() => {
  if (!createForm.value.name || !createForm.value.version) return false
  return reqTab.value === 'file' ? !!reqFile.value : !!reqText.value.trim()
})

const canSubmit = computed(() =>
  !submitting.value && validated.value && violations.value.length === 0
)

function buildFormData(): FormData {
  const fd = new FormData()
  fd.append('name', createForm.value.name)
  fd.append('version', createForm.value.version)
  if (createForm.value.description) fd.append('description', createForm.value.description)
  if (reqTab.value === 'file' && reqFile.value) {
    fd.append('requirements', reqFile.value, 'requirements.txt')
  } else {
    const blob = new Blob([reqText.value], { type: 'text/plain' })
    fd.append('requirements', blob, 'requirements.txt')
  }
  return fd
}

async function runValidate() {
  validating.value = true
  validated.value = false
  violations.value = []
  createError.value = null
  try {
    const result = await forgeClient.validate(buildFormData())
    violations.value = result.violations
    validated.value = result.valid
  } catch (e) {
    createError.value = e instanceof Error ? e.message : String(e)
  } finally {
    validating.value = false
  }
}

async function submitCreate() {
  submitting.value = true
  createError.value = null
  try {
    await forgeClient.create(buildFormData())
    createOpen.value = false
    resetCreate()
    await load(1)
  } catch (e) {
    createError.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}

function openCreate(prefillName = '') {
  resetCreate()
  createForm.value.name = prefillName
  createOpen.value = true
}

function resetCreate() {
  createForm.value = { name: '', version: '', description: '' }
  reqFile.value = null
  reqText.value = ''
  reqTab.value = 'file'
  violations.value = []
  validated.value = false
  createError.value = null
}
</script>
