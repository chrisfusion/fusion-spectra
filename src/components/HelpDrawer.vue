<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  listHelp, listVideos, getHelpArticle,
  DIATAXIS_LABELS, DIATAXIS_COLORS,
  type HelpArticle, type HelpArticleDetail, type VideoItem, type DiátaxisType,
} from '@/api/contentApi'
import { marked } from 'marked'

const props = defineProps<{ open: boolean }>()
const emit  = defineEmits<{ close: [] }>()

const route     = useRoute()
const activeTab = ref<'page' | 'all'>('page')

// ── Context → fusion-content service name ──────────────────────────────────────
const CONTEXT_SERVICE: Record<string, string> = {
  data:           'data',
  pipelines:      'weave',
  monitoring:     'monitoring',
  forge:          'forge',
  'fusion-index': 'index',
  admin:          'admin',
}

const currentService = computed(() => CONTEXT_SERVICE[route.meta.context as string] ?? '')

// ── "This page" state ─────────────────────────────────────────────────────────
const pageArticles = ref<HelpArticle[]>([])
const pageVideos   = ref<VideoItem[]>([])
const pageLoading  = ref(false)

async function loadPage() {
  pageLoading.value = true
  try {
    const [arts, vids] = await Promise.all([
      listHelp({ route: route.path, pageSize: 20 }),
      currentService.value
        ? listVideos({ service: currentService.value, pageSize: 10 })
        : Promise.resolve({ data: [], pagination: { page: 1, pageSize: 10, total: 0 } }),
    ])
    pageArticles.value = arts.data
    pageVideos.value   = vids.data
  } catch { /* ignore */ }
  finally { pageLoading.value = false }
}

// ── "Browse all" state ────────────────────────────────────────────────────────
const allArticles   = ref<HelpArticle[]>([])
const allLoading    = ref(false)
const allLoaded     = ref(false)
const searchQ       = ref('')
const filterService = ref('')
const filterType    = ref<DiátaxisType | ''>('')

async function loadAll() {
  if (allLoaded.value) return
  allLoading.value = true
  try {
    const res        = await listHelp({ pageSize: 100 })
    allArticles.value = res.data
    allLoaded.value   = true
  } catch { /* ignore */ }
  finally { allLoading.value = false }
}

const filteredArticles = computed(() => {
  let items = allArticles.value
  if (filterService.value) items = items.filter(a => a.service === filterService.value)
  if (filterType.value)    items = items.filter(a => a.type    === filterType.value)
  if (searchQ.value) {
    const q = searchQ.value.toLowerCase()
    items = items.filter(a =>
      a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)
    )
  }
  return items
})

const allServices = computed(() => [...new Set(allArticles.value.map(a => a.service))].sort())

// ── Article detail ────────────────────────────────────────────────────────────
const detail        = ref<HelpArticleDetail | null>(null)
const detailLoading = ref(false)
const renderedBody  = computed(() =>
  detail.value ? marked.parse(detail.value.body, { async: false }) : ''
)

async function openArticle(a: HelpArticle) {
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getHelpArticle(a.service, a.type, a.slug)
  } catch { /* ignore */ }
  finally { detailLoading.value = false }
}

function closeDetail() { detail.value = null }

// ── Watchers ──────────────────────────────────────────────────────────────────
watch(() => props.open, (v) => {
  if (v) {
    pageArticles.value = []
    pageVideos.value   = []
    detail.value       = null
    loadPage()
    if (activeTab.value === 'all') loadAll()
  }
})

watch(activeTab, (t) => {
  if (t === 'all') loadAll()
})

