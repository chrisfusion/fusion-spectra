<script setup lang="ts">
import CanvasPanel from '@/components/CanvasPanel.vue'
import PlaceholderBanner from '@/components/PlaceholderBanner.vue'

const datasets = [
  { name: 'events_raw',        zone: 'raw',       format: 'Parquet', size: '1.2 TB',  updated: '2 min ago',  status: 'running' },
  { name: 'users_processed',   zone: 'processed', format: 'Delta',   size: '84 GB',   updated: '1 hr ago',   status: 'ok' },
  { name: 'sales_curated',     zone: 'curated',   format: 'Iceberg', size: '22 GB',   updated: '3 hr ago',   status: 'ok' },
  { name: 'clickstream_raw',   zone: 'raw',       format: 'Parquet', size: '3.8 TB',  updated: '5 min ago',  status: 'running' },
  { name: 'products_curated',  zone: 'curated',   format: 'Delta',   size: '5.4 GB',  updated: '12 hr ago',  status: 'ok' },
  { name: 'logs_raw',          zone: 'raw',       format: 'ORC',     size: '780 GB',  updated: '30 sec ago', status: 'pending' },
]

const schemas = [
  { name: 'events_v3',    type: 'Avro',   fields: 18, version: 'v3.2' },
  { name: 'users',        type: 'JSON',   fields: 24, version: 'v1.8' },
  { name: 'products',     type: 'Avro',   fields: 11, version: 'v2.0' },
  { name: 'pageviews',    type: 'Avro',   fields: 9,  version: 'v1.1' },
  { name: 'transactions', type: 'Protobuf', fields: 32, version: 'v4.0' },
]

const storage = [
  { zone: 'raw',       used: 78, total: '10 TB',  color: '#00d4ff' },
  { zone: 'processed', used: 45, total: '4 TB',   color: '#8b5cf6' },
  { zone: 'curated',   used: 22, total: '2 TB',   color: '#10b981' },
]

const zoneColor: Record<string, string> = {
  raw: 'info', processed: 'accent', curated: 'pos'
}
</script>

<template>
  <div class="page-grid">
    <PlaceholderBanner />
    <!-- Datasets panel -->
    <CanvasPanel title="Datasets" icon="mdi-folder-table-outline" :wide="true">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Zone</th>
            <th>Format</th>
            <th>Size</th>
            <th>Updated</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ds in datasets" :key="ds.name">
            <td class="fs-mono accent-text">{{ ds.name }}</td>
            <td><span class="fs-badge" :class="`fs-badge--${zoneColor[ds.zone]}`">{{ ds.zone }}</span></td>
            <td class="fs-mono muted-text">{{ ds.format }}</td>
            <td class="fs-mono">{{ ds.size }}</td>
            <td class="muted-text">{{ ds.updated }}</td>
            <td>
              <span class="status-row">
                <span class="fs-dot" :class="`fs-dot--${ds.status}`" />
                {{ ds.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </CanvasPanel>

    <!-- Schemas panel -->
    <CanvasPanel title="Schemas" icon="mdi-file-code-outline">
      <div class="schema-list">
        <div v-for="s in schemas" :key="s.name" class="schema-item">
          <q-icon name="mdi-file-code-outline" size="14px" class="schema-item__icon" />
          <span class="schema-item__name fs-mono">{{ s.name }}</span>
          <span class="schema-item__meta muted-text fs-mono">{{ s.fields }} fields</span>
          <span class="fs-badge fs-badge--accent">{{ s.version }}</span>
          <span class="fs-badge fs-badge--info">{{ s.type }}</span>
        </div>
      </div>
    </CanvasPanel>

    <!-- Storage panel -->
    <CanvasPanel title="Storage Zones" icon="mdi-harddisk">
      <div class="storage-bars">
        <div v-for="z in storage" :key="z.zone" class="storage-bar">
          <div class="storage-bar__label">
            <span class="fs-mono">{{ z.zone }}</span>
            <span class="muted-text fs-mono">{{ z.used }}% of {{ z.total }}</span>
          </div>
          <div class="storage-bar__track">
            <div
              class="storage-bar__fill"
              :style="{ width: z.used + '%', background: z.color }"
            />
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

/* Table */
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

.accent-text { color: var(--fs-accent) !important; }
.muted-text  { color: var(--fs-text-muted) !important; }

.status-row { display: flex; align-items: center; gap: 5px; color: var(--fs-text-secondary); text-transform: capitalize; }

/* Schemas */
.schema-list { display: flex; flex-direction: column; gap: 2px; }

.schema-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 6px;
  border-radius: 3px;
  transition: background var(--fs-ease);
}
.schema-item:hover { background: var(--fs-bg-hover); }
.schema-item__icon { color: var(--fs-text-muted); flex-shrink: 0; }
.schema-item__name { flex: 1; font-size: 12px; color: var(--fs-text-primary); }
.schema-item__meta { font-size: 11px; }

/* Storage */
.storage-bars { display: flex; flex-direction: column; gap: 14px; }

.storage-bar__label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 12px;
  color: var(--fs-text-secondary);
}

.storage-bar__track {
  height: 4px;
  background: var(--fs-bg-elevated);
  border-radius: 2px;
  overflow: hidden;
}

.storage-bar__fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s ease;
}
</style>
