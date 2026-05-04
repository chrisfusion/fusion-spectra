import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'

const POLL_MS = 10_000

export function useRunsPolling(loadFn: () => Promise<void>): {
  polling:       Ref<boolean>
  startPolling:  () => void
  stopPolling:   () => void
  togglePolling: () => void
} {
  const polling = ref(true)
  let timer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    if (timer) return
    polling.value = true
    timer = setInterval(loadFn, POLL_MS)
  }

  function stopPolling() {
    if (timer) { clearInterval(timer); timer = null }
    polling.value = false
  }

  function togglePolling() {
    polling.value ? stopPolling() : startPolling()
  }

  onUnmounted(stopPolling)

  return { polling, startPolling, stopPolling, togglePolling }
}
