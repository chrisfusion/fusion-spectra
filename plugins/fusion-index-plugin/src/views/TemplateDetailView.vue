<template>
  <q-page class="q-pa-lg">
    <div class="row items-center q-mb-lg q-gutter-sm">
      <q-btn flat round icon="arrow_back" @click="router.back()" />
      <div class="text-h5 text-weight-bold">{{ template?.name ?? '…' }}</div>
    </div>

    <q-banner v-if="error" rounded class="bg-negative text-white q-mb-md">
      {{ error }}
    </q-banner>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner size="40px" color="primary" />
    </div>

    <template v-else-if="template">
      <q-card flat bordered class="q-mb-lg">
        <q-card-section>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <div class="text-caption text-grey-6">Description</div>
              <div>{{ template.description || '—' }}</div>
            </div>
            <div class="col-12 col-md-6">
              <div class="text-caption text-grey-6">Docker Image</div>
              <div class="text-mono text-caption">{{ template.dockerImage }}</div>
            </div>
            <div class="col-6 col-md-3">
              <div class="text-caption text-grey-6">Latest Version</div>
              <q-badge color="primary" outline>v{{ template.latestVersionNumber }}</q-badge>
            </div>
            <div class="col-6 col-md-3">
              <div class="text-caption text-grey-6">Created</div>
              <div>{{ formatDate(template.createdAt) }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <div class="text-subtitle1 text-weight-medium q-mb-sm">Versions</div>
      <q-card flat bordered>
        <q-table
          :rows="versions"
          :columns="versionColumns"
          row-key="id"
          flat
          :pagination="{ rowsPerPage: 10 }"
        >
          <template #body-cell-versionNumber="props">
            <q-td :props="props">
              <q-badge color="primary" outline>v{{ props.value }}</q-badge>
            </q-td>
          </template>
          <template #body-cell-dockerImage="props">
            <q-td :props="props">
              <span class="text-mono text-caption">{{ props.value }}</span>
            </q-td>
          </template>
          <template #body-cell-createdAt="props">
            <q-td :props="props">{{ formatDate(props.value) }}</q-td>
          </template>
        </q-table>
      </q-card>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { QTableColumn } from 'quasar'
import { indexClient } from '@/api/indexClient'
import type { JobTemplate, JobTemplateVersion } from '@/types'
import { formatDate } from '@/utils/format'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const error = ref<string | null>(null)
const template = ref<JobTemplate | null>(null)
const versions = ref<JobTemplateVersion[]>([])

const versionColumns: QTableColumn[] = [
  { name: 'versionNumber', label: 'Version',      field: 'versionNumber', align: 'left' },
  { name: 'dockerImage',   label: 'Docker Image', field: 'dockerImage',   align: 'left' },
  { name: 'changelog',     label: 'Changelog',    field: 'changelog',     align: 'left' },
  { name: 'createdAt',     label: 'Created',      field: 'createdAt',     align: 'left' },
]

onMounted(async () => {
  const id = Number(route.params['id'])
  loading.value = true
  error.value = null
  try {
    const [t, v] = await Promise.all([
      indexClient.getTemplate(id),
      indexClient.listTemplateVersions(id),
    ])
    template.value = t
    versions.value = v
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})
</script>
