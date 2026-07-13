<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePresetsStore } from '@/stores/presets'
import PresetToggle from '@/components/PresetToggle.vue'

const props = withDefaults(defineProps<{
  secretName:      string
  secretKey?:      string
  showKey?:        boolean
  namePlaceholder?: string
  keyPlaceholder?:  string
  disabled?:       boolean
}>(), {
  secretKey: '',
  showKey: false,
  namePlaceholder: 'my-secret',
  keyPlaceholder: 'token',
  disabled: false,
})

const emit = defineEmits<{
  'update:secretName': [value: string]
  'update:secretKey':  [value: string]
}>()

const presetsStore = usePresetsStore()
onMounted(() => { presetsStore.init() })

const mode          = ref<'manual' | 'preset'>('manual')
const selectedPreset = ref('')

function onPresetChange() {
  const preset = presetsStore.secrets.find(p => p.name === selectedPreset.value)
  if (!preset) return
  emit('update:secretName', preset.secretName)
  if (props.showKey) emit('update:secretKey', preset.secretKey ?? '')
}
</script>

<template>
  <div class="snp">
    <PresetToggle v-if="presetsStore.secrets.length > 0" v-model="mode" :disabled="props.disabled" />

    <select
      v-if="mode === 'preset' && presetsStore.secrets.length > 0"
      v-model="selectedPreset"
      class="fs-input"
      :disabled="props.disabled"
      @change="onPresetChange"
    >
      <option value="" disabled>Select a preset…</option>
      <option v-for="p in presetsStore.secrets" :key="p.name" :value="p.name">{{ p.name }}</option>
    </select>

    <template v-else>
      <input
        :value="props.secretName"
        class="fs-input fs-mono"
        :placeholder="props.namePlaceholder"
        :disabled="props.disabled"
        @input="emit('update:secretName', ($event.target as HTMLInputElement).value)"
      />
      <input
        v-if="props.showKey"
        :value="props.secretKey"
        class="fs-input fs-mono snp__key"
        :placeholder="props.keyPlaceholder"
        :disabled="props.disabled"
        @input="emit('update:secretKey', ($event.target as HTMLInputElement).value)"
      />
    </template>
  </div>
</template>

<style scoped>
.snp { display: flex; flex-direction: column; gap: 6px; }

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
.fs-mono { font-family: var(--fs-font-mono); }
.snp__key { margin-top: 6px; }
</style>
