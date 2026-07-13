<script setup lang="ts">
import { ref } from 'vue'
import * as indexApi from '@/api/indexApi'

const props = withDefaults(defineProps<{
  artifactName: string
  tag:          string
  disabled?:    boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  'update:artifactName': [value: string]
  'update:tag':           [value: string]
}>()

// ─── Artifact name suggestions ─────────────────────────────────────────────────

const artifactMatches = ref<indexApi.Artifact[]>([])
let artifactSearchTimer: ReturnType<typeof setTimeout> | null = null

function onArtifactNameInput(value: string) {
  emit('update:artifactName', value)
  if (artifactSearchTimer) clearTimeout(artifactSearchTimer)
  artifactSearchTimer = setTimeout(() => searchArtifacts(value), 300)
}

async function searchArtifacts(name: string) {
  if (!name.trim()) { artifactMatches.value = []; tagMatches.value = []; return }
  try {
    const page = await indexApi.listArtifacts({ name, pageSize: 8 })
    artifactMatches.value = page.items
    await resolveTags(name)
  } catch {
    artifactMatches.value = []
  }
}

// ─── Tag suggestions for the resolved artifact ─────────────────────────────────
// Chained after searchArtifacts (rather than a separate watcher on
// props.artifactName) so it always matches against the freshly fetched
// artifactMatches — a watcher keyed off the prop alone fires on every
// keystroke, ahead of the debounced fetch, and would look up a stale list.

const tagMatches = ref<string[]>([])

async function resolveTags(name: string) {
  const match = artifactMatches.value.find(a => a.fullName === name)
  if (!match) { tagMatches.value = []; return }
  try {
    const versions = await indexApi.listVersions(match.id)
    const tags = new Set<string>()
    versions.forEach(v => (v.tags ?? []).forEach(t => tags.add(t.tag)))
    tagMatches.value = [...tags]
  } catch {
    tagMatches.value = []
  }
}
</script>

<template>
  <div class="atp">
    <div class="atp__field">
      <input
        :value="props.artifactName"
        list="atp-artifact-list"
        class="fs-input fs-mono"
        placeholder="org.myteam.myapp"
        :disabled="props.disabled"
        @input="onArtifactNameInput(($event.target as HTMLInputElement).value)"
      />
      <datalist id="atp-artifact-list">
        <option v-for="a in artifactMatches" :key="a.id" :value="a.fullName" />
      </datalist>
      <span class="atp__hint">Artifact name</span>
    </div>
    <div class="atp__field">
      <input
        :value="props.tag"
        list="atp-tag-list"
        class="fs-input fs-mono"
        placeholder="stable"
        :disabled="props.disabled"
        @input="emit('update:tag', ($event.target as HTMLInputElement).value)"
      />
      <datalist id="atp-tag-list">
        <option v-for="t in tagMatches" :key="t" :value="t" />
      </datalist>
      <span class="atp__hint">Tag to track</span>
    </div>
  </div>
</template>

<style scoped>
.atp {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.atp__field { display: flex; flex-direction: column; gap: 4px; }
.atp__hint  { font-size: 11px; color: var(--fs-text-muted); }

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
</style>
