<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePresetsStore } from '@/stores/presets'
import PresetToggle from '@/components/PresetToggle.vue'

const props = withDefaults(defineProps<{
  brokers:   string
  secretRef: string
  disabled?: boolean
  error?:    string | null
}>(), {
  disabled: false,
  error: null,
})

const emit = defineEmits<{
  'update:brokers':   [value: string]
  'update:secretRef': [value: string]
}>()

const presetsStore = usePresetsStore()
onMounted(() => { presetsStore.init() })

const mode           = ref<'manual' | 'preset'>('manual')
const selectedPreset = ref('')

function onPresetChange() {
  const preset = presetsStore.kafka.find(p => p.name === selectedPreset.value)
  if (!preset) return
  emit('update:brokers', preset.brokers.join(','))
  emit('update:secretRef', preset.secretRef ?? '')
}
</script>

<template>
  <div class="kcf">
    <PresetToggle v-if="presetsStore.kafka.length > 0" v-model="mode" :disabled="props.disabled" />

    <select
      v-if="mode === 'preset' && presetsStore.kafka.length > 0"
      v-model="selectedPreset"
      class="fs-input"
      :disabled="props.disabled"
      @change="onPresetChange"
    >
      <option value="" disabled>Select a Kafka cluster…</option>
      <option v-for="p in presetsStore.kafka" :key="p.name" :value="p.name">{{ p.name }}</option>
    </select>

    <template v-else>
      <input
        :value="props.brokers"
        class="fs-input fs-mono"
        :class="{ 'fs-input--error': props.error }"
        placeholder="broker1:9092,broker2:9092"
        :disabled="props.disabled"
        @input="emit('update:brokers', ($event.target as HTMLInputElement).value)"
      />
      <span v-if="props.error" class="kcf__error">{{ props.error }}</span>
      <input
        :value="props.secretRef"
        class="fs-input fs-mono kcf__secret"
        placeholder="kafka-sasl-secret (optional)"
        :disabled="props.disabled"
        @input="emit('update:secretRef', ($event.target as HTMLInputElement).value)"
      />
    </template>
  </div>
</template>

<style scoped>
.kcf { display: flex; flex-direction: column; gap: 6px; }

.fs-input {
  width: 100%;
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 7px 10px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--fs-text-primary);
  outline: none;
  transition: border-color var(--fs-ease);
  box-sizing: border-box;
}
.fs-input:focus { border-color: var(--fs-accent); }
.fs-input:disabled { opacity: 0.5; cursor: not-allowed; }
.fs-input--error { border-color: var(--fs-neg, #e57373); }
.fs-mono { font-family: var(--fs-font-mono); }
.kcf__secret { margin-top: 6px; }
.kcf__error { font-size: 11px; color: var(--fs-neg, #e57373); }
</style>
