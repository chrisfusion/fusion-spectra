import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getPresets, type KafkaPreset, type SecretPreset } from '@/api/presetsApi'

export const usePresetsStore = defineStore('presets', () => {
  const kafka       = ref<KafkaPreset[]>([])
  const secrets     = ref<SecretPreset[]>([])
  const initialised = ref(false)

  async function init(): Promise<void> {
    if (initialised.value) return
    try {
      const data = await getPresets()
      kafka.value   = data.kafka ?? []
      secrets.value = data.secrets ?? []
    } catch {
      // No bff:presets:read permission, or the endpoint isn't reachable —
      // pickers fall back to manual-only entry, same as before this feature.
    } finally {
      initialised.value = true
    }
  }

  return { kafka, secrets, initialised, init }
})
