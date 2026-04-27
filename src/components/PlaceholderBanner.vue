<template>
  <div class="placeholder-banner">
    <q-icon name="mdi-wrench-clock-outline" size="13px" class="placeholder-banner__icon" />
    <span class="placeholder-banner__label">PLACEHOLDER</span>
    <span class="placeholder-banner__sep">·</span>
    <span class="placeholder-banner__hint">Data shown is illustrative only — this section is not yet implemented.</span>
  </div>
</template>

<style scoped>
.placeholder-banner {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  height: 32px;
  background: rgba(245, 158, 11, 0.07);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 4px;
  font-size: 11.5px;
}

.placeholder-banner__icon {
  color: var(--fs-warn);
  flex-shrink: 0;
}

.placeholder-banner__label {
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--fs-warn);
  font-size: 10.5px;
}

.placeholder-banner__sep {
  color: var(--fs-text-muted);
}

.placeholder-banner__hint {
  color: var(--fs-text-muted);
  font-size: 11.5px;
}
</style>
