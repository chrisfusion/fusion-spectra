<script setup lang="ts">
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'

const router = useRouter()

interface WizardCard {
  id:    string
  title: string
  icon:  string
  desc:  string
  route: string
}

const wizards: WizardCard[] = [
  {
    id:    'git-python-job',
    title: 'Git → Python Job',
    icon:  'mdi-language-python',
    desc:  'Point at a git repo with several Python scripts — get a GitOps-built artifact, a run blueprint, and one trigger per entrypoint, wired up automatically.',
    route: '/wizards/git-python-job/create',
  },
]
</script>

<template>
  <div class="page-grid">
    <CanvasPanel title="Wizards" icon="mdi-creation" :wide="true">
      <div class="wizard-grid">
        <button
          v-for="w in wizards"
          :key="w.id"
          class="wizard-card"
          @click="router.push(w.route)"
        >
          <q-icon :name="w.icon" size="26px" class="wizard-card__icon" />
          <span class="wizard-card__title">{{ w.title }}</span>
          <span class="wizard-card__desc">{{ w.desc }}</span>
        </button>
      </div>
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
</style>
