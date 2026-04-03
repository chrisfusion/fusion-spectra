<template>
  <q-page class="q-pa-lg">
    <div class="text-h5 text-weight-bold q-mb-lg">Dashboard</div>

    <!-- Stat cards -->
    <div class="row q-col-gutter-md q-mb-xl">
      <div v-for="stat in stats" :key="stat.label" class="col-6 col-sm-3">
        <q-card flat bordered>
          <q-card-section class="column items-start">
            <q-icon :name="stat.icon" :color="stat.color" size="28px" class="q-mb-sm" />
            <div class="text-h4 text-weight-bold">{{ stat.value }}</div>
            <div class="text-caption text-grey-6">{{ stat.label }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Recent activity -->
    <div class="text-subtitle1 text-weight-medium q-mb-sm">Recent Activity</div>
    <q-card flat bordered>
      <q-table
        :rows="recentActivity"
        :columns="columns"
        row-key="id"
        flat
        :pagination="{ rowsPerPage: 8 }"
        hide-bottom
      >
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="statusColor(props.value)">{{ props.value }}</q-badge>
          </q-td>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import type { QTableColumn } from 'quasar'

const stats = [
  { label: 'Total Jobs',     value: 42,   icon: 'work_outline',   color: 'primary' },
  { label: 'Venvs Built',    value: 18,   icon: 'inventory_2',    color: 'secondary' },
  { label: 'Active Builds',  value: 3,    icon: 'pending',        color: 'warning' },
  { label: 'Success Rate',   value: '94%',icon: 'check_circle',   color: 'positive' },
]

const columns: QTableColumn[] = [
  { name: 'name',    label: 'Name',    field: 'name',    align: 'left',  sortable: true },
  { name: 'type',    label: 'Type',    field: 'type',    align: 'left' },
  { name: 'status',  label: 'Status',  field: 'status',  align: 'left',  sortable: true },
  { name: 'user',    label: 'User',    field: 'user',    align: 'left' },
  { name: 'elapsed', label: 'Time',    field: 'elapsed', align: 'right' },
]

const recentActivity = [
  { id: 1, name: 'data-ingest-etl',     type: 'Build',  status: 'SUCCESS',  user: 'alice', elapsed: '2h ago' },
  { id: 2, name: 'ml-feature-extract',  type: 'Build',  status: 'BUILDING', user: 'bob',   elapsed: '30m ago' },
  { id: 3, name: 'transform-sales',     type: 'Build',  status: 'SUCCESS',  user: 'alice', elapsed: '3h ago' },
  { id: 4, name: 'pandas-env',          type: 'Venv',   status: 'SUCCESS',  user: 'carol', elapsed: '5h ago' },
  { id: 5, name: 'report-generator',    type: 'Build',  status: 'FAILED',   user: 'bob',   elapsed: '6h ago' },
  { id: 6, name: 'etl-deps',            type: 'Venv',   status: 'SUCCESS',  user: 'alice', elapsed: '1d ago' },
]

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
