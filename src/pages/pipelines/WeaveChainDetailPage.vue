<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import ChainDagView from '@/components/ChainDagView.vue'
import * as weaveApi from '@/api/weaveApi'

const route  = useRoute()
const router = useRouter()

const chainName = route.params.name as string

// ─── State ───────────────────────────────────────────────────────────────────

const chain        = ref<weaveApi.WeaveChain | null>(null)
const chainLoading = ref(false)
const chainError   = ref<string | null>(null)

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadChain() {
  chainLoading.value = true
  chainError.value   = null
  try {
    chain.value = await weaveApi.getWeaveChain(chainName)
  } catch (e) {
    chainError.value = e instanceof Error ? e.message : 'Failed to load chain'
  } finally {
    chainLoading.value = false
  }
}

onMounted(loadChain)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/pipelines/weave/chains')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Chains
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current fs-mono">{{ chain?.metadata.name ?? chainName }}</span>
    </div>

    <!-- Chain metadata -->
    <CanvasPanel
      title="Chain Info"
      icon="mdi-link-chain"
      :wide="true"
      :loading="chainLoading"
      :error="chainError ?? undefined"
      @refresh="loadChain"
    >
      <div v-if="chain" class="meta-grid">

        <div class="meta-row">
          <span class="meta-label">Name</span>
          <span class="meta-value fs-mono">{{ chain.metadata.name }}</span>
        </div>

        <div v-if="chain.metadata.namespace" class="meta-row">
          <span class="meta-label">Namespace</span>
          <span class="meta-value fs-mono">{{ chain.metadata.namespace }}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Steps</span>
          <span class="meta-value">{{ chain.spec.steps.length }}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Failure Policy</span>
          <span class="meta-value fs-mono">{{ chain.spec.failurePolicy ?? 'StopAll' }}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Concurrency</span>
          <span class="meta-value fs-mono">{{ chain.spec.concurrencyPolicy ?? 'Wait' }}</span>
        </div>

        <div v-if="chain.spec.sharedStorage" class="meta-row">
          <span class="meta-label">Shared Storage</span>
          <span class="meta-value">
            {{ chain.spec.sharedStorage.size }}
            <span v-if="chain.spec.sharedStorage.storageClassName" class="meta-hint fs-mono">
              ({{ chain.spec.sharedStorage.storageClassName }})
            </span>
          </span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Validation</span>
          <span v-if="chain.status?.valid === true" class="valid-badge valid-badge--ok">
            <q-icon name="mdi-check-circle-outline" size="12px" /> Valid
          </span>
          <span
            v-else-if="chain.status?.valid === false"
            class="valid-badge valid-badge--err"
            :title="chain.status.validationMessage"
          >
            <q-icon name="mdi-alert-circle-outline" size="12px" /> Invalid
            <span v-if="chain.status.validationMessage" class="valid-msg">
              — {{ chain.status.validationMessage }}
            </span>
          </span>
          <span v-else class="valid-badge valid-badge--pending">
            <q-icon name="mdi-clock-outline" size="12px" /> Pending
          </span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Created</span>
          <span class="meta-value">{{ formatDate(chain.metadata.creationTimestamp) }}</span>
        </div>

        <div v-if="chain.metadata.uid" class="meta-row">
          <span class="meta-label">UID</span>
          <span class="meta-value fs-mono meta-value--muted">{{ chain.metadata.uid }}</span>
        </div>

      </div>
    </CanvasPanel>

    <!-- Pipeline diagram -->
    <CanvasPanel
      title="Pipeline Diagram"
      icon="mdi-graph-outline"
      :wide="true"
      :loading="chainLoading"
      :error="chainError ?? undefined"
      @refresh="loadChain"
    >
      <ChainDagView v-if="chain" :steps="chain.spec.steps" />
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

/* Breadcrumb */
.breadcrumb {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 4px;
}
.breadcrumb__back {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--fs-text-muted);
  font-size: 12px;
  font-family: inherit;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.breadcrumb__back:hover {
  color: var(--fs-text-primary);
  background: var(--fs-bg-hover);
}
.breadcrumb__current {
  font-size: 12px;
  color: var(--fs-accent);
  font-weight: 500;
}
.muted-icon { color: var(--fs-text-muted); }

/* Metadata grid */
.meta-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.meta-row {
  display: grid;
  grid-template-columns: 130px 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--fs-border);
}
.meta-row:last-child { border-bottom: none; }

.meta-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  flex-shrink: 0;
}
.meta-value {
  font-size: 12.5px;
  color: var(--fs-text-primary);
}
.meta-value--muted { color: var(--fs-text-muted); font-size: 11.5px; }
.meta-hint { color: var(--fs-text-muted); font-size: 11px; }

/* Valid badges */
.valid-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.valid-badge--ok      { color: var(--fs-pos, #4caf50);  background: color-mix(in srgb, var(--fs-pos, #4caf50)  10%, transparent); }
.valid-badge--err     { color: var(--fs-neg, #e57373);  background: color-mix(in srgb, var(--fs-neg, #e57373)  10%, transparent); cursor: help; }
.valid-badge--pending { color: var(--fs-text-muted);    background: color-mix(in srgb, var(--fs-text-muted)    10%, transparent); }

.valid-msg { font-weight: 400; font-style: italic; }

.fs-mono { font-family: var(--fs-font-mono); }
</style>
