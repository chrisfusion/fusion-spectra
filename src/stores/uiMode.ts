import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

export type UiMode = 'simple' | 'expert'

// Users with the ui:expert permission get the full UI and may switch to Simple mode
// (e.g. to see what common users see). Everyone else is always in Simple mode:
// wizards + their runs only. The permission is UI-only; the BFF still enforces
// every API route on its own.
export const useUiModeStore = defineStore('uiMode', () => {
  const auth = useAuthStore()

  const stored    = localStorage.getItem('fs-ui-mode')
  const preferred = ref<UiMode>(stored === 'simple' ? 'simple' : 'expert')

  const canExpert = computed(() => auth.user?.permissions.includes('ui:expert') ?? false)
  const expert    = computed(() => canExpert.value && preferred.value === 'expert')

  function set(m: UiMode) {
    preferred.value = m
  }

  watch(preferred, m => localStorage.setItem('fs-ui-mode', m))

  return { canExpert, expert, set }
})
