<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useUiModeStore } from '@/stores/uiMode'

// /dashboard serves both modes: the full platform dashboard for experts, a
// wizard-first dashboard for everyone else.
const DashboardPage       = defineAsyncComponent(() => import('@/pages/DashboardPage.vue'))
const SimpleDashboardPage = defineAsyncComponent(() => import('@/pages/SimpleDashboardPage.vue'))

const uiMode = useUiModeStore()
</script>

<template>
  <component :is="uiMode.expert ? DashboardPage : SimpleDashboardPage" />
</template>
