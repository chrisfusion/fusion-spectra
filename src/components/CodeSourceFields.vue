<script setup lang="ts">
import ArtifactTagPicker from '@/components/ArtifactTagPicker.vue'
import type { CodeSourceModel } from '@/utils/codeSource'

const props = withDefaults(defineProps<{
  modelValue:    CodeSourceModel
  showAdvanced?: boolean
  error?:        string | null
}>(), {
  showAdvanced: false,
  error: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: CodeSourceModel]
}>()

function set<K extends keyof CodeSourceModel>(key: K, value: CodeSourceModel[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="csf">
    <label class="toggle-wrap">
      <input
        :checked="modelValue.enabled"
        type="checkbox"
        class="toggle-input"
        @change="set('enabled', ($event.target as HTMLInputElement).checked)"
      />
      <span class="toggle-track"><span class="toggle-thumb" /></span>
      <span class="toggle-label">{{ modelValue.enabled ? 'Enabled' : 'Disabled' }}</span>
    </label>

    <template v-if="modelValue.enabled">
      <p class="csf__desc">
        Injects a code-loader init container that fetches a versioned artifact from
        fusion-index before the container starts, resolving the tag to a concrete
        version on every run.
      </p>

      <ArtifactTagPicker
        :artifact-name="modelValue.artifactName"
        :tag="modelValue.tag"
        @update:artifact-name="set('artifactName', $event)"
        @update:tag="set('tag', $event)"
      />
      <span v-if="error" class="csf__error">{{ error }}</span>

      <template v-if="showAdvanced">
        <div class="csf__adv-row">
          <label class="csf__adv-label">Mount path</label>
          <input
            :value="modelValue.mountPath"
            class="fs-input fs-mono field-narrow"
            placeholder="/weave-code (default)"
            @input="set('mountPath', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="csf__adv-row">
          <label class="csf__adv-label">Index URL</label>
          <input
            :value="modelValue.indexURL"
            class="fs-input fs-mono field-narrow"
            placeholder="cluster default"
            @input="set('indexURL', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="csf__adv-row">
          <label class="csf__adv-label">Loader image</label>
          <input
            :value="modelValue.loaderImage"
            class="fs-input fs-mono field-narrow"
            placeholder="fusion-code-loader:latest"
            @input="set('loaderImage', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="csf__adv-row">
          <label class="csf__adv-label">Pull policy</label>
          <select
            :value="modelValue.loaderImagePullPolicy"
            class="fs-input field-narrow"
            @change="set('loaderImagePullPolicy', ($event.target as HTMLSelectElement).value as CodeSourceModel['loaderImagePullPolicy'])"
          >
            <option value="">IfNotPresent (default)</option>
            <option value="Always">Always</option>
            <option value="Never">Never</option>
            <option value="IfNotPresent">IfNotPresent</option>
          </select>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.csf { display: flex; flex-direction: column; gap: 12px; }

.csf__desc {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--fs-text-muted);
}

.csf__error { font-size: 11px; color: var(--fs-neg, #e57373); }

.csf__adv-row { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 12px; }
.csf__adv-label { font-size: 11px; color: var(--fs-text-muted); }
.field-narrow { max-width: 260px; }

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
.fs-mono { font-family: var(--fs-font-mono); }

.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  width: fit-content;
}
.toggle-input { display: none; }
.toggle-track {
  position: relative;
  width: 34px;
  height: 18px;
  border-radius: 9px;
  background: var(--fs-border);
  border: 1px solid var(--fs-border);
  transition: background var(--fs-ease), border-color var(--fs-ease);
  flex-shrink: 0;
}
.toggle-input:checked ~ .toggle-track { background: var(--fs-accent); border-color: var(--fs-accent); }
.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  transition: transform var(--fs-ease);
}
.toggle-input:checked ~ .toggle-track .toggle-thumb { transform: translateX(16px); }
.toggle-label { font-size: 12px; color: var(--fs-text-muted); }
</style>
