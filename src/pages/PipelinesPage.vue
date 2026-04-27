<script setup lang="ts">
import CanvasPanel from '@/components/CanvasPanel.vue'
import PlaceholderBanner from '@/components/PlaceholderBanner.vue'

const pipelines = [
  { name: 'etl_raw_to_processed', schedule: '0 * * * *',  last: '12 min ago', duration: '4m 22s', status: 'running' },
  { name: 'stream_events_proc',   schedule: 'continuous',  last: '2 min ago',  duration: '—',      status: 'running' },
  { name: 'nightly_aggregation',  schedule: '0 2 * * *',   last: '6 hr ago',   duration: '18m 4s', status: 'ok' },
  { name: 'user_profile_sync',    schedule: '*/30 * * * *', last: '28 min ago', duration: '1m 55s', status: 'ok' },
  { name: 'products_enrichment',  schedule: '0 6 * * *',   last: '4 hr ago',   duration: '8m 12s', status: 'failed' },
]

const jobs = [
  { id: 'job-0041', pipeline: 'etl_raw_to_processed', started: '12 min ago', elapsed: '4m 22s',  status: 'running' },
  { id: 'job-0040', pipeline: 'stream_events_proc',   started: '2 min ago',  elapsed: '2m 01s',  status: 'running' },
  { id: 'job-0039', pipeline: 'nightly_aggregation',  started: '6 hr ago',   elapsed: '18m 04s', status: 'ok' },
  { id: 'job-0038', pipeline: 'products_enrichment',  started: '4 hr ago',   elapsed: '8m 12s',  status: 'failed' },
  { id: 'job-0037', pipeline: 'user_profile_sync',    started: '58 min ago', elapsed: '1m 55s',  status: 'ok' },
]

const statusColor: Record<string, string> = {
  running: 'warn', ok: 'pos', failed: 'neg', pending: 'info'
}
</script>

<template>
  <div class="page-grid">
    <PlaceholderBanner />
    <!-- Pipeline list -->
    <CanvasPanel title="Pipelines" icon="mdi-transit-connection-variant" :wide="true">
      <table class="data-table">
        <thead>
          <tr>
            <th>Pipeline</th>
            <th>Schedule</th>
            <th>Last Run</th>
            <th>Duration</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in pipelines" :key="p.name">
            <td class="fs-mono accent-text">{{ p.name }}</td>
            <td class="fs-mono muted-text">{{ p.schedule }}</td>
            <td class="muted-text">{{ p.last }}</td>
            <td class="fs-mono">{{ p.duration }}</td>
            <td>
              <span class="status-row">
                <span class="fs-dot" :class="`fs-dot--${p.status}`" />
                <span class="fs-badge" :class="`fs-badge--${statusColor[p.status]}`">{{ p.status }}</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </CanvasPanel>

    <!-- Job queue -->
    <CanvasPanel title="Job Queue" icon="mdi-briefcase-outline">
      <div class="job-list">
        <div v-for="j in jobs" :key="j.id" class="job-item">
          <div class="job-item__head">
            <span class="fs-mono job-item__id">{{ j.id }}</span>
            <span class="fs-dot" :class="`fs-dot--${j.status}`" />
          </div>
          <div class="job-item__meta">
            <span class="muted-text">{{ j.pipeline }}</span>
            <span class="muted-text fs-mono">{{ j.elapsed }}</span>
          </div>
        </div>
      </div>
    </CanvasPanel>

    <!-- Pipeline diagram mock -->
    <CanvasPanel title="ETL Flow — etl_raw_to_processed" icon="mdi-graph-outline">
      <svg class="flow-svg" viewBox="0 0 320 90" xmlns="http://www.w3.org/2000/svg">
        <!-- Nodes -->
        <g>
          <!-- Ingest -->
          <rect x="10" y="30" width="60" height="30" rx="3" fill="#0f1a2e" stroke="#1f3558" stroke-width="1"/>
          <text x="40" y="49" text-anchor="middle" fill="#5e7aaa" font-size="9" font-family="JetBrains Mono, monospace">ingest</text>
          <!-- Validate -->
          <rect x="90" y="30" width="60" height="30" rx="3" fill="#0f1a2e" stroke="#00d4ff" stroke-width="1"/>
          <text x="120" y="49" text-anchor="middle" fill="#00d4ff" font-size="9" font-family="JetBrains Mono, monospace">validate</text>
          <!-- Transform -->
          <rect x="170" y="30" width="60" height="30" rx="3" fill="#0f1a2e" stroke="#1f3558" stroke-width="1"/>
          <text x="200" y="49" text-anchor="middle" fill="#5e7aaa" font-size="9" font-family="JetBrains Mono, monospace">transform</text>
          <!-- Load -->
          <rect x="250" y="30" width="60" height="30" rx="3" fill="#0f1a2e" stroke="#10b981" stroke-width="1"/>
          <text x="280" y="49" text-anchor="middle" fill="#10b981" font-size="9" font-family="JetBrains Mono, monospace">load</text>
          <!-- Arrows -->
          <path d="M 70 45 L 90 45" stroke="#1f3558" stroke-width="1" marker-end="url(#arrow)"/>
          <path d="M 150 45 L 170 45" stroke="#00d4ff" stroke-width="1" marker-end="url(#arrow-active)" opacity="0.7"/>
          <path d="M 230 45 L 250 45" stroke="#1f3558" stroke-width="1" marker-end="url(#arrow)"/>
          <!-- Status indicator under validate -->
          <circle cx="120" cy="72" r="3" fill="#00d4ff" opacity="0.8">
            <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite"/>
          </circle>
          <text x="120" y="85" text-anchor="middle" fill="#344d73" font-size="8" font-family="JetBrains Mono, monospace">running</text>
        </g>
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#1f3558"/>
          </marker>
          <marker id="arrow-active" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#00d4ff"/>
          </marker>
        </defs>
      </svg>
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

.accent-text { color: var(--fs-accent) !important; }
.muted-text  { color: var(--fs-text-muted) !important; font-size: 11.5px; }
.status-row  { display: flex; align-items: center; gap: 5px; }

/* Jobs */
.job-list { display: flex; flex-direction: column; gap: 2px; }
.job-item {
  padding: 8px 8px;
  border-radius: 3px;
  border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease);
}
.job-item:hover { background: var(--fs-bg-hover); border-color: var(--fs-border); }
.job-item__head { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.job-item__id   { font-size: 12px; color: var(--fs-accent); }
.job-item__meta { display: flex; justify-content: space-between; font-size: 11.5px; }

/* Flow SVG */
.flow-svg { width: 100%; height: auto; }
</style>
