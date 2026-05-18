<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePermission } from '@/composables/usePermission'
import { listArtifacts } from '@/api/indexApi'
import { getRunStats, listRuns, type RunSummary, type RunPhase, type RunStatsResponse } from '@/api/weaveMonitorApi'
import { listWeaveChains } from '@/api/weaveApi'
import { listVenvs, listGitBuilds } from '@/api/forgeApi'
import { getSystemHealth, type ServiceStatus, type ServiceOverride } from '@/api/bffStatusApi'

const router = useRouter()
const auth   = useAuthStore()
const { isAdmin } = usePermission()

const displayName = computed(() => auth.user?.name ?? auth.user?.email ?? 'there')
const firstName   = computed(() => displayName.value.split(' ')[0])

// ─── Stat tiles ───────────────────────────────────────────────────────────────

interface StatTile {
  icon:    string
  label:   string
  value:   string | number | null
  sub:     string
  variant: 'accent' | 'pos' | 'violet' | 'amber'
}

const stats = ref<StatTile[]>([
  { icon: 'mdi-package-variant-closed', label: 'Artifacts',    value: null, sub: 'registered',       variant: 'accent' },
  { icon: 'mdi-play-circle-outline',    label: 'Active Runs',  value: null, sub: 'currently running', variant: 'pos'    },
  { icon: 'mdi-link-chain',             label: 'Chains',       value: null, sub: 'pipeline chains',   variant: 'violet' },
  { icon: 'mdi-hammer-wrench',          label: 'Forge Builds', value: null, sub: 'total builds',      variant: 'amber'  },
])

// ─── Service health ───────────────────────────────────────────────────────────

const services   = ref<ServiceStatus[]>([])
const runStats   = ref<RunStatsResponse | null>(null)
const recentRuns = ref<RunSummary[]>([])

const SERVICE_LABELS: Record<string, string> = {
  forge: 'Forge', index: 'Fusion Index', weave: 'Weave', spectra: 'Spectra',
}
const SERVICE_ICONS: Record<string, string> = {
  forge: 'mdi-hammer-wrench', index: 'mdi-database-search-outline',
  weave: 'mdi-share-variant-outline', spectra: 'mdi-application-outline',
}
const OVERRIDE_BADGE: Record<string, string> = {
  Healthy: 'pos', Unhealthy: 'neg', Offline: 'info', Maintenance: 'warn',
}
const OVERRIDE_DOT: Record<string, string> = {
  Healthy: 'ok', Unhealthy: 'failed', Offline: 'idle', Maintenance: 'pending',
}

function overallDotClass(svc: ServiceStatus): string {
  if (svc.override) return `fs-dot--${OVERRIDE_DOT[svc.override.status] ?? 'idle'}`
  if (svc.live === null) return 'fs-dot--idle'
  return svc.live.reachable ? 'fs-dot--ok' : 'fs-dot--failed'
}

function healthBorderClass(svc: ServiceStatus): string {
  if (svc.override) {
    const m: Record<string, string> = { Healthy: 'ok', Unhealthy: 'fail', Offline: 'idle', Maintenance: 'warn' }
    return `health-card--${m[svc.override.status] ?? 'idle'}`
  }
  if (svc.live === null) return 'health-card--idle'
  return svc.live.reachable ? 'health-card--ok' : 'health-card--fail'
}

function overrideBadgeClass(ov: ServiceOverride): string {
  return `fs-badge--${OVERRIDE_BADGE[ov.status] ?? 'info'}`
}

// ─── Recent runs ──────────────────────────────────────────────────────────────

