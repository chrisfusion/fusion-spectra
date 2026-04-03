<template>
  <q-page class="q-pa-lg">
    <div class="text-h5 text-weight-bold q-mb-lg">Platform Overview</div>

    <!-- Service health -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div v-for="svc in services" :key="svc.name" class="col-12 col-sm-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="row items-center justify-between no-wrap">
              <div>
                <div class="text-subtitle1 text-weight-medium">{{ svc.name }}</div>
                <div class="text-caption text-grey-6">{{ svc.description }}</div>
              </div>
              <q-icon :name="svc.icon" size="32px" color="grey-5" />
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section class="row items-center q-gutter-sm">
            <q-badge :color="svc.statusColor" class="text-caption">{{ svc.status }}</q-badge>
            <span class="text-caption text-grey-6">{{ svc.meta }}</span>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="text-subtitle1 text-weight-medium q-mb-sm">Quick Actions</div>
    <div class="row q-col-gutter-sm">
      <div v-for="action in quickActions" :key="action.label" class="col-auto">
        <q-btn
          outline
          color="primary"
          :icon="action.icon"
          :label="action.label"
          :to="action.to"
          size="sm"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
const services = [
  {
    name: 'fusion-index',
    description: 'Job & artefact registry',
    icon: 'storage',
    status: 'Healthy',
    statusColor: 'positive',
    meta: '42 jobs · 18 versions',
  },
  {
    name: 'fusion-forge',
    description: 'Venv build service',
    icon: 'build',
    status: 'Healthy',
    statusColor: 'positive',
    meta: '3 active builds',
  },
  {
    name: 'fusion-spectra',
    description: 'Platform UI',
    icon: 'web',
    status: 'Running',
    statusColor: 'info',
    meta: 'v0.1.0',
  },
]

const quickActions = [
  { label: 'View Jobs',      icon: 'work_outline',  to: '/jobs' },
  { label: 'Build Venv',     icon: 'inventory_2',   to: '/venvs' },
  { label: 'Dashboard',      icon: 'analytics',     to: '/dashboard' },
  { label: 'Documentation',  icon: 'help_outline',  to: '/help' },
]
</script>
