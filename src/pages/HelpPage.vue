<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import CanvasPanel from '@/components/CanvasPanel.vue'
import {
  listHelp, listVideos, getHelpArticle,
  DIATAXIS_LABELS, DIATAXIS_COLORS, DIATAXIS_TYPES,
  type HelpArticle, type HelpArticleDetail, type VideoItem, type DiátaxisType,
  type ChangelogPagination,
} from '@/api/contentApi'

// ── Videos ────────────────────────────────────────────────────────────────────
const videos        = ref<VideoItem[]>([])
const videosLoading = ref(false)
const videosError   = ref<string | null>(null)
const videoService  = ref('')

async function loadVideos() {
  videosLoading.value = true
  videosError.value   = null
  try {
    const res    = await listVideos({ service: videoService.value || undefined, pageSize: 100 })
    videos.value = res.data
  } catch (e) {
    videosError.value = e instanceof Error ? e.message : 'Failed to load videos'
  } finally {
    videosLoading.value = false
  }
}

const videoServices = computed(() => [...new Set(videos.value.map(v => v.service))].sort())

// ── Articles ──────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20

const articles    = ref<HelpArticle[]>([])
const pagination  = ref<ChangelogPagination>({ page: 1, pageSize: PAGE_SIZE, total: 0 })
const artLoading  = ref(false)
const artError    = ref<string | null>(null)

const searchQ       = ref('')
const filterType    = ref<DiátaxisType | ''>('')
const filterService = ref('')
const allKnownServices = ref<string[]>([])

let searchTimer: ReturnType<typeof setTimeout> | null = null

