import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { Dark } from 'quasar'

export type Theme = 'lumen' | 'azure' | 'carbon' | 'matrix' | 'synthwave'

export interface ThemeMeta {
  id:     Theme
  label:  string
  swatch: string   // primary accent colour for the swatch dot
  bg:     string   // surface background colour for the swatch tile
}

export const THEMES: ThemeMeta[] = [
  { id: 'lumen',     label: 'Lumen',     swatch: '#087cfa', bg: '#f5f5f5' },
  { id: 'azure',     label: 'Azure',     swatch: '#29b6f6', bg: '#0a2040' },
  { id: 'carbon',    label: 'Carbon',    swatch: '#8cbede', bg: '#313335' },
  { id: 'matrix',    label: 'Matrix',    swatch: '#00ff41', bg: '#071407' },
  { id: 'synthwave', label: 'Synthwave', swatch: '#ff2d9b', bg: '#1a0030' },
]

const VALID_THEMES = new Set<string>(['lumen', 'azure', 'carbon', 'matrix', 'synthwave'])

export const useThemeStore = defineStore('theme', () => {
  const stored = localStorage.getItem('fs-theme') ?? ''
  const theme = ref<Theme>(VALID_THEMES.has(stored) ? (stored as Theme) : 'lumen')

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t)
    Dark.set(t !== 'lumen')
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
