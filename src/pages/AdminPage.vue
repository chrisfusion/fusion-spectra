<script setup lang="ts">
import CanvasPanel from '@/components/CanvasPanel.vue'

const users = [
  { name: 'Jane Doe',    email: 'jane@fusion.local',    role: 'Admin',    status: 'active',   last: '2 min ago' },
  { name: 'Bob Smith',   email: 'bob@fusion.local',     role: 'Analyst',  status: 'active',   last: '1 hr ago' },
  { name: 'Carol Wang',  email: 'carol@fusion.local',   role: 'Engineer', status: 'active',   last: '3 hr ago' },
  { name: 'Dave Kumar',  email: 'dave@fusion.local',    role: 'Analyst',  status: 'inactive', last: '2 days ago' },
  { name: 'Eve Torres',  email: 'eve@fusion.local',     role: 'Engineer', status: 'active',   last: '30 min ago' },
]

const services = [
  { name: 'fusion-spectra',  version: '0.3.1', health: 'ok',      replicas: '1/1' },
  { name: 'fusion-forge',    version: '1.2.0', health: 'ok',      replicas: '1/1' },
  { name: 'fusion-index',    version: '0.9.2', health: 'ok',      replicas: '2/2' },
  { name: 'fusion-etl',      version: '2.0.4', health: 'pending', replicas: '0/1' },
  { name: 'keycloak',        version: '24.0',  health: 'ok',      replicas: '1/1' },
  { name: 'postgresql',      version: '16.2',  health: 'ok',      replicas: '1/1' },
]

const roleVariant: Record<string, string> = { Admin: 'warn', Analyst: 'info', Engineer: 'accent' }
</script>

<template>
  <div class="page-grid">
    <!-- Users panel -->
    <CanvasPanel title="Users" icon="mdi-account-group-outline" :wide="true">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Active</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.email">
            <td>
              <div class="user-cell">
                <div class="user-cell__avatar">{{ u.name.split(' ').map(w => w[0]).join('') }}</div>
                <span>{{ u.name }}</span>
              </div>
            </td>
            <td class="fs-mono muted-text">{{ u.email }}</td>
            <td><span class="fs-badge" :class="`fs-badge--${roleVariant[u.role]}`">{{ u.role }}</span></td>
            <td>
              <span class="status-row">
                <span class="fs-dot" :class="u.status === 'active' ? 'fs-dot--ok' : 'fs-dot--idle'" />
                {{ u.status }}
              </span>
            </td>
            <td class="muted-text">{{ u.last }}</td>
          </tr>
        </tbody>
      </table>
    </CanvasPanel>

    <!-- Platform services -->
    <CanvasPanel title="Platform Services" icon="mdi-server-network-outline">
      <div class="services-list">
        <div v-for="s in services" :key="s.name" class="service-item">
          <span class="fs-dot" :class="`fs-dot--${s.health}`" />
          <span class="service-item__name fs-mono">{{ s.name }}</span>
          <span class="fs-badge fs-badge--accent fs-mono">{{ s.version }}</span>
          <span class="service-item__replicas fs-mono muted-text">{{ s.replicas }}</span>
        </div>
      </div>
    </CanvasPanel>

    <!-- Config overview -->
    <CanvasPanel title="System Config" icon="mdi-tune">
      <div class="config-list">
        <div class="config-item">
          <span class="config-item__key fs-mono muted-text">AUTH_MODE</span>
          <span class="config-item__val fs-mono">bypass</span>
        </div>
        <div class="config-item">
          <span class="config-item__key fs-mono muted-text">NAMESPACE</span>
          <span class="config-item__val fs-mono">fusion</span>
        </div>
        <div class="config-item">
          <span class="config-item__key fs-mono muted-text">INGRESS_HOST</span>
          <span class="config-item__val fs-mono">spectra.fusion.local</span>
        </div>
        <div class="config-item">
          <span class="config-item__key fs-mono muted-text">CLUSTER</span>
          <span class="config-item__val fs-mono">minikube</span>
        </div>
        <div class="config-item">
          <span class="config-item__key fs-mono muted-text">LOG_LEVEL</span>
          <span class="config-item__val fs-mono">INFO</span>
        </div>
        <div class="config-item">
          <span class="config-item__key fs-mono muted-text">FEDERATION</span>
          <span class="fs-badge fs-badge--warn">disabled</span>
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

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.data-table th {
  text-align: left;
  padding: 0 10px 8px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.data-table td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--fs-border-dim);
  color: var(--fs-text-primary);
}
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: var(--fs-bg-hover); }

.muted-text  { color: var(--fs-text-muted) !important; font-size: 11.5px; }
.status-row  { display: flex; align-items: center; gap: 5px; color: var(--fs-text-secondary); text-transform: capitalize; }

.user-cell { display: flex; align-items: center; gap: 8px; }
.user-cell__avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--fs-violet), var(--fs-cyan));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

/* Services */
.services-list { display: flex; flex-direction: column; gap: 4px; }
.service-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 6px;
  border-radius: 3px;
  transition: background var(--fs-ease);
}
.service-item:hover { background: var(--fs-bg-hover); }
.service-item__name    { flex: 1; font-size: 12px; color: var(--fs-text-primary); }
.service-item__replicas { font-size: 11px; }

/* Config */
.config-list { display: flex; flex-direction: column; gap: 0; }
.config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 6px;
  border-bottom: 1px solid var(--fs-border-dim);
  font-size: 12px;
}
.config-item:last-child { border-bottom: none; }
.config-item__key { font-size: 11.5px; }
.config-item__val { color: var(--fs-accent); font-size: 12px; }
</style>
