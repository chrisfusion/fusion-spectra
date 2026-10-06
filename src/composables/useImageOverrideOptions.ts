import { ref } from 'vue'
import { getImageOverrideOptions } from '@/api/weaveApi'

// Module-level cache: the allowlist is static per cluster, fetch once per session.
// null = not loaded / unavailable (prefix check is then left to the server).
const allowedPrefixes = ref<string[] | null>(null)
let inflight: Promise<void> | null = null

export function useImageOverrideOptions() {
  if (allowedPrefixes.value === null && !inflight) {
    inflight = getImageOverrideOptions()
      .then(o => { allowedPrefixes.value = o.allowedPrefixes ?? [] })
      .catch(() => { /* leave null; server validates */ })
      .finally(() => { inflight = null })
  }
  return { allowedPrefixes }
}
