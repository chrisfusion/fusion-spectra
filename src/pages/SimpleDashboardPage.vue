<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import WizardCardGrid from '@/components/WizardCardGrid.vue'
import WizardPhaseBadge from '@/components/WizardPhaseBadge.vue'
import * as wizardApi from '@/api/wizardApi'
import { WIZARD_CARDS } from '@/data/wizardCards'
import { useRunsPolling } from '@/composables/useRunsPolling'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth   = useAuthStore()

const RECENT_LIMIT = 8

const runs      = ref<wizardApi.WizardRun[]>([])
const loading   = ref(true)
const loadError = ref<string | null>(null)

async function loadRuns() {
  loadError.value = null
  try {
    const page = await wizardApi.listRuns({ limit: 200 })
    runs.value = page.items
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load runs'
  } finally {
    loading.value = false
  }
}

const { startPolling } = useRunsPolling(loadRuns)
onMounted(async () => { await loadRuns(); startPolling() })

const firstName = computed(() => (auth.user?.name ?? '').split(' ')[0])

const SUMMARY: { phases: wizardApi.RunPhase[], label: string, cls: string }[] = [
  { phases: ['Pending', 'Running'],             label: 'In progress', cls: 'running' },
  { phases: ['Ready'],                          label: 'Ready',       cls: 'ready' },
  { phases: ['Failed', 'RollbackFailed'],       label: 'Failed',      cls: 'failed' },
]

const summary = computed(() => SUMMARY.map(s => ({
  ...s,
  count: runs.value.filter(r => s.phases.includes(r.status.phase ?? 'Pending')).length,
})))

const recentRuns = computed(() =>
  [...runs.value]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, RECENT_LIMIT))

// Definition name → friendly wizard title, via the card's create route
function wizardTitle(definition: string): string {
  return WIZARD_CARDS.find(c => c.route === `/wizards/run/${definition}/create`)?.title ?? definition
}
</script>

<template>
  <div class="page-grid">

    <div class="welcome">
      <h1 class="welcome__title">Welcome{{ firstName ? `, ${firstName}` : '' }}</h1>
      <p class="welcome__sub">Pick a wizard to build and run your code — the platform wires up the rest.</p>
    </div>

    <CanvasPanel title="Start something new" icon="mdi-creation" :wide="true">
      <WizardCardGrid />
    </CanvasPanel>

    <CanvasPanel title="Recent runs" icon="mdi-history" :wide="true" :loading="loading" :error="loadError" @refresh="loadRuns">
      <template #actions>
        <button class="fs-btn fs-btn--ghost fs-btn--sm" @click="router.push('/wizards/runs')">
          View all <q-icon name="mdi-arrow-right" size="13px" />
        </button>
      </template>

      <div class="summary-row">
        <div v-for="s in summary" :key="s.label" class="summary-tile" :class="`summary-tile--${s.cls}`">
          <span class="summary-tile__value">{{ s.count }}</span>
          <span class="summary-tile__label">{{ s.label }}</span>
        </div>
      </div>

      <div class="recent-list">
        <div
          v-for="r in recentRuns" :key="r.name"
          class="recent-item" role="link" tabindex="0"
          @click="router.push(`/wizards/runs/${encodeURIComponent(r.name)}`)"
          @keydown.enter="router.push(`/wizards/runs/${encodeURIComponent(r.name)}`)"
        >
          <span class="recent-item__name fs-mono">{{ r.name }}</span>
          <span class="recent-item__wizard">{{ wizardTitle(r.definition) }}</span>
          <WizardPhaseBadge :phase="r.status.phase" />
          <span class="recent-item__meta">{{ r.createdByEmail || r.createdBy || '—' }}</span>
          <span class="recent-item__meta">{{ new Date(r.createdAt).toLocaleString() }}</span>
          <button
            class="icon-btn"
            @click.stop="router.push({ path: `/wizards/runs/${encodeURIComponent(r.name)}`, query: { logs: '1' } })"
          >
            <q-icon name="mdi-text-box-outline" size="15px" />
            <q-tooltip>Logs</q-tooltip>
          </button>
        </div>
        <div v-if="!loading && recentRuns.length === 0" class="recent-empty">
          No runs yet — start one with a wizard above.
        </div>
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

.welcome { grid-column: span 2; padding: 4px 2px 0; }
.welcome__title { margin: 0; font-size: 20px; font-weight: 600; color: var(--fs-text-primary); line-height: 1.3; }
.welcome__sub   { margin: 4px 0 0; font-size: 12.5px; color: var(--fs-text-muted); }

.summary-row { display: flex; gap: 10px; padding: 12px 10px; flex-wrap: wrap; }
.summary-tile {
  display: flex; flex-direction: column; gap: 2px; min-width: 110px;
  padding: 10px 14px; border: 1px solid var(--fs-border); border-left-width: 3px;
  border-radius: 6px; background: var(--fs-bg-elevated);
}
.summary-tile--running { border-left-color: var(--fs-accent); }
.summary-tile--ready   { border-left-color: var(--fs-pos, #4caf50); }
.summary-tile--failed  { border-left-color: var(--fs-neg, #e57373); }
.summary-tile__value { font-size: 20px; font-weight: 700; color: var(--fs-text-primary); font-family: var(--fs-font-mono); }
.summary-tile__label { font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--fs-text-muted); }

.recent-list { display: flex; flex-direction: column; padding: 0 10px 10px; }
.recent-item {
  display: grid;
  grid-template-columns: minmax(160px, 2fr) minmax(130px, 1.5fr) 110px minmax(120px, 1.5fr) 150px 28px;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border: none;
  border-bottom: 1px solid var(--fs-border);
  background: none;
  text-align: left;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--fs-text-primary);
  cursor: pointer;
  transition: background var(--fs-ease);
}
.recent-item:hover { background: var(--fs-bg-hover); }
.recent-item__name   { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-item__wizard { color: var(--fs-text-secondary); }
.recent-item__meta   { color: var(--fs-text-muted); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-empty { padding: 24px 10px; text-align: center; color: var(--fs-text-muted); font-size: 12.5px; }
.fs-mono { font-family: var(--fs-font-mono); }

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 4px; border: none; background: transparent;
  color: var(--fs-text-muted); cursor: pointer; transition: color var(--fs-ease), background var(--fs-ease);
}
.icon-btn:hover { color: var(--fs-accent); background: var(--fs-bg-active); }

.fs-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px;
  border-radius: 4px; font-size: 12.5px; font-family: inherit; font-weight: 500;
  cursor: pointer; border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease);
}
.fs-btn--sm { padding: 5px 10px; font-size: 11.5px; }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.fs-btn--ghost:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
</style>
