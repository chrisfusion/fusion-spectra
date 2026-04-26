<script setup lang="ts">
import type { Context, ContextId } from '@/data/navigation'
import { usePermission } from '@/composables/usePermission'

const props = defineProps<{
  contexts: Context[]
  activeId: ContextId
  sidebarOpen: boolean
}>()

const emit = defineEmits<{
  select: [id: ContextId]
}>()

const { isAdmin } = usePermission()

const regularContexts = props.contexts.filter(c => !c.adminOnly)
const adminContexts   = props.contexts.filter(c =>  c.adminOnly)
</script>

<template>
  <nav class="rail">
    <div class="rail__top">
      <button
        v-for="ctx in regularContexts"
        :key="ctx.id"
        class="rail__btn"
        :class="{
          'rail__btn--active': ctx.id === activeId,
          'rail__btn--active-open': ctx.id === activeId && sidebarOpen
        }"
        @click="emit('select', ctx.id)"
      >
        <q-icon :name="ctx.icon" size="18px" />
        <q-tooltip anchor="center right" self="center left" :offset="[10, 0]" class="rail__tooltip">
          {{ ctx.label }}
        </q-tooltip>
      </button>
    </div>

    <div class="rail__sep" />

    <div v-if="isAdmin && adminContexts.length" class="rail__bottom">
      <button
        v-for="ctx in adminContexts"
        :key="ctx.id"
        class="rail__btn rail__btn--admin"
        :class="{
          'rail__btn--active': ctx.id === activeId,
          'rail__btn--active-open': ctx.id === activeId && sidebarOpen
        }"
        @click="emit('select', ctx.id)"
      >
        <q-icon :name="ctx.icon" size="18px" />
        <q-tooltip anchor="center right" self="center left" :offset="[10, 0]" class="rail__tooltip">
          {{ ctx.label }}
        </q-tooltip>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.rail {
  width: var(--fs-rail-w);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--fs-bg-deep);
  border-right: 1px solid var(--fs-border);
  padding: 8px 0;
  overflow: hidden;
}

.rail__top    { display: flex; flex-direction: column; gap: 2px; }
.rail__bottom { display: flex; flex-direction: column; gap: 2px; }

.rail__sep {
  flex: 1;
}

.rail__btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--fs-rail-w);
  height: var(--fs-rail-w);
  background: none;
  border: none;
  border-left: 2px solid transparent;
  color: var(--fs-text-muted);
  cursor: pointer;
  transition: color var(--fs-ease), background var(--fs-ease), border-color var(--fs-ease);
}

.rail__btn:hover {
  color: var(--fs-text-secondary);
  background: var(--fs-bg-hover);
}

.rail__btn--active {
  color: var(--fs-accent);
  border-left-color: var(--fs-accent);
  background: var(--fs-accent-soft);
}

.rail__btn--active:hover {
  color: var(--fs-accent);
}

/* Dim the active icon when sidebar is closed (context selected but panel hidden) */
.rail__btn--active:not(.rail__btn--active-open) {
  color: var(--fs-accent);
  opacity: 0.7;
  border-left-color: var(--fs-accent);
  background: transparent;
}

.rail__btn--admin { color: var(--fs-text-muted); }
.rail__btn--admin:hover { color: var(--fs-amber); }
.rail__btn--admin.rail__btn--active { color: var(--fs-amber); border-left-color: var(--fs-amber); background: rgba(245, 158, 11, 0.08); }

/* Tooltip override */
:deep(.rail__tooltip) {
  font-family: var(--fs-font-ui) !important;
  font-size: 12px !important;
  background: var(--fs-bg-elevated) !important;
  color: var(--fs-text-primary) !important;
  border: 1px solid var(--fs-border-bright) !important;
  border-radius: 3px !important;
  padding: 4px 8px !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
}
</style>
