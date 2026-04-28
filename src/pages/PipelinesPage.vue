<script setup lang="ts">
import PlaceholderBanner from '@/components/PlaceholderBanner.vue'
</script>

<template>
  <div class="page-grid">
    <PlaceholderBanner />
  </div>
</template>

<style scoped>
.page-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 16px;
  align-content: start;
}
</style>
