import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { Dark } from 'quasar'

export type Theme = 'midnight' | 'azure' | 'matrix' | 'light' | 'synthwave' | 'darcula'

export interface ThemeMeta {
  id:     Theme
  label:  string
  swatch: string   // primary accent colour for the swatch dot
  bg:     string   // surface background colour for the swatch tile
}

export const THEMES: ThemeMeta[] = [
  { id: 'midnight',  label: 'Midnight',  swatch: '#00d4ff', bg: '#0f1a2e' },
  { id: 'azure',     label: 'Azure',     swatch: '#29b6f6', bg: '#0a2040' },
  { id: 'darcula',   label: 'Darcula',   swatch: '#6897bb', bg: '#313335' },
  { id: 'matrix',    label: 'Matrix',    swatch: '#00ff41', bg: '#071407' },
  { id: 'synthwave', label: 'Synthwave', swatch: '#ff2d9b', bg: '#1a0030' },
  { id: 'light',     label: 'Light',     swatch: '#0066cc', bg: '#ffffff' },
]

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>((localStorage.getItem('fs-theme') as Theme) ?? 'midnight')

  function applyTheme(t: Theme) {
    if (t === 'midnight') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', t)
    }
    Dark.set(t !== 'light')
  }

  function set(t: Theme) {
    theme.value = t
  }

  watch(theme, (t) => {
    applyTheme(t)
    localStorage.setItem('fs-theme', t)
  }, { immediate: true })

  return { theme, set }
})
