<template>
  <q-page class="q-pa-lg">
    <div class="text-h5 text-weight-bold q-mb-lg">Administration</div>

    <!-- Users -->
    <div class="text-subtitle1 text-weight-medium q-mb-sm">Users</div>
    <q-card flat bordered class="q-mb-lg">
      <q-table
        :rows="users"
        :columns="userColumns"
        row-key="id"
        flat
        hide-bottom
        :pagination="{ rowsPerPage: 10 }"
      >
        <template #body-cell-role="props">
          <q-td :props="props">
            <q-badge :color="props.value === 'Admin' ? 'primary' : 'grey-6'">
              {{ props.value }}
            </q-badge>
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- System config -->
    <div class="text-subtitle1 text-weight-medium q-mb-sm">System Configuration</div>
    <q-card flat bordered>
      <q-list separator>
        <q-item v-for="cfg in systemConfig" :key="cfg.key">
          <q-item-section>
            <q-item-label class="text-caption text-grey-6">{{ cfg.key }}</q-item-label>
            <q-item-label class="text-mono">{{ cfg.value }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import type { QTableColumn } from 'quasar'

const userColumns: QTableColumn[] = [
  { name: 'name',       label: 'Name',        field: 'name',       align: 'left', sortable: true },
  { name: 'email',      label: 'Email',       field: 'email',      align: 'left' },
  { name: 'role',       label: 'Role',        field: 'role',       align: 'left' },
  { name: 'lastActive', label: 'Last Active', field: 'lastActive', align: 'left', sortable: true },
]

const users = [
  { id: 1, name: 'Alice Dev',  email: 'alice@fusion.local', role: 'Admin', lastActive: '2024-01-15' },
  { id: 2, name: 'Bob User',   email: 'bob@fusion.local',   role: 'User',  lastActive: '2024-01-14' },
  { id: 3, name: 'Carol Ops',  email: 'carol@fusion.local', role: 'Admin', lastActive: '2024-01-15' },
  { id: 4, name: 'Dave Eng',   email: 'dave@fusion.local',  role: 'User',  lastActive: '2024-01-13' },
]

const systemConfig = [
  { key: 'OIDC Authority',   value: import.meta.env.VITE_OIDC_AUTHORITY || '(not configured)' },
  { key: 'OIDC Client ID',   value: import.meta.env.VITE_OIDC_CLIENT_ID || '(not configured)' },
  { key: 'Auth Mode',        value: import.meta.env.VITE_AUTH_MODE || 'oidc' },
  { key: 'UI Version',       value: '0.1.0' },
]
</script>
