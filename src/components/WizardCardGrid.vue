<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { WIZARD_CARDS } from '@/data/wizardCards'
import { visible } from '@/data/navigation'
import { usePermission } from '@/composables/usePermission'
import { useUiModeStore } from '@/stores/uiMode'

const router  = useRouter()
const { can } = usePermission()
const uiMode  = useUiModeStore()

const cards = computed(() => WIZARD_CARDS.filter(c => visible(c, uiMode.expert)))
</script>

<template>
  <div v-if="can('wizard:runs:create')" class="wizard-grid">
    <button
      v-for="w in cards"
      :key="w.id"
      class="wizard-card"
      @click="router.push(w.route)"
    >
      <q-icon :name="w.icon" size="26px" class="wizard-card__icon" />
      <span class="wizard-card__title">{{ w.title }}</span>
      <span class="wizard-card__desc">{{ w.desc }}</span>
    </button>
  </div>
  <div v-else class="wizard-grid__empty">
    You don't have permission to start wizards. Ask an administrator for the <code>user</code> role.
  </div>
</template>

<style scoped>
.wizard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  padding: 4px 10px 10px;
}

.wizard-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px;
  text-align: left;
  border: 1px solid var(--fs-border);
  border-radius: 6px;
  background: var(--fs-bg-elevated);
  cursor: pointer;
  font-family: inherit;
  transition: border-color var(--fs-ease), background var(--fs-ease);
}
.wizard-card:hover { border-color: var(--fs-accent); background: var(--fs-bg-hover); }
.wizard-card__icon  { color: var(--fs-accent); }
.wizard-card__title { font-size: 13.5px; font-weight: 600; color: var(--fs-text-primary); }
.wizard-card__desc  { font-size: 11.5px; color: var(--fs-text-muted); line-height: 1.5; }

.wizard-grid__empty { padding: 16px 10px; font-size: 12.5px; color: var(--fs-text-muted); }
</style>