watch(() => route.path, () => {
  if (!props.open) return
  pageArticles.value = []
  pageVideos.value   = []
  detail.value       = null
  loadPage()
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_LABEL = DIATAXIS_LABELS
const TYPE_COLOR = DIATAXIS_COLORS
</script>

<template>
  <aside class="help-drawer" :class="{ 'help-drawer--open': open }">
    <div class="help-drawer__inner">

      <!-- Header -->
      <div class="hd-header">
        <q-icon name="mdi-help-circle-outline" size="15px" class="hd-header__icon" />
        <span class="hd-header__title">Help</span>
        <button class="hd-close" @click="emit('close')">
          <q-icon name="mdi-close" size="16px" />
        </button>
      </div>

      <!-- Tabs -->
      <div class="hd-tabs">
        <button
          :class="['hd-tab', activeTab === 'page' && 'hd-tab--active']"
          @click="activeTab = 'page'"
        >This page</button>
        <button
          :class="['hd-tab', activeTab === 'all' && 'hd-tab--active']"
          @click="activeTab = 'all'"
        >Browse all</button>
      </div>

      <!-- Article detail (overlays both tabs) -->
      <div v-if="detail || detailLoading" class="hd-detail">
        <button class="hd-back" @click="closeDetail()">
          <q-icon name="mdi-arrow-left" size="14px" />
          Back
        </button>
        <div v-if="detailLoading" class="hd-state">
          <q-spinner size="20px" color="primary" />
        </div>
        <template v-else-if="detail">
          <div class="hd-detail__meta">
            <span class="hd-type-badge" :style="{ '--tc': TYPE_COLOR[detail.type] }">
              {{ TYPE_LABEL[detail.type] }}
            </span>
            <span class="hd-detail__service">{{ detail.service }}</span>
          </div>
          <h2 class="hd-detail__title">{{ detail.title }}</h2>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="hd-body" v-html="renderedBody" />
        </template>
      </div>

      <!-- This page tab -->
      <div v-else-if="activeTab === 'page'" class="hd-content">
        <div v-if="pageLoading" class="hd-state">
          <q-spinner size="20px" color="primary" />
        </div>
        <template v-else>
          <!-- Videos -->
          <template v-if="pageVideos.length">
            <div class="hd-section-label">Videos</div>
            <div class="hd-videos">
              <a
                v-for="v in pageVideos"
                :key="v.slug"
                :href="v.videoUrl"
                target="_blank"
                rel="noopener"
                class="hd-video-card"
              >
                <img :src="v.thumbnailUrl" :alt="v.title" class="hd-video-card__thumb" />
                <span class="hd-video-card__title">{{ v.title }}</span>
              </a>
            </div>
          </template>

          <!-- Articles -->
          <template v-if="pageArticles.length">
            <div class="hd-section-label">Articles</div>
            <div class="hd-articles">
              <button
                v-for="a in pageArticles"
                :key="a.service + a.type + a.slug"
                class="hd-article-card"
                @click="openArticle(a)"
              >
                <div class="hd-article-card__top">
                  <span class="hd-type-badge" :style="{ '--tc': TYPE_COLOR[a.type] }">
                    {{ TYPE_LABEL[a.type] }}
                  </span>
                </div>
                <div class="hd-article-card__title">{{ a.title }}</div>
                <div class="hd-article-card__summary">{{ a.summary }}</div>
              </button>
            </div>
          </template>

          <div v-if="!pageVideos.length && !pageArticles.length" class="hd-empty">
            No help content for this page yet.
          </div>
        </template>
      </div>

      <!-- Browse all tab -->
      <div v-else class="hd-content">
        <div class="hd-filters">
          <input
            v-model="searchQ"
            class="hd-search"
            placeholder="Search…"
            type="search"
          />
          <div class="hd-filter-row">
            <select v-model="filterService" class="hd-select">
              <option value="">All services</option>
              <option v-for="s in allServices" :key="s" :value="s">{{ s }}</option>
            </select>
            <select v-model="filterType" class="hd-select">
              <option value="">All types</option>
              <option value="tutorial">Tutorial</option>
              <option value="how-to">How-to</option>
              <option value="reference">Reference</option>
              <option value="explanation">Explanation</option>
            </select>
          </div>
        </div>

        <div v-if="allLoading" class="hd-state">
          <q-spinner size="20px" color="primary" />
        </div>
        <template v-else>
          <div v-if="!filteredArticles.length" class="hd-empty">
            {{ allLoaded ? 'No articles match your filters.' : '' }}
          </div>
          <div class="hd-articles">
            <button
              v-for="a in filteredArticles"
              :key="a.service + a.type + a.slug"
              class="hd-article-card"
              @click="openArticle(a)"
            >
              <div class="hd-article-card__top">
                <span class="hd-type-badge" :style="{ '--tc': TYPE_COLOR[a.type] }">
                  {{ TYPE_LABEL[a.type] }}
                </span>
                <span class="hd-article-card__svc">{{ a.service }}</span>
              </div>
              <div class="hd-article-card__title">{{ a.title }}</div>
              <div class="hd-article-card__summary">{{ a.summary }}</div>
            </button>
          </div>
        </template>
      </div>

    </div>
  </aside>
</template>

<style scoped>
/* ── Drawer shell ──────────────────────────────────────────────────────────── */
.help-drawer {
  width: 0;
  flex-shrink: 0;
  overflow: hidden;
  transition: width var(--fs-ease-slow);
  border-left: 1px solid transparent;
}

.help-drawer--open {
  width: 340px;
  border-left-color: var(--fs-border);
}

.help-drawer__inner {
  width: 340px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--fs-bg-surface);
  overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.hd-header {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 44px;
  padding: 0 8px 0 14px;
  border-bottom: 1px solid var(--fs-border);
  flex-shrink: 0;
}

.hd-header__icon  { color: var(--fs-accent); }
.hd-header__title { flex: 1; font-size: 12px; font-weight: 600; color: var(--fs-text-secondary); letter-spacing: 0.04em; text-transform: uppercase; }

.hd-close {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  background: none; border: none; border-radius: 3px;
  color: var(--fs-text-muted); cursor: pointer;
  transition: background var(--fs-ease), color var(--fs-ease);
}
.hd-close:hover { background: var(--fs-bg-hover); color: var(--fs-text-primary); }

/* ── Tabs ────────────────────────────────────────────────────────────────── */
.hd-tabs {
  display: flex;
  border-bottom: 1px solid var(--fs-border);
  flex-shrink: 0;
}

.hd-tab {
  flex: 1; padding: 8px 0;
  background: none; border: none;
  font-size: 11px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--fs-text-muted); cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color var(--fs-ease), border-color var(--fs-ease);
}
.hd-tab:hover           { color: var(--fs-text-secondary); }
.hd-tab--active         { color: var(--fs-accent); border-bottom-color: var(--fs-accent); }

/* ── Content area ────────────────────────────────────────────────────────── */
.hd-content {
  flex: 1; overflow-y: auto; padding: 12px;
  display: flex; flex-direction: column; gap: 4px;
}

.hd-state {
  display: flex; align-items: center; justify-content: center;
  height: 80px;
}

.hd-empty {
  font-size: 12px; color: var(--fs-text-muted); font-style: italic; padding: 12px 0;
}

.hd-section-label {
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--fs-text-muted); margin: 8px 0 6px;
}