async function loadArticles(page = 1) {
  artLoading.value = true
  artError.value   = null
  try {
    const res      = await listHelp({
      service:  filterService.value || undefined,
      type:     filterType.value    || undefined,
      q:        searchQ.value       || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
    articles.value   = res.data
    pagination.value = res.pagination
    const newServices = res.data.map(a => a.service).filter(s => !allKnownServices.value.includes(s))
    if (newServices.length) allKnownServices.value = [...allKnownServices.value, ...newServices].sort()
  } catch (e) {
    artError.value = e instanceof Error ? e.message : 'Failed to load articles'
  } finally {
    artLoading.value = false
  }
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadArticles(1), 280)
}

function onFilterChange() { loadArticles(1) }

const totalPages = () => Math.ceil(pagination.value.total / PAGE_SIZE)

// ── Article detail dialog ─────────────────────────────────────────────────────
const dialogOpen    = ref(false)
const detail        = ref<HelpArticleDetail | null>(null)
const detailLoading = ref(false)
const renderedBody  = computed(() =>
  detail.value ? marked.parse(detail.value.body, { async: false }) : ''
)

async function openArticle(a: HelpArticle) {
  dialogOpen.value    = true
  detailLoading.value = true
  detail.value        = null
  try {
    detail.value = await getHelpArticle(a.service, a.type, a.slug)
  } catch { /* ignore */ }
  finally { detailLoading.value = false }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_LABEL = DIATAXIS_LABELS
const TYPE_COLOR = DIATAXIS_COLORS
const ALL_TYPES  = DIATAXIS_TYPES

onMounted(() => {
  loadVideos()
  loadArticles()
})

onUnmounted(() => { if (searchTimer) clearTimeout(searchTimer) })
</script>

<template>
  <div class="page-wrap">

    <!-- Videos panel -->
    <CanvasPanel
      title="Videos"
      icon="mdi-play-circle-outline"
      :wide="true"
      :loading="videosLoading && videos.length === 0"
      :error="videosError"
      @refresh="loadVideos()"
    >
      <template #actions>
        <q-spinner v-if="videosLoading && videos.length > 0" size="14px" color="grey-6" />
        <select
          v-model="videoService"
          class="hp-select"
          @change="loadVideos()"
        >
          <option value="">All services</option>
          <option v-for="s in videoServices" :key="s" :value="s">{{ s }}</option>
        </select>
      </template>

      <div v-if="!videosLoading && videos.length === 0 && !videosError" class="hp-empty">
        No videos available yet.
      </div>

      <div v-else class="hp-video-grid">
        <a
          v-for="v in videos"
          :key="v.service + v.slug"
          :href="v.videoUrl"
          target="_blank"
          rel="noopener"
          class="hp-video-card"
        >
          <img :src="v.thumbnailUrl" :alt="v.title" class="hp-video-card__thumb" />
          <div class="hp-video-card__info">
            <span class="hp-video-card__svc">{{ v.service }}</span>
            <span class="hp-video-card__title">{{ v.title }}</span>
            <span class="hp-video-card__summary">{{ v.summary }}</span>
          </div>
        </a>
      </div>
    </CanvasPanel>

    <!-- Articles panel -->
    <CanvasPanel
      title="Articles"
      icon="mdi-book-open-outline"
      :wide="true"
      :loading="artLoading && articles.length === 0"
      :error="artError"
      @refresh="loadArticles(pagination.page)"
    >
      <template #actions>
        <q-spinner v-if="artLoading && articles.length > 0" size="14px" color="grey-6" />
        <input
          v-model="searchQ"
          class="hp-search"
          placeholder="Search articles…"
          type="search"
          @input="onSearchInput"
        />
        <select v-model="filterService" class="hp-select" @change="onFilterChange">
          <option value="">All services</option>
          <option v-for="s in allKnownServices" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="filterType" class="hp-select" @change="onFilterChange">
          <option value="">All types</option>
          <option v-for="t in ALL_TYPES" :key="t" :value="t">{{ TYPE_LABEL[t] }}</option>
        </select>
      </template>

      <div v-if="!artLoading && articles.length === 0 && !artError" class="hp-empty">
        No articles found.
      </div>

      <div class="hp-article-list">
        <button
          v-for="a in articles"
          :key="a.service + a.type + a.slug"
          class="hp-article-row"
          @click="openArticle(a)"
        >
          <div class="hp-article-row__left">
            <span class="hp-type-badge" :style="{ '--tc': TYPE_COLOR[a.type] }">
              {{ TYPE_LABEL[a.type] }}
            </span>
            <span class="hp-article-row__svc">{{ a.service }}</span>
          </div>
          <div class="hp-article-row__title">{{ a.title }}</div>
          <div class="hp-article-row__summary">{{ a.summary }}</div>
        </button>
      </div>

      <div v-if="totalPages() > 1" class="hp-pagination">
        <button
          class="pg-btn"
          :disabled="pagination.page <= 1 || artLoading"
          @click="loadArticles(pagination.page - 1)"
        >
          <q-icon name="mdi-chevron-left" size="16px" />
        </button>
        <span class="pg-info">{{ pagination.page }} / {{ totalPages() }}</span>
        <button
          class="pg-btn"
          :disabled="pagination.page >= totalPages() || artLoading"
          @click="loadArticles(pagination.page + 1)"
        >
          <q-icon name="mdi-chevron-right" size="16px" />
        </button>
      </div>
    </CanvasPanel>

  </div>

  <!-- Article detail dialog -->
  <q-dialog v-model="dialogOpen">
    <q-card class="help-dialog">
      <div class="help-dialog__header">
        <template v-if="detail">
          <span class="hp-type-badge" :style="{ '--tc': TYPE_COLOR[detail.type] }">
            {{ TYPE_LABEL[detail.type] }}
          </span>
          <span class="help-dialog__svc">{{ detail.service }}</span>
          <span class="help-dialog__title">{{ detail.title }}</span>
        </template>
        <q-space />
        <q-btn flat round dense icon="mdi-close" @click="dialogOpen = false" />
      </div>
      <q-card-section class="help-dialog__body">
        <div v-if="detailLoading" class="help-dialog__loading">
          <q-spinner size="28px" color="primary" />
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else class="hd-body" v-html="renderedBody" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.page-wrap {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hp-empty {
  font-size: 13px; color: var(--fs-text-muted); font-style: italic; padding: 8px 0;
}

/* ── Filter controls ─────────────────────────────────────────────────────── */
.hp-search, .hp-select {
  padding: 3px 7px; height: 26px;
  background: var(--fs-bg-elevated); border: 1px solid var(--fs-border); border-radius: 3px;
  color: var(--fs-text-primary); font-size: 11px; font-family: var(--fs-font-ui);
  transition: border-color var(--fs-ease);
}
.hp-search:focus, .hp-select:focus { outline: none; border-color: var(--fs-accent); }
.hp-search { width: 180px; }

/* ── Video grid ──────────────────────────────────────────────────────────── */
.hp-video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  padding: 4px 0;
}

.hp-video-card {
  display: flex; flex-direction: column;
  border: 1px solid var(--fs-border); border-radius: 4px;
  overflow: hidden; text-decoration: none;
  transition: border-color var(--fs-ease), box-shadow var(--fs-ease);
}
.hp-video-card:hover {
  border-color: var(--fs-accent);
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
}

.hp-video-card__thumb {
  width: 100%; aspect-ratio: 16/9; object-fit: cover;
  background: var(--fs-bg-elevated);
}

.hp-video-card__info {
  padding: 8px 10px 10px;
  display: flex; flex-direction: column; gap: 3px;
}

.hp-video-card__svc {
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--fs-text-muted);
}

.hp-video-card__title {
  font-size: 12px; font-weight: 500; color: var(--fs-text-primary); line-height: 1.35;
}

.hp-video-card__summary {
  font-size: 11px; color: var(--fs-text-muted); line-height: 1.4;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}

/* ── Article list ────────────────────────────────────────────────────────── */
.hp-article-list {
  display: flex; flex-direction: column; gap: 6px; padding: 4px 0;
}

.hp-article-row {
  width: 100%; text-align: left;
  background: var(--fs-bg-elevated); border: 1px solid var(--fs-border); border-radius: 4px;
  padding: 9px 12px; cursor: pointer;
  display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto;
  gap: 4px 10px; align-items: center;
  transition: border-color var(--fs-ease), background var(--fs-ease);
}
.hp-article-row:hover { border-color: var(--fs-accent); background: var(--fs-bg-hover); }

.hp-article-row__left { display: flex; align-items: center; gap: 7px; grid-row: 1; grid-column: 1; }
.hp-article-row__title { font-size: 13px; font-weight: 500; color: var(--fs-text-primary); grid-row: 1; grid-column: 2; }
.hp-article-row__summary { font-size: 11px; color: var(--fs-text-muted); grid-row: 2; grid-column: 2; }
.hp-article-row__svc { font-size: 10px; color: var(--fs-text-muted); }

.hp-type-badge {
  font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  padding: 1px 5px; border-radius: 2px;
  background: color-mix(in srgb, var(--tc) 14%, transparent);
  color: var(--tc);
  white-space: nowrap;
}

/* ── Pagination ──────────────────────────────────────────────────────────── */
.hp-pagination {
  display: flex; align-items: center; justify-content: center; gap: 8px; padding-top: 8px;
}

.pg-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  background: none; border: 1px solid var(--fs-border); border-radius: 3px;
  cursor: pointer; color: var(--fs-text-secondary);
  transition: background var(--fs-ease), color var(--fs-ease);
}
.pg-btn:hover:not(:disabled) { background: var(--fs-bg-hover); color: var(--fs-text-primary); }
.pg-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.pg-info { font-size: 12px; color: var(--fs-text-muted); min-width: 48px; text-align: center; }
</style>

<style>
/* Article detail dialog — unscoped for Quasar portal */
.help-dialog {
  background: var(--fs-bg-surface) !important;
  max-width: 760px;
  width: 90vw;
  max-height: 85vh;
  border: 1px solid var(--fs-border);
  border-radius: 6px;
}

.help-dialog__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--fs-border);
  flex-shrink: 0;
}

.help-dialog__svc {
  font-size: 11px;
  color: var(--fs-text-muted);
}

.help-dialog__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--fs-text-primary);
  flex: 1;
}

.help-dialog__body {
  overflow-y: auto;
  padding: 20px 24px !important;
}

.help-dialog__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
}

</style>
