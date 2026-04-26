<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

interface HubCard {
  icon:     string
  title:    string
  subtitle: string
  route:    string
  live:     boolean
}

const cards: HubCard[] = [
  { icon: 'mdi-account-multiple-outline', title: 'All Users',            subtitle: 'View and manage platform users',          route: '/admin/users',           live: false },
  { icon: 'mdi-shield-account-outline',   title: 'Role Assignments',     subtitle: 'Manage group → role mappings',            route: '/admin/roles',           live: true  },
  { icon: 'mdi-key-chain-variant',        title: 'Resource Permissions', subtitle: 'Grant scoped access to specific resources', route: '/admin/permissions',     live: true  },
  { icon: 'mdi-tag-multiple-outline',     title: 'Artifact Types',       subtitle: 'Manage artifact type definitions',        route: '/admin/types',           live: true  },
  { icon: 'mdi-server-network-outline',   title: 'Platform Services',    subtitle: 'Monitor running platform services',       route: '/admin/platform/services', live: false },
  { icon: 'mdi-tune',                     title: 'Configuration',        subtitle: 'Platform configuration settings',        route: '/admin/config',          live: false },
  { icon: 'mdi-puzzle-outline',           title: 'Integrations',         subtitle: 'External service integrations',          route: '/admin/integrations',    live: false },
  { icon: 'mdi-clipboard-list-outline',   title: 'Audit Log',            subtitle: 'Review admin and user activity',         route: '/admin/audit',           live: false },
]

function navigate(card: HubCard) {
  if (card.live) router.push(card.route)
}
</script>

<template>
  <div class="hub-grid">
    <div
      v-for="card in cards"
      :key="card.route"
      class="hub-card"
      :class="{ 'hub-card--live': card.live, 'hub-card--placeholder': !card.live }"
      @click="navigate(card)"
    >
      <div class="hub-card__icon">
        <q-icon :name="card.icon" size="22px" />
      </div>
      <div class="hub-card__body">
        <div class="hub-card__title">{{ card.title }}</div>
        <div class="hub-card__subtitle">{{ card.subtitle }}</div>
      </div>
      <div class="hub-card__arrow">
        <q-icon v-if="card.live" name="mdi-chevron-right" size="18px" />
        <span v-else class="hub-card__soon">soon</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hub-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 16px;
  align-content: start;
}

.hub-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 6px;
  border: 1px solid var(--fs-border);
  background: var(--fs-bg-panel);
  transition: background var(--fs-ease), border-color var(--fs-ease);
}

.hub-card--live {
  cursor: pointer;
}
.hub-card--live:hover {
  background: var(--fs-bg-hover);
  border-color: var(--fs-border-bright);
}
.hub-card--live:hover .hub-card__icon { color: var(--fs-accent); }
.hub-card--live:hover .hub-card__arrow { color: var(--fs-text-secondary); }

.hub-card--placeholder {
  opacity: 0.5;
  cursor: default;
}

.hub-card__icon {
  color: var(--fs-text-muted);
  flex-shrink: 0;
  transition: color var(--fs-ease);
}

.hub-card__body {
  flex: 1;
  min-width: 0;
}

.hub-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--fs-text-primary);
  margin-bottom: 2px;
}

.hub-card__subtitle {
  font-size: 11.5px;
  color: var(--fs-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hub-card__arrow {
  color: var(--fs-text-muted);
  flex-shrink: 0;
  transition: color var(--fs-ease);
}

.hub-card__soon {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  opacity: 0.6;
  padding: 2px 5px;
  border: 1px solid currentColor;
  border-radius: 3px;
}
</style>