/* ── Videos ──────────────────────────────────────────────────────────────── */
.hd-videos {
  display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;
}

.hd-video-card {
  display: flex; flex-direction: column; gap: 6px;
  border: 1px solid var(--fs-border); border-radius: 4px;
  overflow: hidden; text-decoration: none;
  transition: border-color var(--fs-ease);
}
.hd-video-card:hover { border-color: var(--fs-accent); }

.hd-video-card__thumb {
  width: 100%; aspect-ratio: 16/9; object-fit: cover;
  background: var(--fs-bg-elevated);
}

.hd-video-card__title {
  font-size: 12px; font-weight: 500; color: var(--fs-text-primary);
  padding: 0 8px 8px; line-height: 1.4;
}

/* ── Article cards ───────────────────────────────────────────────────────── */
.hd-articles {
  display: flex; flex-direction: column; gap: 6px;
}

.hd-article-card {
  width: 100%; text-align: left;
  background: var(--fs-bg-elevated); border: 1px solid var(--fs-border); border-radius: 4px;
  padding: 9px 11px; cursor: pointer;
  display: flex; flex-direction: column; gap: 4px;
  transition: border-color var(--fs-ease), background var(--fs-ease);
}
.hd-article-card:hover { border-color: var(--fs-accent); background: var(--fs-bg-hover); }

.hd-article-card__top {
  display: flex; align-items: center; gap: 6px;
}

.hd-type-badge {
  font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  padding: 1px 5px; border-radius: 2px;
  background: color-mix(in srgb, var(--tc) 14%, transparent);
  color: var(--tc);
}

.hd-article-card__svc {
  font-size: 10px; color: var(--fs-text-muted);
}

.hd-article-card__title {
  font-size: 12px; font-weight: 500; color: var(--fs-text-primary); line-height: 1.35;
}

.hd-article-card__summary {
  font-size: 11px; color: var(--fs-text-muted); line-height: 1.4;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}

/* ── Filters ─────────────────────────────────────────────────────────────── */
.hd-filters { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }

.hd-search, .hd-select {
  width: 100%; padding: 5px 8px;
  background: var(--fs-bg-elevated); border: 1px solid var(--fs-border); border-radius: 3px;
  color: var(--fs-text-primary); font-size: 12px; font-family: var(--fs-font-ui);
  transition: border-color var(--fs-ease);
}
.hd-search:focus, .hd-select:focus { outline: none; border-color: var(--fs-accent); }

.hd-filter-row { display: flex; gap: 6px; }
.hd-filter-row .hd-select { flex: 1; }

/* ── Article detail ──────────────────────────────────────────────────────── */
.hd-detail {
  flex: 1; overflow-y: auto; padding: 12px;
  display: flex; flex-direction: column; gap: 10px;
}

.hd-back {
  display: inline-flex; align-items: center; gap: 5px;
  background: none; border: none; border-radius: 3px; padding: 4px 6px;
  color: var(--fs-text-muted); font-size: 11px; cursor: pointer;
  transition: color var(--fs-ease); align-self: flex-start;
}
.hd-back:hover { color: var(--fs-accent); }

.hd-detail__meta { display: flex; align-items: center; gap: 8px; }
.hd-detail__service { font-size: 10px; color: var(--fs-text-muted); }

.hd-detail__title {
  font-size: 14px; font-weight: 600; color: var(--fs-text-primary);
  line-height: 1.35; margin: 0;
}

</style>