const RUN_PHASE_ICON: Record<RunPhase, string> = {
  Succeeded: 'mdi-check-circle-outline',
  Failed:    'mdi-alert-circle-outline',
  Running:   'mdi-play-circle-outline',
  Pending:   'mdi-clock-outline',
  Stopped:   'mdi-stop-circle-outline',
}
const RUN_PHASE_COLOR: Record<RunPhase, string> = {
  Succeeded: 'pos', Failed: 'neg', Running: 'accent', Pending: 'violet', Stopped: 'amber',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function runTime(run: RunSummary): string {
  const t = run.completionTime ?? run.startTime
  return t ? relativeTime(t) : '—'
}

// ─── Data fetching ────────────────────────────────────────────────────────────

const countdown = ref(60)

async function fetchStats() {
  const [artifactsRes, runsRes, chainsRes, venvsRes, gitRes, healthRes, runsListRes] = await Promise.allSettled([
    listArtifacts({ pageSize: 1 }),
    getRunStats('24h'),
    listWeaveChains(),
    listVenvs({ pageSize: 1 }),
    listGitBuilds({ pageSize: 1 }),
    getSystemHealth(),
    listRuns(),
  ])

  const venvTotal       = venvsRes.status === 'fulfilled' ? venvsRes.value.total : null
  const gitTotal        = gitRes.status   === 'fulfilled' ? gitRes.value.total   : null
  const forgeBothFailed = venvTotal === null && gitTotal === null

  stats.value[0].value = artifactsRes.status === 'fulfilled' ? artifactsRes.value.total     : '--'
  stats.value[1].value = runsRes.status       === 'fulfilled' ? runsRes.value.running        : '--'
  stats.value[2].value = chainsRes.status     === 'fulfilled' ? chainsRes.value.items.length : '--'
  stats.value[3].value = forgeBothFailed ? '--' : (venvTotal ?? 0) + (gitTotal ?? 0)

  if (healthRes.status   === 'fulfilled') services.value  = healthRes.value.services ?? []
  if (runsRes.status     === 'fulfilled') runStats.value  = runsRes.value
  if (runsListRes.status === 'fulfilled') {
    recentRuns.value = [...runsListRes.value]
      .sort((a, b) => {
        const ta = a.startTime ? new Date(a.startTime).getTime() : 0
        const tb = b.startTime ? new Date(b.startTime).getTime() : 0
        return tb - ta
      })
      .slice(0, 8)
  }

  countdown.value = 60
}

let timer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchStats()
  timer          = setInterval(fetchStats, 60_000)
  countdownTimer = setInterval(() => { if (countdown.value > 0) countdown.value-- }, 1000)
})

onUnmounted(() => {
  if (timer          !== null) clearInterval(timer)
  if (countdownTimer !== null) clearInterval(countdownTimer)
})

interface QuickLink {
  icon:    string
  label:   string
  desc:    string
  route:   string
  admin?:  boolean
}

const quickLinks: QuickLink[] = [
  { icon: 'mdi-database-outline',       label: 'Data',           desc: 'Catalog, schemas & lineage',   route: '/data'          },
  { icon: 'mdi-pipe',                   label: 'Pipelines',      desc: 'Runs, chains & triggers',      route: '/pipelines'     },
  { icon: 'mdi-monitor-dashboard',      label: 'Monitoring',     desc: 'Health, metrics & alerts',     route: '/monitoring'    },
  { icon: 'mdi-hammer-wrench',          label: 'Forge',          desc: 'Venv builder & git builds',    route: '/forge'         },
  { icon: 'mdi-package-variant-closed', label: 'Fusion Index',   desc: 'Artifact registry & versions', route: '/fusion-index'  },
  { icon: 'mdi-shield-crown-outline',   label: 'Admin',          desc: 'Users, roles & system config', route: '/admin', admin: true },
]


const visibleLinks = computed(() =>
  quickLinks.filter(l => !l.admin || isAdmin.value)
)
</script>

