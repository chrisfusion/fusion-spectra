<script setup lang="ts">
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import WizardCardGrid from '@/components/WizardCardGrid.vue'

const router = useRouter()
</script>

<template>
  <div class="page-grid">
    <CanvasPanel title="Wizards" icon="mdi-creation" :wide="true">
      <template #actions>
        <button class="fs-btn fs-btn--ghost" @click="router.push('/wizards/runs')">
          <q-icon name="mdi-history" size="14px" /> View Runs
        </button>
      </template>
      <WizardCardGrid />
    </CanvasPanel>
  </div>
</template>

<style scoped>
.page-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 16px;
  align-content: start;
}

.fs-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px;
  border-radius: 4px; font-size: 12.5px; font-family: inherit; font-weight: 500;
  cursor: pointer; border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease);
}
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.fs-btn--ghost:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
</style>
