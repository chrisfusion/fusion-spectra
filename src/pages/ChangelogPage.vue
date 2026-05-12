<script setup lang="ts">
import { ref, onMounted } from 'vue'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { listChangelog, type ChangelogDateGroup, type ChangelogPagination } from '@/api/contentApi'

const PAGE_SIZE = 20

const groups     = ref<ChangelogDateGroup[]>([])
const pagination = ref<ChangelogPagination>({ page: 1, pageSize: PAGE_SIZE, total: 0 })
const loading    = ref(false)
const error      = ref<string | null>(null)

async function load(page = 1) {
  loading.value = true
  error.value   = null
  try {
    const res    = await listChangelog(page, PAGE_SIZE)
    groups.value     = res.data
    pagination.value = res.pagination
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load changelog'
  } finally {
    loading.value = false
  }
}

function formatDate(raw: string): string {
  if (raw === 'unreleased') return 'Unreleased'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

const totalPages = () => Math.ceil(pagination.value.total / PAGE_SIZE)

onMounted(() => load(1))
</script>

<template>
  <div class="page-wrap">
    <CanvasPanel
      title="Changelog"
      icon="mdi-clipboard-text-clock-outline"
      :loading="loading && groups.length === 0"
      :error="error"
      @refresh="load(pagination.page)"
    >
      <template #actions>
        <q-spinner v-if="loading && groups.length > 0" size="14px" color="grey-6" />
        <q-btn flat round dense icon="mdi-refresh" size="sm" :disable="loading" @click="load(pagination.page)" />
      </template>

      <div class="cl-body">
        <div v-if="!loading && groups.length === 0 && !error" class="cl-empty">
          No changelog entries available yet.
        </div>

        <div v-for="group in groups" :key="group.date" class="cl-group">
          <div class="cl-date-row">
            <span :class="['cl-date', group.date === 'unreleased' && 'cl-date--unreleased']">
              {{ formatDate(group.date) }}
            </span>
          </div>

          <div v-for="entry in group.projects" :key="entry.project + entry.version" class="cl-entry">
            <div class="cl-entry__header">
              <span class="cl-project">{{ entry.project }}</span>
              <span class="cl-version fs-mono">{{ entry.version }}</span>
            </div>

            <ul v-if="entry.changes.added?.length" class="cl-list cl-list--added">
              <li v-for="item in entry.changes.added" :key="item">
                <span class="cl-kind cl-kind--added">Added</span>{{ item }}
              </li>
            </ul>
            <ul v-if="entry.changes.changed?.length" class="cl-list cl-list--changed">
              <li v-for="item in entry.changes.changed" :key="item">
                <span class="cl-kind cl-kind--changed">Changed</span>{{ item }}
              </li>
            </ul>
            <ul v-if="entry.changes.fixed?.length" class="cl-list cl-list--fixed">
              <li v-for="item in entry.changes.fixed" :key="item">
                <span class="cl-kind cl-kind--fixed">Fixed</span>{{ item }}
              </li>
            </ul>
            <ul v-if="entry.changes.removed?.length" class="cl-list cl-list--removed">
              <li v-for="item in entry.changes.removed" :key="item">
                <span class="cl-kind cl-kind--removed">Removed</span>{{ item }}
              </li>
            </ul>
          </div>
        </div>

        <div v-if="totalPages() > 1" class="cl-pagination">
          <button
            class="pg-btn"
            :disabled="pagination.page <= 1 || loading"
            @click="load(pagination.page - 1)"
          >
            <q-icon name="mdi-chevron-left" size="16px" />
          </button>
          <span class="pg-info">{{ pagination.page }} / {{ totalPages() }}</span>
          <button
            class="pg-btn"
            :disabled="pagination.page >= totalPages() || loading"
            @click="load(pagination.page + 1)"
          >
            <q-icon name="mdi-chevron-right" size="16px" />
          </button>
        </div>
      </div>
    </CanvasPanel>
  </div>
</template>

<style scoped>
.page-wrap {
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.cl-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 4px 0 8px;
}

.cl-empty {
  font-size: 13px;
  color: var(--fs-text-muted);
  font-style: italic;
  padding: 8px 0;
}

/* Date group */
.cl-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cl-date-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cl-date-row::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--fs-border);
}

.cl-date {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  white-space: nowrap;
}

.cl-date--unreleased {
  color: var(--fs-accent);
}

/* Project entry */
.cl-entry {
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 10px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cl-entry__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.cl-project {
  font-size: 12px;
  font-weight: 600;
  color: var(--fs-text-primary);
  letter-spacing: 0.02em;
}

.cl-version {
  font-size: 11px;
  color: var(--fs-text-muted);
  background: var(--fs-bg-hover);
  border: 1px solid var(--fs-border);
  border-radius: 3px;
  padding: 1px 6px;
}

/* Change lists */
.cl-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cl-list li {
  display: flex;
  align-items: baseline;
  gap: 7px;
  font-size: 12px;
  color: var(--fs-text-secondary);
  line-height: 1.5;
}

.cl-kind {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  border-radius: 2px;
  padding: 1px 5px;
  white-space: nowrap;
  flex-shrink: 0;
}

.cl-kind--added   { background: color-mix(in srgb, var(--fs-pos,  #4caf50) 14%, transparent); color: var(--fs-pos,  #4caf50); }
.cl-kind--changed { background: color-mix(in srgb, var(--fs-accent) 14%, transparent);        color: var(--fs-accent); }
.cl-kind--fixed   { background: color-mix(in srgb, var(--fs-info, #2196f3) 14%, transparent); color: var(--fs-info, #2196f3); }
.cl-kind--removed { background: color-mix(in srgb, var(--fs-neg,  #e57373) 14%, transparent); color: var(--fs-neg,  #e57373); }

/* Pagination */
.cl-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-top: 8px;
}

.pg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid var(--fs-border);
  border-radius: 3px;
  cursor: pointer;
  color: var(--fs-text-secondary);
  transition: background var(--fs-ease), color var(--fs-ease);
}

.pg-btn:hover:not(:disabled) {
  background: var(--fs-bg-hover);
  color: var(--fs-text-primary);
}

.pg-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.pg-info {
  font-size: 12px;
  color: var(--fs-text-muted);
  min-width: 48px;
  text-align: center;
}
</style>
