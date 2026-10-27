import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import type { ListParams } from '@/utils/listQuery'
import { useContinuePager } from './useContinuePager'

// State of a server-side filtered list (fusion-shared/listquery endpoints). The URL query is the
// single source of truth for filters and sort — views survive back/forward and can be linked to,
// e.g. /pipelines/runs/all?phase=Failed. Paging (useContinuePager) stays in memory.
//
// load() runs on mount; every query change (filters, sort) resets to the first page and runs it
// again, and so do prevPage/nextPage on their page. Polling just calls load() (same page).

export type QueryPatch = Record<string, string | string[] | undefined>

export function useListQuery(opts: { defaultSort: string; pageSize: number; load: () => unknown }) {
  const route  = useRoute()
  const router = useRouter()
  const path   = route.path

  function qs(key: string): string {
    const v = route.query[key]
    return typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? '') : ''
  }
  // Repeated (?k=a&k=b) and comma-separated (?k=a,b) values, like the backends.
  function qa(key: string): string[] {
    const v = route.query[key]
    return (Array.isArray(v) ? v : v ? [v] : [])
      .flatMap(x => (x ?? '').split(','))
      .map(x => x.trim())
      .filter(Boolean)
  }
  // Optional boolean filter: undefined when absent.
  function qb(key: string): boolean | undefined {
    const s = qs(key)
    return s === 'true' ? true : s === 'false' ? false : undefined
  }

  // Merge a patch into the query; empty values drop the key.
  function setQuery(patch: QueryPatch, o: { replace?: boolean } = {}) {
    const next: LocationQueryRaw = { ...route.query, ...patch }
    for (const k of Object.keys(next)) {
      const v = next[k]
      if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) delete next[k]
    }
    const to = { path, query: next }
    return o.replace ? router.replace(to) : router.push(to)
  }

  function toggleValue(key: string, value: string) {
    const cur = qa(key)
    setQuery({ [key]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] })
  }

  // ─── Sort ───────────────────────────────────────────────────────────────────

  const sort = computed(() => qs('sort') || opts.defaultSort)

  // A first click sorts names ascending and everything else (times, durations) descending.
  function sortBy(key: string, descFirst = key !== 'name') {
    const cur = sort.value
    let next: string
    if (cur === key) next = '-' + key
    else if (cur === '-' + key) next = key
    else next = descFirst ? '-' + key : key
    setQuery({ sort: next === opts.defaultSort ? undefined : next })
  }

  // ─── Search box (debounced into ?q=) ─────────────────────────────────────────

  const search = ref(qs('q'))
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  watch(search, v => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => { if (v.trim() !== qs('q')) setQuery({ q: v.trim() }, { replace: true }) }, 300)
  })
  onUnmounted(() => { if (searchTimer) clearTimeout(searchTimer) })

  // ─── Paging ─────────────────────────────────────────────────────────────────

  const paging = useContinuePager(opts.pageSize, opts.load)

  // The shared parameters for the API call; the page adds its own filters.
  const listParams = computed<ListParams>(() => ({
    q:        qs('q') || undefined,
    since:    qs('since') || undefined,
    source:   qa('source'),
    sort:     sort.value,
    limit:    opts.pageSize,
    continue: paging.token.value,
  }))

  const hasFilters = computed(() => Object.keys(route.query).some(k => k !== 'sort'))
  function clearFilters() {
    search.value = ''
    router.push({ path, query: qs('sort') ? { sort: qs('sort') } : {} })
  }

  watch(() => route.fullPath, () => {
    if (route.path !== path) return
    if (search.value.trim() !== qs('q')) search.value = qs('q')
    paging.reset()
    opts.load()
  })

  onMounted(() => opts.load())

  return {
    qs, qa, qb, setQuery, toggleValue,
    sort, sortBy,
    search,
    setPage: paging.setPage, nextPage: paging.nextPage, prevPage: paging.prevPage, pager: paging.pager,
    listParams, hasFilters, clearFilters,
  }
}