<template>
  <div class="dash">

    <!-- ── Hero ─────────────────────────────────────────────────────────────── -->
    <div class="dash-hero">
      <span class="hero-countdown fs-mono">↻ {{ countdown }}s</span>
      <div class="dash-hero__inner">
        <svg class="dash-hero__atom" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="2.5" fill="#00d4ff" />
          <ellipse cx="16" cy="16" rx="12" ry="5" stroke="url(#dh-orb1)" stroke-width="1.2" fill="none" />
          <ellipse cx="16" cy="16" rx="12" ry="5" stroke="url(#dh-orb2)" stroke-width="1.2" fill="none" transform="rotate(60 16 16)" />
          <ellipse cx="16" cy="16" rx="12" ry="5" stroke="url(#dh-orb3)" stroke-width="1.2" fill="none" transform="rotate(-60 16 16)" />
          <defs>
            <linearGradient id="dh-orb1" x1="4" y1="16" x2="28" y2="16" gradientUnits="userSpaceOnUse">
              <stop stop-color="#8b5cf6" /><stop offset=".5" stop-color="#00d4ff" /><stop offset="1" stop-color="#10b981" />
            </linearGradient>
            <linearGradient id="dh-orb2" x1="4" y1="16" x2="28" y2="16" gradientUnits="userSpaceOnUse">
              <stop stop-color="#3b82f6" /><stop offset="1" stop-color="#8b5cf6" />
            </linearGradient>
            <linearGradient id="dh-orb3" x1="4" y1="16" x2="28" y2="16" gradientUnits="userSpaceOnUse">
              <stop stop-color="#00d4ff" /><stop offset="1" stop-color="#10b981" />
            </linearGradient>
          </defs>
        </svg>

        <div>
          <h1 class="dash-hero__title fs-gradient-text">fusion SPECTRA</h1>
          <p class="dash-hero__tagline">Unified platform for data, pipelines &amp; model artifacts</p>
        </div>
      </div>

      <p class="dash-hero__welcome">Welcome back, {{ firstName }}</p>
    </div>

    <!-- ── Stats row ─────────────────────────────────────────────────────────── -->
    <div class="dash-stats">
      <div
        v-for="s in stats"
        :key="s.label"
        class="stat-card"
        :class="`stat-card--${s.variant}`"
      >
        <q-icon :name="s.icon" size="22px" class="stat-card__icon" />
        <div class="stat-card__value">
          <q-spinner-dots v-if="s.value === null" size="18px" color="grey-5" />
          <span v-else>{{ s.value }}</span>
        </div>
        <div class="stat-card__label">{{ s.label }}</div>
        <div class="stat-card__sub">{{ s.sub }}</div>
      </div>
    </div>

    <!-- ── Service health ──────────────────────────────────────────────────── -->
    <div v-if="services.length > 0" class="dash-health">
      <div
        v-for="svc in services"
        :key="svc.name"
        class="health-card"
        :class="healthBorderClass(svc)"
        @click="router.push('/monitoring')"
      >
        <div class="health-card__header">
          <span class="fs-dot" :class="overallDotClass(svc)" />
          <q-icon :name="SERVICE_ICONS[svc.name] ?? 'mdi-server-outline'" size="13px" class="health-card__icon" />
          <span class="health-card__name">{{ SERVICE_LABELS[svc.name] ?? svc.name }}</span>
        </div>
        <div class="health-card__status">
          <template v-if="svc.override">
            <span class="fs-badge" :class="overrideBadgeClass(svc.override)">{{ svc.override.status }}</span>
            <span v-if="svc.override.description" class="health-card__desc">{{ svc.override.description }}</span>
          </template>
          <template v-else-if="svc.live !== null">
            <span class="health-card__live" :class="svc.live.reachable ? 'health-card__live--ok' : 'health-card__live--fail'">
              {{ svc.live.reachable ? 'Reachable' : 'Unreachable' }}
            </span>
            <span v-if="svc.live.latency_ms != null" class="health-card__latency fs-mono">
              · {{ svc.live.latency_ms }}ms
            </span>
          </template>
          <span v-else class="health-card__none">No probe</span>
        </div>
      </div>
    </div>

    <!-- ── Bottom grid ───────────────────────────────────────────────────────── -->
    <div class="dash-bottom">

      <!-- Quick links -->
      <div class="dash-panel">
        <div class="dash-panel__header">
          <q-icon name="mdi-view-grid-outline" size="14px" />
          <span>Quick Access</span>
        </div>
        <div class="dash-links">
          <button
            v-for="l in visibleLinks"
            :key="l.route"
            class="link-card"
            @click="router.push(l.route)"
          >
            <q-icon :name="l.icon" size="20px" class="link-card__icon" />
            <div class="link-card__label">{{ l.label }}</div>
            <div class="link-card__desc">{{ l.desc }}</div>
          </button>
        </div>
      </div>

      <!-- Pipeline runs -->
      <div class="dash-panel">
        <div class="dash-panel__header">
          <q-icon name="mdi-play-circle-outline" size="14px" />
          <span>Pipeline Runs</span>
          <div v-if="runStats" class="run-chips">
            <span class="run-chip run-chip--pos">{{ runStats.succeeded }} ok</span>
            <span class="run-chip run-chip--neg">{{ runStats.failed }} failed</span>
            <span class="run-chip run-chip--accent">{{ runStats.running }} live</span>
          </div>
          <button class="run-all-link" @click.stop="router.push('/pipelines/runs')">All →</button>
        </div>
        <div v-if="recentRuns.length > 0" class="activity-list">
          <div
            v-for="run in recentRuns"
            :key="run.name"
            class="activity-item activity-item--link"
            @click="router.push(`/pipelines/runs/${run.name}`)"
          >
            <q-icon
              :name="RUN_PHASE_ICON[run.phase]"
              size="14px"
              class="activity-item__icon"
              :class="`activity-item__icon--${RUN_PHASE_COLOR[run.phase]}`"
            />
            <span class="activity-item__text">
              <span class="run-name">{{ run.name }}</span>
              <span class="run-chain fs-mono"> · {{ run.chain }}</span>
            </span>
            <span class="activity-item__time fs-mono">{{ runTime(run) }}</span>
          </div>
        </div>
        <div v-else class="activity-empty">
          <q-icon name="mdi-clock-outline" size="18px" />
          <span>No recent runs</span>
        </div>

        <!-- 24h breakdown strip -->
        <div class="run-breakdown">
          <button class="run-breakdown__tile run-breakdown__tile--accent" @click="router.push('/pipelines/runs/running')">
            <q-icon name="mdi-play-circle-outline" size="16px" />
            <span class="run-breakdown__value">{{ runStats?.running ?? '--' }}</span>
            <span class="run-breakdown__label">Running</span>
          </button>
          <button class="run-breakdown__tile run-breakdown__tile--neg" @click="router.push('/pipelines/runs/failed')">
            <q-icon name="mdi-alert-circle-outline" size="16px" />
            <span class="run-breakdown__value">{{ runStats?.failed ?? '--' }}</span>
            <span class="run-breakdown__label">Failed</span>
          </button>
          <button class="run-breakdown__tile run-breakdown__tile--pos" @click="router.push('/pipelines/runs')">
            <q-icon name="mdi-check-circle-outline" size="16px" />
            <span class="run-breakdown__value">{{ runStats?.succeeded ?? '--' }}</span>
            <span class="run-breakdown__label">Succeeded</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.dash {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1200px;
}

