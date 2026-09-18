<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import * as weaveApi from '@/api/weaveApi'

const props = withDefaults(defineProps<{
  mode:            '' | 'serviceAccount' | 'oidc'
  name:            string
  namePlaceholder?: string
  disabled?:       boolean
}>(), {
  namePlaceholder: '(none)',
  disabled: false,
})

const emit = defineEmits<{
  'update:mode': [value: '' | 'serviceAccount' | 'oidc']
  'update:name': [value: string]
}>()

const loading = ref(false)
const error   = ref<string | null>(null)
const options = ref<weaveApi.WeaveExternalAuthOptions | null>(null)

async function loadOptions() {
  loading.value = true
  error.value   = null
  try {
    options.value = await weaveApi.fetchExternalAuthOptions()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load allowlist'
  } finally {
    loading.value = false
  }
}

onMounted(loadOptions)

const namesForMode = computed(() => {
  if (props.mode === 'serviceAccount') return options.value?.serviceAccounts ?? []
  if (props.mode === 'oidc')           return options.value?.oidcSecrets ?? []
  return []
})

function onModeChange(value: string) {
  emit('update:mode', value as '' | 'serviceAccount' | 'oidc')
  emit('update:name', '')
}
</script>

<template>
  <div class="eap">
    <div v-if="loading" class="picker-loading">
      <q-spinner size="14px" /> Loading allowlist…
    </div>
    <div v-else-if="error" class="picker-error">
      <q-icon name="mdi-alert-circle-outline" size="13px" />
      {{ error }}
      <button class="retry-link" @click="loadOptions">Retry</button>
    </div>

    <template v-else>
      <select
        :value="props.mode"
        class="fs-input"
        :disabled="props.disabled"
        @change="onModeChange(($event.target as HTMLSelectElement).value)"
      >
        <option value="">— none —</option>
        <option value="serviceAccount">Service Account</option>
        <option value="oidc">OIDC Client</option>
      </select>

      <template v-if="props.mode">
        <select
          :value="props.name"
          class="fs-input fs-mono"
          :disabled="props.disabled || namesForMode.length === 0"
          @change="emit('update:name', ($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>{{ props.namePlaceholder }}</option>
          <option v-for="n in namesForMode" :key="n" :value="n">{{ n }}</option>
        </select>
        <span v-if="namesForMode.length === 0" class="field-hint warn-hint">
          <q-icon name="mdi-alert-outline" size="11px" />
          No {{ props.mode === 'serviceAccount' ? 'ServiceAccounts' : 'OIDC secrets' }} allowlisted —
          ask a platform admin to configure
          {{ props.mode === 'serviceAccount' ? 'externalAuth.serviceAccounts' : 'externalAuth.oidcSecrets' }}
        </span>
      </template>
    </template>
  </div>
</template>

<style scoped>
.eap { display: flex; flex-direction: column; gap: 6px; }

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

.field-hint { font-size: 11px; color: var(--fs-text-muted); }
.warn-hint  { color: var(--fs-warn, #ff9800); display: flex; align-items: center; gap: 4px; }

.picker-loading, .picker-error {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--fs-text-muted); padding: 6px 0;
}
.picker-error { color: var(--fs-neg, #e57373); }
.retry-link {
  background: none; border: none; cursor: pointer;
  color: var(--fs-accent); font-size: 12px; padding: 0; text-decoration: underline;
}
</style>
