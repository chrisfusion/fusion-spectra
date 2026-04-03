<template>
  <q-page class="q-pa-lg">
    <div class="row items-center justify-between q-mb-lg">
      <div class="text-h5 text-weight-bold">Virtual Environments</div>
      <q-btn color="primary" icon="add" label="Build Venv" unelevated size="sm" disable />
    </div>

    <q-card flat bordered>
      <q-card-section class="q-pb-none">
        <q-input
          v-model="filter"
          dense
          outlined
          placeholder="Search venvs…"
          clearable
          style="max-width: 320px"
        >
          <template #prepend><q-icon name="search" /></template>
        </q-input>
      </q-card-section>

      <q-table
        :rows="filteredVenvs"
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
        <template #body-cell-size="props">
          <q-td :props="props" class="text-right">
            <span class="text-caption text-mono">{{ props.value }}</span>
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
  { name: 'name',     label: 'Name',     field: 'name',     align: 'left', sortable: true },
  { name: 'version',  label: 'Version',  field: 'version',  align: 'left' },
  { name: 'packages', label: 'Packages', field: 'packages', align: 'right', sortable: true },
  { name: 'size',     label: 'Size',     field: 'size',     align: 'right', sortable: true },
  { name: 'status',   label: 'Status',   field: 'status',   align: 'left',  sortable: true },
  { name: 'created',  label: 'Created',  field: 'created',  align: 'left',  sortable: true },
]

const venvs = [
  { id: 1, name: 'pandas-env',     version: '1.0.0', packages: 3,  size: '45 MB',  status: 'READY',    created: '2024-01-14' },
  { id: 2, name: 'ml-stack',       version: '2.0.0', packages: 8,  size: '124 MB', status: 'READY',    created: '2024-01-13' },
  { id: 3, name: 'etl-deps',       version: '1.1.0', packages: 5,  size: '67 MB',  status: 'READY',    created: '2024-01-12' },
  { id: 4, name: 'viz-toolkit',    version: '0.3.0', packages: 6,  size: '89 MB',  status: 'BUILDING', created: '2024-01-15' },
  { id: 5, name: 'spark-env',      version: '1.0.0', packages: 12, size: '210 MB', status: 'READY',    created: '2024-01-10' },
  { id: 6, name: 'nlp-base',       version: '0.1.0', packages: 4,  size: '52 MB',  status: 'FAILED',   created: '2024-01-09' },
  { id: 7, name: 'data-quality',   version: '1.2.0', packages: 3,  size: '38 MB',  status: 'READY',    created: '2024-01-08' },
]

const filteredVenvs = computed(() =>
  filter.value
    ? venvs.filter((v) => v.name.includes(filter.value.toLowerCase()))
    : venvs
)

function statusColor(status: string): string {
  const map: Record<string, string> = {
    READY:    'positive',
    BUILDING: 'warning',
    FAILED:   'negative',
    PENDING:  'info',
  }
  return map[status] ?? 'grey'
}
</script>
