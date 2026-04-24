<script setup lang="ts">
import CanvasPanel from '@/components/CanvasPanel.vue'
</script>

<template>
  <div class="page-grid">
    <CanvasPanel title="Forge" icon="mdi-hammer-wrench" :wide="true">
      <div class="placeholder">
        <q-icon name="mdi-hammer-wrench" size="40px" class="placeholder__icon" />
        <p class="placeholder__title">Fusion Forge</p>
        <p class="placeholder__hint">Async Python venv builder — use the sidebar to get started.</p>
      </div>
    </CanvasPanel>
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

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 24px;
  text-align: center;
}
.placeholder__icon  { color: var(--fs-text-muted); }
.placeholder__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--fs-text-primary);
}
.placeholder__hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--fs-text-muted);
}
</style>
