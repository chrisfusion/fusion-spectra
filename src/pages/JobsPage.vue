<template>
  <q-page class="q-pa-lg">
    <div class="row items-center justify-between q-mb-lg">
      <div class="text-h5 text-weight-bold">Jobs</div>
      <q-btn color="primary" icon="add" label="New Job" unelevated size="sm" disable />
    </div>

    <q-card flat bordered>
      <q-card-section class="q-pb-none">
        <q-input
          v-model="filter"
          dense
          outlined
          placeholder="Search jobs…"
          clearable
          style="max-width: 320px"
        >
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </q-card-section>

      <q-table
        :rows="filteredJobs"
        :columns="columns"
        row-key="id"
        flat
        :pagination="{ rowsPerPage: 10 }"
      >
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="statusColor(props.value)">{{ props.value }}</q-badge>
          </q-td>
        </template>
        <template #body-cell-duration="props">
          <q-td :props="props" class="text-right">
            <span class="text-mono text-caption">{{ props.value }}</span>
          </q-td>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { QTableColumn } from 'quasar'

const filter = ref('')

const columns: QTableColumn[] = [
  { name: 'name',     label: 'Name',     field: 'name',     align: 'left',  sortable: true },
  { name: 'version',  label: 'Version',  field: 'version',  align: 'left' },
  { name: 'status',   label: 'Status',   field: 'status',   align: 'left',  sortable: true },
  { name: 'created',  label: 'Created',  field: 'created',  align: 'left',  sortable: true },
  { name: 'duration', label: 'Duration', field: 'duration', align: 'right' },
]

const jobs = [
  { id: 1,  name: 'data-ingest-etl',     version: '1.2.0', status: 'SUCCESS',  created: '2024-01-15', duration: '42s' },
  { id: 2,  name: 'ml-feature-extract',  version: '0.4.1', status: 'BUILDING', created: '2024-01-15', duration: '--' },
  { id: 3,  name: 'transform-sales',     version: '3.0.0', status: 'SUCCESS',  created: '2024-01-14', duration: '1m 8s' },
  { id: 4,  name: 'report-generator',    version: '1.0.3', status: 'FAILED',   created: '2024-01-14', duration: '7s' },
  { id: 5,  name: 'data-validation',     version: '2.1.0', status: 'SUCCESS',  created: '2024-01-13', duration: '23s' },
  { id: 6,  name: 'lake-archiver',       version: '1.0.0', status: 'PENDING',  created: '2024-01-13', duration: '--' },
  { id: 7,  name: 'anomaly-detector',    version: '0.9.0', status: 'SUCCESS',  created: '2024-01-12', duration: '3m 12s' },
  { id: 8,  name: 'schema-migrator',     version: '1.1.0', status: 'SUCCESS',  created: '2024-01-11', duration: '55s' },
]

const filteredJobs = computed(() =>
  filter.value
    ? jobs.filter((j) => j.name.includes(filter.value.toLowerCase()))
    : jobs
)

function statusColor(status: string): string {
  const map: Record<string, string> = {
    SUCCESS: 'positive',
    BUILDING: 'warning',
    FAILED: 'negative',
    PENDING: 'info',
  }
  return map[status] ?? 'grey'
}
</script>
