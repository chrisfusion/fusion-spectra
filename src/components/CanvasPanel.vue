<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title:   string
  icon:    string
  wide?:   boolean
  loading?: boolean
  error?:  string | null
}>()

const emit = defineEmits<{ refresh: [] }>()

const expanded = ref(false)
</script>

<template>
  <div class="panel" :class="{ 'panel--wide': wide, 'panel--expanded': expanded }">
    <div class="panel__header">
      <q-icon :name="icon" size="14px" class="panel__icon" />
      <span class="panel__title">{{ title }}</span>
      <div class="panel__actions">
        <slot name="actions" />
        <button class="panel__btn" @click="emit('refresh')">
          <q-icon name="mdi-refresh" size="14px" />
          <q-tooltip anchor="top middle" self="bottom middle" :offset="[0,4]">Refresh</q-tooltip>
        </button>
        <button class="panel__btn" @click="expanded = !expanded">
          <q-icon :name="expanded ? 'mdi-arrow-collapse' : 'mdi-arrow-expand'" size="14px" />
          <q-tooltip anchor="top middle" self="bottom middle" :offset="[0,4]">
            {{ expanded ? 'Collapse' : 'Expand' }}
          </q-tooltip>
        </button>
      </div>
    </div>
    <div class="panel__body">
      <div v-if="loading" class="panel__state">
        <q-spinner size="20px" color="primary" />
      </div>
      <div v-else-if="error" class="panel__state panel__state--error">
        <q-icon name="mdi-alert-circle-outline" size="18px" />
        <span>{{ error }}</span>
        <button class="panel__retry" @click="emit('refresh')">retry</button>
      </div>
      <slot v-else />
    </div>
  </div>
</template>

<style scoped>
.panel {
  background: var(--fs-bg-surface);
  border: 1px solid var(--fs-border);
  border-top: 2px solid var(--fs-border-bright);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: border-top-color var(--fs-ease), box-shadow var(--fs-ease);
}

.panel:hover {
  border-top-color: var(--fs-accent);
  box-shadow: 0 0 0 1px var(--fs-accent-soft), 0 4px 20px rgba(0,0,0,0.3);
}

.panel--wide { grid-column: span 2; }

.panel--expanded {
  position: fixed;
  inset: calc(var(--fs-topbar-h) + 12px) 12px 12px calc(var(--fs-rail-w) + 12px);
  z-index: 50;
  border-top-color: var(--fs-accent);
  box-shadow: 0 0 0 1px var(--fs-accent-soft), 0 16px 64px rgba(0,0,0,0.6);
}

/* Header */
.panel__header {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 8px 0 12px;
  border-bottom: 1px solid var(--fs-border);
  flex-shrink: 0;
}

.panel__icon  { color: var(--fs-accent); }
.panel__title { flex: 1; font-size: 12px; font-weight: 500; color: var(--fs-text-secondary); white-space: nowrap; }

.panel__actions { display: flex; align-items: center; gap: 2px; }

.panel__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: none;
  border: none;
  border-radius: 3px;
  color: var(--fs-text-muted);
  cursor: pointer;
  transition: background var(--fs-ease), color var(--fs-ease);
}
.panel__btn:hover { background: var(--fs-bg-hover); color: var(--fs-text-primary); }

/* Body */
.panel__body {
  flex: 1;
  overflow: auto;
  padding: 12px;
}

.panel__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 80px;
  color: var(--fs-text-muted);
  font-size: 12px;
}

.panel__state--error { color: var(--fs-red); }

.panel__retry {
  background: none;
  border: 1px solid var(--fs-red);
  border-radius: 3px;
  color: var(--fs-red);
  font-size: 11px;
  font-family: var(--fs-font-mono);
  padding: 2px 8px;
  cursor: pointer;
  transition: background var(--fs-ease);
}
.panel__retry:hover { background: rgba(239,68,68,0.1); }
</style>
