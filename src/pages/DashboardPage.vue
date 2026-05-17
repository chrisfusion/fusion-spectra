<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePermission } from '@/composables/usePermission'

const router = useRouter()
const auth   = useAuthStore()
const { isAdmin } = usePermission()

const displayName = computed(() => auth.user?.name ?? auth.user?.email ?? 'there')
const firstName   = computed(() => displayName.value.split(' ')[0])

interface StatTile {
  icon:    string
  label:   string
  value:   string | number
  sub:     string
  variant: 'accent' | 'pos' | 'violet' | 'amber'
}

const stats: StatTile[] = [
  { icon: 'mdi-package-variant-closed', label: 'Artifacts',    value: 42, sub: 'registered',       variant: 'accent'  },
  { icon: 'mdi-play-circle-outline',    label: 'Active Runs',  value: 7,  sub: 'currently running', variant: 'pos'     },
  { icon: 'mdi-link-chain',             label: 'Chains',       value: 12, sub: 'pipeline chains',   variant: 'violet'  },
  { icon: 'mdi-hammer-wrench',          label: 'Forge Builds', value: 18, sub: 'build artifacts',   variant: 'amber'   },
]

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

interface ActivityItem {
  icon:    string
  color:   string
  text:    string
  time:    string
}

const activity: ActivityItem[] = [
  { icon: 'mdi-check-circle-outline',  color: 'pos',    text: 'WeaveRun training-pipeline-v3 completed',  time: '12m ago' },
  { icon: 'mdi-upload-outline',        color: 'accent', text: 'Artifact model-weights-v2 created',         time: '1h ago'  },
  { icon: 'mdi-link-chain',            color: 'violet', text: 'Chain etl-daily configuration updated',     time: '2h ago'  },
  { icon: 'mdi-hammer-wrench',         color: 'amber',  text: 'Forge build ml-env-1.4.2 succeeded',        time: '3h ago'  },
  { icon: 'mdi-alert-circle-outline',  color: 'neg',    text: 'WeaveRun data-export-job failed',           time: '5h ago'  },
  { icon: 'mdi-tag-outline',           color: 'accent', text: 'Tag stable moved to model-weights-v2:1.0.1', time: '6h ago' },
]

const visibleLinks = computed(() =>
  quickLinks.filter(l => !l.admin || isAdmin.value)
)
</script>

<template>
  <div class="dash">

    <!-- ── Hero ─────────────────────────────────────────────────────────────── -->
    <div class="dash-hero">
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
        <div class="stat-card__value">{{ s.value }}</div>
        <div class="stat-card__label">{{ s.label }}</div>
        <div class="stat-card__sub">{{ s.sub }}</div>
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

      <!-- Activity feed -->
      <div class="dash-panel">
        <div class="dash-panel__header">
          <q-icon name="mdi-clock-fast" size="14px" />
          <span>Recent Activity</span>
        </div>
        <div class="activity-list">
          <div v-for="(item, i) in activity" :key="i" class="activity-item">
            <q-icon
              :name="item.icon"
              size="14px"
              class="activity-item__icon"
              :class="`activity-item__icon--${item.color}`"
            />
            <span class="activity-item__text">{{ item.text }}</span>
            <span class="activity-item__time fs-mono">{{ item.time }}</span>
          </div>
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border);
  border-radius: 8px;
  padding: 24px 28px;
  gap: 16px;
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
</style>
