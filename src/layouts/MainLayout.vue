<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { contexts, type ContextId } from '@/data/navigation'
import AppTopBar from '@/components/AppTopBar.vue'
import ActivityRail from '@/components/ActivityRail.vue'
import AppSidebar from '@/components/AppSidebar.vue'

const route  = useRoute()
const router = useRouter()

const activeContextId = ref<ContextId>('data')
const sidebarOpen     = ref(true)

const activeContext = computed(() => contexts.find(c => c.id === activeContextId.value)!)

// Sync context from route meta
watch(() => route.meta.context, (ctx) => {
  if (ctx) activeContextId.value = ctx as ContextId
}, { immediate: true })

function onContextSelect(id: ContextId) {
  if (id === activeContextId.value) {
    sidebarOpen.value = !sidebarOpen.value
  } else {
    activeContextId.value = id
    sidebarOpen.value     = true
    const ctx = contexts.find(c => c.id === id)
    if (ctx) router.push(ctx.rootPath)
  }
}
</script>

<template>
  <div class="fs-shell">
    <AppTopBar class="fs-shell__topbar" />

    <div class="fs-shell__body">
      <ActivityRail
        :contexts="contexts"
        :active-id="activeContextId"
        :sidebar-open="sidebarOpen"
        @select="onContextSelect"
      />

      <AppSidebar
        :context="activeContext"
        :open="sidebarOpen"
        @close="sidebarOpen = false"
      />

      <main class="fs-shell__canvas fs-canvas-bg">
        <router-view v-slot="{ Component }">
          <transition name="fs-fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.fs-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--fs-bg-deep);
}

.fs-shell__topbar {
  height: var(--fs-topbar-h);
  flex-shrink: 0;
  z-index: 100;
}

.fs-shell__body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.fs-shell__canvas {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}
</style>