/* ── Hero ──────────────────────────────────────────────────────────────────── */
.dash-hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border);
  border-radius: 8px;
  padding: 24px 28px;
  gap: 16px;
}

.hero-countdown {
  position: absolute;
  top: 7px;
  left: 10px;
  font-size: 9.5px;
  color: var(--fs-text-muted);
  opacity: 0.55;
  letter-spacing: 0.04em;
}

.dash-hero__inner {
  display: flex;
  align-items: center;
  gap: 18px;
}

.dash-hero__atom {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.dash-hero__title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 0 0 4px;
}

.dash-hero__tagline {
  font-size: 13px;
  color: var(--fs-text-secondary);
  margin: 0;
}

.dash-hero__welcome {
  font-size: 13px;
  color: var(--fs-text-muted);
  margin: 0;
  white-space: nowrap;
}

/* ── Stats row ─────────────────────────────────────────────────────────────── */
.dash-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 16px 18px;
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border);
  border-radius: 8px;
  border-left-width: 3px;
}

.stat-card--accent  { border-left-color: var(--fs-cyan);   }
.stat-card--pos     { border-left-color: var(--fs-pos);  }
.stat-card--violet  { border-left-color: var(--fs-violet); }
.stat-card--amber   { border-left-color: var(--fs-amber);  }

.stat-card__icon { margin-bottom: 4px; }

.stat-card--accent .stat-card__icon  { color: var(--fs-cyan);   }
.stat-card--pos    .stat-card__icon  { color: var(--fs-pos);  }
.stat-card--violet .stat-card__icon  { color: var(--fs-violet); }
.stat-card--amber  .stat-card__icon  { color: var(--fs-amber);  }

.stat-card__value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  color: var(--fs-text-primary);
}

.stat-card__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--fs-text-primary);
}

.stat-card__sub {
  font-size: 11px;
  color: var(--fs-text-muted);
}

/* ── Bottom grid ───────────────────────────────────────────────────────────── */
.dash-bottom {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 12px;
  align-items: start;
}

/* ── Panel shell ───────────────────────────────────────────────────────────── */
.dash-panel {
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border);
  border-radius: 8px;
  overflow: hidden;
}

.dash-panel__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--fs-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--fs-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ── Quick links ───────────────────────────────────────────────────────────── */
.dash-links {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--fs-border);
}

.link-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px 16px;
  background: var(--fs-bg-elevated);
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background var(--fs-ease);
}

.link-card:hover {
  background: var(--fs-bg-hover);
}

.link-card:hover .link-card__icon { color: var(--fs-accent); }

