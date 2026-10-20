<script setup lang="ts">
import LogViewer from '@/components/LogViewer.vue'
import type { LogSnapshot } from '@/api/weaveMonitorApi'

defineProps<{
  title:        string
  fetchLogs:    (opts: { setup: boolean }) => Promise<LogSnapshot>
  setupToggle?: boolean
}>()

const open = defineModel<boolean>({ required: true })
</script>

<template>
  <q-dialog v-model="open">
    <q-card class="log-dialog">
      <LogViewer :title="title" :fetch-logs="fetchLogs" :setup-toggle="setupToggle" max-height="70vh">
        <template #actions>
          <q-btn flat round dense icon="mdi-close" @click="open = false" />
        </template>
      </LogViewer>
    </q-card>
  </q-dialog>
</template>

<style>
/* q-dialog renders outside component DOM — must be unscoped */
.log-dialog {
  width: 760px;
  max-width: 96vw;
  background: var(--fs-bg-surface);
  color: var(--fs-text-primary);
}
</style>
