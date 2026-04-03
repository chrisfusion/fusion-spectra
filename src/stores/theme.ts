import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { Dark } from 'quasar'

const STORAGE_KEY = 'fusion-theme'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref<boolean>(localStorage.getItem(STORAGE_KEY) === 'dark')

  function toggle() {
    isDark.value = !isDark.value
  }

  watch(
    isDark,
    (val) => {
      localStorage.setItem(STORAGE_KEY, val ? 'dark' : 'light')
      Dark.set(val)
    },
    { immediate: true },
  )

  return { isDark, toggle }
})
