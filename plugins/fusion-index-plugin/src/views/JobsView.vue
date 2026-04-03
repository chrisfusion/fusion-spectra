<template>
  <q-page class="q-pa-lg">
    <div class="text-h5 text-weight-bold q-mb-lg">Jobs</div>

    <q-banner v-if="error" rounded class="bg-negative text-white q-mb-md">
      {{ error }}
    </q-banner>

    <q-card flat bordered>
      <q-table
        :rows="jobs"
        :columns="columns"
        row-key="id"
        flat
        :loading="loading"
        :pagination="pagination"
        binary-state-sort
        @request="onRequest"
      >
        <template #body-cell-latestVersionNumber="props">
          <q-td :props="props">
            <q-badge color="secondary" outline>v{{ props.value }}</q-badge>
          </q-td>
        </template>
        <template #body-cell-createdAt="props">
          <q-td :props="props">{{ formatDate(props.value) }}</q-td>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { QTableColumn, QTableProps } from 'quasar'
import { indexClient } from '@/api/indexClient'
import type { Job } from '@/types'
import { formatDate } from '@/utils/format'

const loading = ref(false)
const error = ref<string | null>(null)
const jobs = ref<Job[]>([])
const pagination = ref({ page: 1, rowsPerPage: 20, rowsNumber: 0 })

const columns: QTableColumn[] = [
  { name: 'name',                label: 'Name',           field: 'name',                align: 'left', sortable: true },
  { name: 'description',         label: 'Description',    field: 'description',         align: 'left' },
  { name: 'latestVersionNumber', label: 'Latest Version', field: 'latestVersionNumber', align: 'left' },
  { name: 'createdAt',           label: 'Created',        field: 'createdAt',           align: 'left', sortable: true },
]

async function load(page: number) {
  loading.value = true
  error.value = null
  try {
    const res = await indexClient.listJobs(page - 1, pagination.value.rowsPerPage)
    jobs.value = res.items
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
