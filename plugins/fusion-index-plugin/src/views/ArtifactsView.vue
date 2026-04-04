<template>
  <q-page class="q-pa-lg">
    <div class="text-h5 text-weight-bold q-mb-lg">Artifacts</div>

    <q-banner v-if="error" rounded class="bg-negative text-white q-mb-md">
      {{ error }}
    </q-banner>

    <q-card flat bordered>
      <q-table
        :rows="artifacts"
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
        <template #body-cell-sizeBytes="props">
          <q-td :props="props">{{ formatSize(props.value) }}</q-td>
        </template>

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
              v-if="props.row.status === 'AVAILABLE'"
              icon="download"
              flat
              round
              dense
              color="primary"
              :href="indexClient.artifactDownloadUrl(props.row.id)"
              target="_blank"
            />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- Detail dialog -->
    <q-dialog v-model="dialogOpen">
      <q-card style="min-width: 480px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ selected?.name }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section v-if="selected">
          <q-list dense>
            <q-item v-for="field in detailFields" :key="field.label">
              <q-item-section>
                <q-item-label caption>{{ field.label }}</q-item-label>
                <q-item-label>{{ field.value }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right" v-if="selected?.status === 'AVAILABLE'">
          <q-btn
            label="Download"
            icon="download"
            color="primary"
            flat
            :href="indexClient.artifactDownloadUrl(selected.id)"
            target="_blank"
            v-close-popup
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { QTableColumn, QTableProps } from 'quasar'
import { indexClient } from '@/api/indexClient'
import type { Artifact } from '@/types'
import { formatDate } from '@/utils/format'

const loading = ref(false)
const error = ref<string | null>(null)
const artifacts = ref<Artifact[]>([])
const pagination = ref({ page: 1, rowsPerPage: 20, rowsNumber: 0 })

const dialogOpen = ref(false)
const selected = ref<Artifact | null>(null)

const columns: QTableColumn[] = [
  { name: 'name',           label: 'Name',          field: 'name',           align: 'left', sortable: true },
  { name: 'contentType',    label: 'Content Type',  field: 'contentType',    align: 'left' },
  { name: 'sizeBytes',      label: 'Size',          field: 'sizeBytes',      align: 'left' },
  { name: 'status',         label: 'Status',        field: 'status',         align: 'left' },
  { name: 'storageBackend', label: 'Backend',       field: 'storageBackend', align: 'left' },
  { name: 'createdAt',      label: 'Created',       field: 'createdAt',      align: 'left', sortable: true },
  { name: 'actions',        label: '',              field: () => '',         align: 'center' },
]

function statusColor(status: Artifact['status']): string {
  if (status === 'AVAILABLE') return 'positive'
  if (status === 'PENDING')   return 'warning'
  return 'negative'
}

function statusIcon(status: Artifact['status']): string {
  if (status === 'AVAILABLE') return 'check_circle'
  if (status === 'PENDING')   return 'hourglass_empty'
  return 'error'
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const detailFields = computed(() => {
  if (!selected.value) return []
  const a = selected.value
  return [
    { label: 'ID',              value: String(a.id) },
    { label: 'Job Version ID',  value: String(a.jobVersionId) },
    { label: 'Name',            value: a.name },
    { label: 'Content Type',    value: a.contentType ?? '—' },
    { label: 'Size',            value: formatSize(a.sizeBytes) },
    { label: 'Storage Backend', value: a.storageBackend },
    { label: 'Status',          value: a.status },
    { label: 'Download URL',    value: a.downloadUrl },
    { label: 'Created',         value: formatDate(a.createdAt) },
    { label: 'Updated',         value: formatDate(a.updatedAt) },
  ]
})

function openDetail(_evt: Event, row: Artifact) {
  selected.value = row
  dialogOpen.value = true
}

async function load(page: number) {
  loading.value = true
  error.value = null
  try {
    const res = await indexClient.listArtifacts(page - 1, pagination.value.rowsPerPage)
    artifacts.value = res.items
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

onMounted(() => load(1))
</script>
