<script setup lang="ts">
// Previous/Next pager for continue-token lists (see useListQuery) — "21–40 of 57".
defineProps<{ from: number; to: number; total: number; hasPrev: boolean; hasNext: boolean; noun?: string }>()
defineEmits<{ prev: []; next: [] }>()
</script>

<template>
  <div class="list-pager">
    <span class="list-pager__range">
      <template v-if="total">{{ from }}–{{ to }} of {{ total }}</template>
      <template v-else>0</template>
      {{ noun ?? 'items' }}
    </span>
    <template v-if="hasPrev || hasNext">
      <button class="list-pager__btn" :disabled="!hasPrev" title="Previous page" @click="$emit('prev')">
        <q-icon name="mdi-chevron-left" size="16px" />
      </button>
      <button class="list-pager__btn" :disabled="!hasNext" title="Next page" @click="$emit('next')">
        <q-icon name="mdi-chevron-right" size="16px" />
      </button>
    </template>
  </div>
</template>

<style scoped>
.list-pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding-top: 10px;
}
.list-pager__range { font-size: 11px; color: var(--fs-text-muted); margin-right: 4px; }
.list-pager__btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 4px;
  border: 1px solid var(--fs-border); background: transparent;
  color: var(--fs-text-muted); cursor: pointer;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.list-pager__btn:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.list-pager__btn:disabled { opacity: 0.35; cursor: not-allowed; }
</style>