.link-card__icon {
  color: var(--fs-text-muted);
  margin-bottom: 4px;
  transition: color var(--fs-ease);
}

.link-card__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--fs-text-primary);
}

.link-card__desc {
  font-size: 11px;
  color: var(--fs-text-muted);
  line-height: 1.3;
}

/* ── Service health strip ──────────────────────────────────────────────────── */
.dash-health {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.health-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border);
  border-left-width: 3px;
  border-radius: 8px;
  cursor: pointer;
  transition: background var(--fs-ease);
}

.health-card:hover { background: var(--fs-bg-hover); }

.health-card--ok   { border-left-color: var(--fs-pos); }
.health-card--fail { border-left-color: var(--fs-red); }
.health-card--idle { border-left-color: var(--fs-text-muted); }
.health-card--warn { border-left-color: var(--fs-amber); }

.health-card__header {
  display: flex;
  align-items: center;
  gap: 5px;
}

.health-card__icon { color: var(--fs-text-muted); }

.health-card__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--fs-text-primary);
}

.health-card__status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
}

.health-card__live { font-size: 11px; }
.health-card__live--ok   { color: var(--fs-pos); }
.health-card__live--fail { color: var(--fs-red); }

.health-card__latency {
  font-size: 10.5px;
  color: var(--fs-text-muted);
}

.health-card__desc {
  font-size: 10.5px;
  color: var(--fs-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.health-card__none {
  font-size: 11px;
  color: var(--fs-text-muted);
  font-style: italic;
}

/* ── Run chips in panel header ─────────────────────────────────────────────── */
.run-chips {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 4px;
}

.run-chip {
  font-size: 10px;
  font-family: var(--fs-font-mono);
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 500;
}

.run-chip--pos    { background: rgba(16, 185, 129, 0.15); color: var(--fs-pos); }
.run-chip--neg    { background: rgba(239, 68, 68, 0.15);  color: var(--fs-red); }
.run-chip--accent { background: var(--fs-accent-soft);     color: var(--fs-accent); }

.run-all-link {
  margin-left: auto;
  font-size: 11px;
  color: var(--fs-accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: opacity var(--fs-ease);
}
.run-all-link:hover { opacity: 0.7; }

/* ── Run rows ──────────────────────────────────────────────────────────────── */
.activity-item--link { cursor: pointer; }

.run-name  { color: var(--fs-text-secondary); }
.run-chain { color: var(--fs-text-muted); font-size: 11px; }

.activity-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px 14px;
  font-size: 12px;
  color: var(--fs-text-muted);
}

/* ── Activity feed ─────────────────────────────────────────────────────────── */
.activity-list {
  display: flex;
  flex-direction: column;
}

.activity-item {
  display: grid;
  grid-template-columns: 16px 1fr auto;
  align-items: start;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--fs-border);
  transition: background var(--fs-ease);
}

.activity-item:last-child { border-bottom: none; }
.activity-item:hover { background: var(--fs-bg-hover); }

.activity-item__icon { flex-shrink: 0; margin-top: 1px; }

.activity-item__icon--pos    { color: var(--fs-pos);  }
.activity-item__icon--neg    { color: var(--fs-red);    }
.activity-item__icon--accent { color: var(--fs-cyan);   }
.activity-item__icon--violet { color: var(--fs-violet); }
.activity-item__icon--amber  { color: var(--fs-amber);  }

.activity-item__text {
  font-size: 12px;
  color: var(--fs-text-secondary);
  line-height: 1.4;
}

.activity-item__time {
  font-size: 10.5px;
  color: var(--fs-text-muted);
  white-space: nowrap;
  padding-top: 1px;
}

/* ── Run breakdown strip ───────────────────────────────────────────────────── */
.run-breakdown {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--fs-border);
  border-top: 1px solid var(--fs-border);
}

.run-breakdown__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 8px;
  background: var(--fs-bg-elevated);
  border: none;
  cursor: pointer;
  transition: background var(--fs-ease);
}

.run-breakdown__tile:hover { background: var(--fs-bg-hover); }

.run-breakdown__tile--accent { color: var(--fs-accent); }
.run-breakdown__tile--neg    { color: var(--fs-red); }
.run-breakdown__tile--pos    { color: var(--fs-pos); }

.run-breakdown__value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  color: var(--fs-text-primary);
}

.run-breakdown__label {
  font-size: 10.5px;
  color: var(--fs-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
