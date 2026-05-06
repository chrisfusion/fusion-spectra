<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import CanvasPanel from '@/components/CanvasPanel.vue'
import PlaceholderBanner from '@/components/PlaceholderBanner.vue'
import { getSystemHealth, type ServiceStatus, type ServiceOverride } from '@/api/bffStatusApi'

const services  = ref<ServiceStatus[]>([])
const loading   = ref(false)
const error     = ref<string | null>(null)
let   timer: ReturnType<typeof setInterval> | null = null

async function load() {
  loading.value = true
  error.value   = null
  try {
    const data      = await getSystemHealth()
    services.value  = data.services ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load service status'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  timer = setInterval(load, 30_000)
})

onUnmounted(() => {
  if (timer) { clearInterval(timer); timer = null }
})

// ─── Display helpers ──────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  forge:   'Forge',
  index:   'Fusion Index',
  weave:   'Weave',
  spectra: 'Spectra',
}

const SERVICE_ICONS: Record<string, string> = {
  forge:   'mdi-hammer-wrench',
  index:   'mdi-database-search-outline',
  weave:   'mdi-share-variant-outline',
  spectra: 'mdi-application-outline',
}

// badge variant (fs-badge--*)
const OVERRIDE_BADGE: Record<string, string> = {
  Healthy:     'pos',
  Unhealthy:   'neg',
  Offline:     'info',
  Maintenance: 'warn',
}

// dot variant (fs-dot--*)
const OVERRIDE_DOT: Record<string, string> = {
  Healthy:     'ok',
  Unhealthy:   'failed',
  Offline:     'idle',
  Maintenance: 'pending',
}

function overallDotClass(svc: ServiceStatus): string {
  if (svc.override) return `fs-dot--${OVERRIDE_DOT[svc.override.status] ?? 'idle'}`
  if (svc.live === null) return 'fs-dot--idle'
  return svc.live.reachable ? 'fs-dot--ok' : 'fs-dot--failed'
}

function overrideBadgeClass(ov: ServiceOverride): string {
  return `fs-badge--${OVERRIDE_BADGE[ov.status] ?? 'info'}`
}

function liveDotClass(reachable: boolean): string {
  return reachable ? 'fs-dot--ok' : 'fs-dot--failed'
}
</script>

<template>
  <div class="page-grid">
    <PlaceholderBanner />

    <CanvasPanel
      title="Service Status"
      icon="mdi-heart-pulse"
      :wide="true"
      :loading="loading && services.length === 0"
      :error="error"
      @refresh="load"
    >
      <template #actions>
        <q-spinner v-if="loading && services.length > 0" size="14px" color="grey-6" />
        <q-btn
          flat round dense
          icon="mdi-refresh"
          size="sm"
          :disable="loading"
          @click="load"
        />
      </template>

      <div class="svc-grid">
        <div
          v-for="svc in services"
          :key="svc.name"
          class="svc-card"
        >
          <!-- Card header -->
          <div class="svc-card__header">
            <span class="fs-dot" :class="overallDotClass(svc)" />
            <q-icon :name="SERVICE_ICONS[svc.name] ?? 'mdi-server-outline'" size="14px" class="svc-card__icon" />
            <span class="svc-card__name">{{ SERVICE_LABELS[svc.name] ?? svc.name }}</span>
          </div>

          <!-- Live probe -->
          <div class="svc-row">
            <span class="svc-row__label">Live</span>
            <template v-if="svc.live !== null">
              <span class="fs-dot svc-row__dot" :class="liveDotClass(svc.live.reachable)" />
              <span class="svc-row__val fs-mono">
                {{ svc.live.reachable ? 'Reachable' : 'Unreachable' }}
                <span v-if="svc.live.latency_ms != null" class="svc-row__meta">
                  · {{ svc.live.latency_ms }} ms
                </span>
              </span>
            </template>
            <span v-else class="svc-row__val svc-row__none">— no probe</span>
          </div>

          <!-- Manual override -->
          <div class="svc-row">
            <span class="svc-row__label">Override</span>
            <template v-if="svc.override">
              <span class="fs-badge" :class="overrideBadgeClass(svc.override)">
                {{ svc.override.status }}
              </span>
              <span v-if="svc.override.description" class="svc-row__desc">
                {{ svc.override.description }}
              </span>
            </template>
            <span v-else class="svc-row__val svc-row__none">No override</span>
          </div>
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

/* Service grid — 2×2 inside the panel */
.svc-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

/* Individual service card */
.svc-card {
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.svc-card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.svc-card__icon { color: var(--fs-text-muted); }

.svc-card__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--fs-text-primary);
  letter-spacing: 0.02em;
}

/* Row: label + value */
.svc-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
}

.svc-row__label {
  width: 56px;
  flex-shrink: 0;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fs-text-muted);
}

.svc-row__dot { flex-shrink: 0; }

.svc-row__val {
  color: var(--fs-text-secondary);
  font-size: 11.5px;
}

.svc-row__meta {
  color: var(--fs-text-muted);
  font-size: 10.5px;
}

.svc-row__none {
  color: var(--fs-text-muted);
  font-style: italic;
}

.svc-row__desc {
  color: var(--fs-text-muted);
  font-size: 10.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
</style>
