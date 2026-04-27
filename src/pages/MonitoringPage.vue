<script setup lang="ts">
import CanvasPanel from '@/components/CanvasPanel.vue'
import PlaceholderBanner from '@/components/PlaceholderBanner.vue'

const healthNodes = [
  { name: 'datanode-01', cpu: 42, mem: 61, status: 'ok' },
  { name: 'datanode-02', cpu: 78, mem: 84, status: 'pending' },
  { name: 'datanode-03', cpu: 15, mem: 38, status: 'ok' },
  { name: 'namenode-01', cpu: 31, mem: 52, status: 'ok' },
  { name: 'broker-01',   cpu: 55, mem: 67, status: 'ok' },
]

const alerts = [
  { id: 'ALT-009', severity: 'critical', msg: 'datanode-02 memory > 80%',       time: '4 min ago' },
  { id: 'ALT-008', severity: 'warning',  msg: 'etl_raw_to_processed latency +30%', time: '18 min ago' },
  { id: 'ALT-007', severity: 'warning',  msg: 'Disk usage > 75% on bucket raw-zone', time: '1 hr ago' },
]

const metrics = [
  { label: 'Ingest Rate',    value: '2.4 GB/s',  delta: '+12%',  up: true },
  { label: 'Query P99',      value: '340 ms',    delta: '-5%',   up: false },
  { label: 'Active Jobs',    value: '2',         delta: '—',     up: true },
  { label: 'Storage Used',   value: '5.2 TB',    delta: '+0.3%', up: true },
  { label: 'Error Rate',     value: '0.02%',     delta: '-18%',  up: false },
  { label: 'Cluster Health', value: '94 / 100',  delta: '—',     up: true },
]

const severityVariant: Record<string, string> = { critical: 'neg', warning: 'warn', info: 'info' }

function cpuColor(v: number) {
  if (v > 75) return 'var(--fs-red)'
  if (v > 55) return 'var(--fs-amber)'
  return 'var(--fs-emerald)'
}
</script>

<template>
  <div class="page-grid">
    <PlaceholderBanner />
    <!-- Metric cards -->
    <CanvasPanel title="Key Metrics" icon="mdi-speedometer" :wide="true">
      <div class="metric-grid">
        <div v-for="m in metrics" :key="m.label" class="metric-card">
          <div class="metric-card__label muted-text">{{ m.label }}</div>
          <div class="metric-card__value fs-mono">{{ m.value }}</div>
          <div class="metric-card__delta" :class="m.up ? 'delta--up' : 'delta--down'">
            <q-icon :name="m.delta === '—' ? '' : (m.up ? 'mdi-trending-up' : 'mdi-trending-down')" size="12px" />
            <span class="fs-mono">{{ m.delta }}</span>
          </div>
        </div>
      </div>
    </CanvasPanel>

    <!-- Active alerts -->
    <CanvasPanel title="Active Alerts" icon="mdi-bell-alert-outline">
      <div class="alert-list">
        <div v-for="a in alerts" :key="a.id" class="alert-item" :class="`alert-item--${a.severity}`">
          <q-icon
            :name="a.severity === 'critical' ? 'mdi-alert-circle' : 'mdi-alert'"
            size="15px"
            class="alert-item__icon"
          />
          <div class="alert-item__body">
            <div class="alert-item__msg">{{ a.msg }}</div>
            <div class="alert-item__meta">
              <span class="fs-badge" :class="`fs-badge--${severityVariant[a.severity]}`">{{ a.severity }}</span>
              <span class="muted-text fs-mono">{{ a.time }}</span>
            </div>
          </div>
        </div>
      </div>
    </CanvasPanel>

    <!-- Node health -->
    <CanvasPanel title="Node Health" icon="mdi-server-outline">
      <div class="node-list">
        <div v-for="n in healthNodes" :key="n.name" class="node-item">
          <span class="fs-dot" :class="`fs-dot--${n.status}`" />
          <span class="node-item__name fs-mono">{{ n.name }}</span>
          <div class="node-item__bars">
            <div class="node-bar">
              <span class="muted-text">CPU</span>
              <div class="node-bar__track">
                <div class="node-bar__fill" :style="{ width: n.cpu + '%', background: cpuColor(n.cpu) }" />
              </div>
              <span class="fs-mono node-bar__val">{{ n.cpu }}%</span>
            </div>
            <div class="node-bar">
              <span class="muted-text">MEM</span>
              <div class="node-bar__track">
                <div class="node-bar__fill" :style="{ width: n.mem + '%', background: cpuColor(n.mem) }" />
              </div>
              <span class="fs-mono node-bar__val">{{ n.mem }}%</span>
            </div>
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

/* Metrics */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.metric-card {
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 12px 14px;
}
.metric-card__label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
.metric-card__value { font-size: 18px; font-weight: 500; color: var(--fs-text-primary); line-height: 1; }
.metric-card__delta { display: flex; align-items: center; gap: 3px; margin-top: 5px; font-size: 11px; }
.delta--up   { color: var(--fs-emerald); }
.delta--down { color: var(--fs-blue); }
.muted-text  { color: var(--fs-text-muted); font-size: 11.5px; }

/* Alerts */
.alert-list { display: flex; flex-direction: column; gap: 6px; }

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 3px;
  border-left: 3px solid transparent;
}
.alert-item--critical { border-left-color: var(--fs-red);  background: rgba(239,68,68,0.05); }
.alert-item--warning  { border-left-color: var(--fs-amber); background: rgba(245,158,11,0.05); }

.alert-item__icon { flex-shrink: 0; margin-top: 1px; }
.alert-item--critical .alert-item__icon { color: var(--fs-red); }
.alert-item--warning  .alert-item__icon { color: var(--fs-amber); }

.alert-item__msg  { font-size: 12.5px; color: var(--fs-text-primary); margin-bottom: 5px; }
.alert-item__meta { display: flex; align-items: center; gap: 8px; }

/* Nodes */
.node-list { display: flex; flex-direction: column; gap: 10px; }

.node-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.node-item__name { width: 110px; font-size: 11.5px; color: var(--fs-text-secondary); flex-shrink: 0; }
.node-item__bars { flex: 1; display: flex; flex-direction: column; gap: 4px; }

.node-bar { display: flex; align-items: center; gap: 6px; font-size: 10.5px; }
.node-bar__track {
  flex: 1;
  height: 3px;
  background: var(--fs-bg-elevated);
  border-radius: 2px;
  overflow: hidden;
}
.node-bar__fill  { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
.node-bar__val   { width: 32px; text-align: right; font-size: 10.5px; color: var(--fs-text-secondary); }
</style>
