<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 70"
    :height="height"
    :width="(height * 100) / 70"
    aria-label="Fusion Spectra logo"
    role="img"
  >
    <polygon
      points="50,6 8,64 92,64"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linejoin="round"
    />
    <line x1="0" y1="24" x2="29" y2="35" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <line x1="71" y1="35" x2="100" y2="20" stroke="#ef5350" stroke-width="2" stroke-linecap="round" />
    <line x1="71" y1="35" x2="100" y2="31" stroke="#ff9800" stroke-width="2" stroke-linecap="round" />
    <line x1="71" y1="35" x2="100" y2="42" stroke="#fdd835" stroke-width="2" stroke-linecap="round" />
    <line x1="71" y1="35" x2="100" y2="54" stroke="#43a047" stroke-width="2" stroke-linecap="round" />
    <line x1="71" y1="35" x2="100" y2="66" stroke="#1e88e5" stroke-width="2" stroke-linecap="round" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ height?: number }>(), { height: 32 })
</script>
