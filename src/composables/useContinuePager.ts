import { ref, computed } from 'vue'

// Previous/Next paging over opaque continue tokens (fusion-shared/listquery lists). The stack holds
// the token of every page before the current one; `token` is the one to send for the current page.
// Every page but the last is full, so the offset is the stack depth × page size.
export function useContinuePager(pageSize: number, load: () => unknown) {
  const tokens    = ref<string[]>([])
  const nextToken = ref<string | undefined>()
  const count     = ref(0)
  const total     = ref(0)
  const offset    = computed(() => tokens.value.length * pageSize)
  const token     = computed(() => tokens.value.at(-1))

  // Record the page just loaded. weave reports remainingItemCount, wizard the filtered total.
  function setPage(p: { count: number; continue?: string; remaining?: number; total?: number }) {
    count.value     = p.count
    nextToken.value = p.continue || undefined
    total.value     = p.total ?? offset.value + p.count + (p.remaining ?? 0)
  }

  function nextPage() {
    if (!nextToken.value) return
    tokens.value = [...tokens.value, nextToken.value]
    load()
  }
  function prevPage() {
    if (!tokens.value.length) return
    tokens.value = tokens.value.slice(0, -1)
    load()
  }
  // Back to the first page without loading — the caller loads after changing its filters.
  function reset() {
    tokens.value = []
  }

  // Props for ListPager.vue
  const pager = computed(() => ({
    from:    count.value ? offset.value + 1 : 0,
    to:      offset.value + count.value,
    total:   total.value,
    hasPrev: tokens.value.length > 0,
    hasNext: !!nextToken.value,
  }))

  return { token, setPage, nextPage, prevPage, reset, pager }
}
