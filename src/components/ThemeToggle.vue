<template>
  <q-btn
    flat
    round
    dense
    :icon="theme.isDark ? 'light_mode' : 'dark_mode'"
    :aria-label="theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="theme.toggle()"
  >
    <q-tooltip>{{ theme.isDark ? 'Light mode' : 'Dark mode' }}</q-tooltip>
  </q-btn>
</template>

<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
const theme = useThemeStore()
</script>
