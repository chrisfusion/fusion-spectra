<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Context } from '@/data/navigation'

const props = defineProps<{
  context: Context
  open: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const route = useRoute()

// Track expanded groups per context
const expandedGroups = ref<Set<string>>(new Set())

// Auto-expand group that contains the active route
watch(() => [props.context, route.path] as const, ([ctx, path]) => {
  expandedGroups.value = new Set()
  for (const group of ctx.groups) {
    if (group.children.some(leaf => path.startsWith(leaf.route))) {
      expandedGroups.value.add(group.id)
    }
  }
  // Expand first group by default if none active
  if (expandedGroups.value.size === 0 && ctx.groups.length > 0) {
    expandedGroups.value.add(ctx.groups[0].id)
  }
}, { immediate: true })

function toggleGroup(id: string) {
  if (expandedGroups.value.has(id)) {
    expandedGroups.value.delete(id)
  } else {
    expandedGroups.value.add(id)
  }
}

function isLeafActive(route_: string): boolean {
  return route.path === route_ || route.path.startsWith(route_ + '/')
}
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--open': open }">
    <!-- Header -->
    <div class="sidebar__header">
      <q-icon :name="context.icon" size="14px" class="sidebar__ctx-icon" />
      <span class="sidebar__ctx-label">{{ context.label }}</span>
      <button class="sidebar__close" @click="emit('close')">
        <q-icon name="mdi-chevron-left" size="16px" />
      </button>
    </div>

    <!-- Spectrum accent line -->
    <div class="sidebar__accent-line fs-gradient-bar" />

    <!-- Tree navigation -->
    <div class="sidebar__tree">
      <div
        v-for="group in context.groups"
        :key="group.id"
        class="sidebar__group"
      >
        <!-- Group header -->
        <button
          class="sidebar__group-hdr"
          @click="toggleGroup(group.id)"
        >
          <q-icon
            name="mdi-chevron-right"
            size="13px"
            class="sidebar__chevron"
            :class="{ 'sidebar__chevron--open': expandedGroups.has(group.id) }"
          />
          <q-icon :name="group.icon" size="14px" class="sidebar__group-icon" />
          <span class="sidebar__group-label">{{ group.label }}</span>
        </button>

        <!-- Group children -->
        <transition name="sidebar-expand">
          <div v-if="expandedGroups.has(group.id)" class="sidebar__leaves">
            <router-link
              v-for="leaf in group.children"
              :key="leaf.id"
              :to="leaf.route"
              class="sidebar__leaf"
              :class="{ 'sidebar__leaf--active': isLeafActive(leaf.route), 'sidebar__leaf--placeholder': leaf.placeholder }"
            >
              <q-icon :name="leaf.icon" size="13px" class="sidebar__leaf-icon" />
              <span class="sidebar__leaf-label">{{ leaf.label }}</span>
              <q-icon
                v-if="leaf.placeholder"
                name="mdi-dots-horizontal-circle-outline"
                size="11px"
                class="sidebar__leaf-placeholder"
              />
              <span
                v-if="leaf.badge"
                class="fs-badge"
                :class="`fs-badge--${leaf.badge.variant}`"
              >{{ leaf.badge.text }}</span>
            </router-link>
          </div>
        </transition>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 0;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--fs-bg-surface);
  border-right: 1px solid var(--fs-border);
  display: flex;
  flex-direction: column;
  transition: width var(--fs-ease-slow);
}

.sidebar--open {
  width: var(--fs-sidebar-w);
}

/* Header */
.sidebar__header {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 6px 0 12px;
  flex-shrink: 0;
  min-width: var(--fs-sidebar-w);
}

.sidebar__ctx-icon  { color: var(--fs-accent); flex-shrink: 0; }
.sidebar__ctx-label {
  flex: 1;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-secondary);
  white-space: nowrap;
}

.sidebar__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  border-radius: 3px;
  color: var(--fs-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--fs-ease), color var(--fs-ease);
}
.sidebar__close:hover { background: var(--fs-bg-hover); color: var(--fs-text-primary); }

/* Accent line */
.sidebar__accent-line {
  height: 1px;
  flex-shrink: 0;
  min-width: var(--fs-sidebar-w);
}

/* Tree */
.sidebar__tree {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 0 16px;
  min-width: var(--fs-sidebar-w);
}

/* Group */
.sidebar__group { margin-bottom: 2px; }

.sidebar__group-hdr {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  height: 28px;
  padding: 0 10px;
  background: none;
  border: none;
  color: var(--fs-text-secondary);
  font-family: var(--fs-font-ui);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background var(--fs-ease), color var(--fs-ease);
  white-space: nowrap;
}

.sidebar__group-hdr:hover {
  background: var(--fs-bg-hover);
  color: var(--fs-text-primary);
}

.sidebar__chevron {
  color: var(--fs-text-muted);
  transition: transform var(--fs-ease);
  flex-shrink: 0;
}
.sidebar__chevron--open { transform: rotate(90deg); }

.sidebar__group-icon { color: var(--fs-text-muted); flex-shrink: 0; }

.sidebar__group-label { flex: 1; }

/* Leaves */
.sidebar__leaves {
  padding: 1px 0 3px;
  overflow: hidden;
}

.sidebar__leaf {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 27px;
  padding: 0 10px 0 28px;
  border-left: 2px solid transparent;
  color: var(--fs-text-muted);
  font-size: 12px;
  text-decoration: none;
  transition: background var(--fs-ease), color var(--fs-ease), border-color var(--fs-ease);
  white-space: nowrap;
}

.sidebar__leaf:hover {
  background: var(--fs-bg-hover);
  color: var(--fs-text-secondary);
}

.sidebar__leaf--active {
  border-left-color: var(--fs-accent);
  background: var(--fs-bg-active);
  color: var(--fs-text-primary);
}

.sidebar__leaf--active .sidebar__leaf-icon { color: var(--fs-accent); }

.sidebar__leaf-icon        { flex-shrink: 0; color: inherit; }
.sidebar__leaf-label       { flex: 1; }
.sidebar__leaf-placeholder { flex-shrink: 0; color: var(--fs-warn); opacity: 0.55; }
.sidebar__leaf--placeholder { opacity: 0.7; }

/* Expand animation */
.sidebar-expand-enter-active { animation: expand-down 0.18s ease; }
.sidebar-expand-leave-active { animation: expand-down 0.18s ease reverse; }

@keyframes expand-down {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
