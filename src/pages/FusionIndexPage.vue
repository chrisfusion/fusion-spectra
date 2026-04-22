<script setup lang="ts">
import CanvasPanel from '@/components/CanvasPanel.vue'

const packages = [
  { name: 'fusion-spectra',  version: '0.3.1', type: 'ui',      published: '2 days ago',  downloads: 14 },
  { name: 'fusion-forge',    version: '1.2.0', type: 'plugin',   published: '5 days ago',  downloads: 31 },
  { name: 'fusion-etl',      version: '2.0.4', type: 'runtime',  published: '1 day ago',   downloads: 88 },
  { name: 'fusion-index',    version: '0.9.2', type: 'service',  published: '3 days ago',  downloads: 22 },
  { name: 'fusion-operator', version: '0.1.0', type: 'operator', published: '8 days ago',  downloads: 7 },
]

const recentArtifacts = [
  { name: 'fusion-etl-2.0.4.tar.gz',       size: '48.2 MB', uploaded: '1 day ago',  hash: 'sha256:a4f2…' },
  { name: 'fusion-forge-1.2.0-linux.tar.gz', size: '32.8 MB', uploaded: '5 days ago', hash: 'sha256:b1d9…' },
  { name: 'fusion-spectra-0.3.1.tar.gz',    size: '8.4 MB',  uploaded: '2 days ago', hash: 'sha256:c7e1…' },
  { name: 'fusion-index-0.9.2.tar.gz',      size: '12.1 MB', uploaded: '3 days ago', hash: 'sha256:d3a8…' },
]

const typeVariant: Record<string, string> = {
  ui: 'accent', plugin: 'info', runtime: 'pos', service: 'warn', operator: 'accent'
}

const searchQuery = ''
</script>

<template>
  <div class="page-grid">
    <!-- Package registry -->
    <CanvasPanel title="Package Registry" icon="mdi-package-variant" :wide="true">
      <table class="data-table">
        <thead>
          <tr>
            <th>Package</th>
            <th>Version</th>
            <th>Type</th>
            <th>Published</th>
            <th>Downloads</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in packages" :key="p.name">
            <td class="fs-mono accent-text">{{ p.name }}</td>
            <td><span class="fs-badge fs-badge--accent fs-mono">{{ p.version }}</span></td>
            <td><span class="fs-badge" :class="`fs-badge--${typeVariant[p.type]}`">{{ p.type }}</span></td>
            <td class="muted-text">{{ p.published }}</td>
            <td class="fs-mono">{{ p.downloads }}</td>
          </tr>
        </tbody>
      </table>
    </CanvasPanel>

    <!-- Recent artifacts -->
    <CanvasPanel title="Recent Artifacts" icon="mdi-archive-outline">
      <div class="artifact-list">
        <div v-for="a in recentArtifacts" :key="a.name" class="artifact-item">
          <q-icon name="mdi-file-outline" size="14px" class="muted-icon" />
          <div class="artifact-item__info">
            <span class="artifact-item__name fs-mono">{{ a.name }}</span>
            <span class="artifact-item__meta muted-text fs-mono">{{ a.size }} · {{ a.uploaded }}</span>
          </div>
          <span class="artifact-item__hash fs-mono muted-text">{{ a.hash }}</span>
        </div>
      </div>
    </CanvasPanel>

    <!-- Search -->
    <CanvasPanel title="Quick Search" icon="mdi-magnify">
      <div class="search-panel">
        <div class="search-panel__input-wrap">
          <q-icon name="mdi-magnify" size="15px" class="muted-icon" />
          <input
            class="search-panel__input fs-mono"
            :value="searchQuery"
            placeholder="Search packages, tags, artifacts…"
            type="text"
          />
        </div>
        <div class="search-panel__hint muted-text">
          <q-icon name="mdi-information-outline" size="13px" />
          <span>Mock — connect to Fusion Index API to enable live search</span>
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

.accent-text { color: var(--fs-accent) !important; }
.muted-text  { color: var(--fs-text-muted) !important; font-size: 11.5px; }
.muted-icon  { color: var(--fs-text-muted); flex-shrink: 0; }

/* Artifacts */
.artifact-list { display: flex; flex-direction: column; gap: 2px; }
.artifact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  border-radius: 3px;
  transition: background var(--fs-ease);
}
.artifact-item:hover { background: var(--fs-bg-hover); }
.artifact-item__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.artifact-item__name { font-size: 12px; color: var(--fs-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.artifact-item__meta { font-size: 10.5px; }
.artifact-item__hash { font-size: 10.5px; flex-shrink: 0; }

/* Search */
.search-panel { display: flex; flex-direction: column; gap: 12px; }
.search-panel__input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border-bright);
  border-radius: 4px;
}
.search-panel__input-wrap:focus-within {
  border-color: var(--fs-accent);
  box-shadow: 0 0 0 2px var(--fs-accent-soft);
}
.search-panel__input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--fs-text-primary);
  font-size: 12px;
}
.search-panel__input::placeholder { color: var(--fs-text-muted); }
.search-panel__hint { display: flex; align-items: center; gap: 6px; font-size: 11.5px; }
</style>
