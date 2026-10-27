<script setup lang="ts">
// Retention of one artifact (ArtifactDetailPage): effective rule (own policy or inherited
// from its types), edit/remove the own policy, preview what the rule removes now, and
// "Apply now" — a per-artifact bulk delete with the rule's versionFilter. fusion-index
// stores policies only; nothing applies them automatically.
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { usePermission } from '@/composables/usePermission'
import { describeRetention, shortRetention, parseRetentionInput } from '@/utils/retention'
import * as indexApi from '@/api/indexApi'
import type { EffectiveRetention, BulkVersionDeleteResult, TypeResponse } from '@/api/indexApi'

const props = defineProps<{
  artifactId: number
  types:      TypeResponse[]   // the artifact's types — fromTypes entries carry only typeId
  refreshKey?: number          // bump when versions or tags change (alters what the rule removes)
}>()

const emit = defineEmits<{
  expiring: [semvers: string[]]   // versions the rule would remove now
  applied:  []                    // versions were deleted — reload the version list
}>()

const $q = useQuasar()
const { can, isAdmin } = usePermission()

const canEdit  = computed(() => can('index:retention:manage', props.artifactId))
const canApply = computed(() => can('index:versions:delete', props.artifactId))

const eff      = ref<EffectiveRetention | null>(null)
// What the rule removes now — from read-only list calls, so viewers without delete rights see it too
const preview  = ref<{ deleted: number; skipped: number; versions: string[] } | null>(null)
const loading  = ref(false)
const error    = ref<string | null>(null)
const applying = ref(false)
const result   = ref<BulkVersionDeleteResult | null>(null)

const typeName = (typeId: number | null) => props.types.find(t => t.id === typeId)?.name ?? `type #${typeId}`

// Effective rule + what it would remove right now
async function load() {
  loading.value = true; error.value = null
  try {
    eff.value = await indexApi.getEffectiveRetention(props.artifactId)
    const f = eff.value.versionFilter
    if (f) {
      const [matching, deletable] = await Promise.all([
        indexApi.listVersions(props.artifactId, f),
        indexApi.listVersions(props.artifactId, f, true),
      ])
      preview.value = { deleted: deletable.length, skipped: matching.length - deletable.length, versions: deletable.map(v => v.version) }
    } else {
      preview.value = null
    }
    emit('expiring', preview.value?.versions ?? [])
    syncForm()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load retention'
  } finally { loading.value = false }
}

onMounted(load)
watch(() => props.refreshKey, load)

// ── Own policy form ───────────────────────────────────────────────────────────

const form      = reactive({ keepLast: '' as string | number, maxAgeDays: '' as string | number })
const saving    = ref(false)
const formError = ref('')

function syncForm() {
  form.keepLast   = eff.value?.own?.keepLast ?? ''
  form.maxAgeDays = eff.value?.own?.maxAgeDays ?? ''
  formError.value = ''
}

async function saveOwn() {
  const rule = parseRetentionInput(form.keepLast, form.maxAgeDays)
  if (typeof rule === 'string') { formError.value = rule; return }
  saving.value = true; formError.value = ''
  try {
    await indexApi.setRetention('artifacts', props.artifactId, rule)
    result.value = null
    $q.notify({ type: 'positive', message: 'Retention policy saved' })
    await load()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Save failed'
  } finally { saving.value = false }
}

function removeOwn() {
  const fallback = eff.value?.fromTypes.length ? 'Its types\' policies apply again.' : 'No retention rule applies afterwards.'
  $q.dialog({
    title: 'Remove own policy',
    message: `Remove this artifact's own retention policy? ${fallback}`,
    ok: { label: 'Remove', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    saving.value = true
    try {
      await indexApi.deleteRetention('artifacts', props.artifactId)
      result.value = null
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Remove failed' })
    } finally { saving.value = false }
  })
}

// ── Apply now ─────────────────────────────────────────────────────────────────

async function applyNow() {
  // Re-read first: maxAgeDays is relative to now, and policies may have changed meanwhile
  await load()
  const filter = eff.value?.versionFilter
  const count  = preview.value?.deleted ?? 0
  if (!filter || count === 0) {
    $q.notify({ type: 'info', message: 'No version is past the retention rule right now' })
    return
  }
  const list = (preview.value?.versions ?? []).join(', ')
  $q.dialog({
    title: 'Apply retention now',
    message: `Delete ${count} version${count === 1 ? '' : 's'} (${list}) and their files? `
      + 'Tagged versions are kept. This cannot be undone.',
    ok: { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    applying.value = true
    try {
      result.value = await indexApi.bulkDeleteArtifactVersions(props.artifactId, filter, false)
      emit('applied')
      await load()
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Apply failed' })
    } finally { applying.value = false }
  })
}
</script>

<template>
  <CanvasPanel title="Retention" icon="mdi-calendar-clock-outline" :wide="true" :loading="loading" :error="error" @refresh="load">
    <template #actions>
      <button
        v-if="canApply && eff && eff.source !== 'none'"
        class="ret-btn ret-btn--danger"
        :disabled="applying || !preview?.deleted"
        @click="applyNow"
      >
        <q-icon name="mdi-delete-clock-outline" size="13px" />
        Apply now
      </button>
    </template>

    <template v-if="eff">
      <!-- Effective rule -->
      <div class="ret-status">
        <span class="ret-source" :class="`ret-source--${eff.source}`">
          {{ eff.source === 'artifact' ? 'Own policy' : eff.source === 'types' ? 'From types' : 'No rule' }}
        </span>
        <span v-if="eff.rule" class="ret-rule">{{ describeRetention(eff.rule) }}</span>
        <span v-else class="muted-text">Versions are kept until deleted by hand.</span>
      </div>

      <div v-if="eff.fromTypes.length" class="ret-types">
        <span class="muted-text">{{ eff.source === 'artifact' ? 'Overrides type policies:' : 'Type policies (most conservative per field wins):' }}</span>
        <span v-for="p in eff.fromTypes" :key="p.id" class="ret-type-chip" :class="{ 'ret-type-chip--off': eff.source === 'artifact' }">
          <span class="fs-mono">{{ typeName(p.typeId) }}</span> {{ shortRetention(p) }}
        </span>
        <router-link v-if="isAdmin" to="/admin/retention" class="ret-link">manage</router-link>
      </div>

      <!-- Effect -->
      <div v-if="result" class="ret-bar ret-bar--done">
        Deleted {{ result.deleted }} version{{ result.deleted === 1 ? '' : 's' }}<span v-if="result.skipped"> · {{ result.skipped }} kept (tagged or protected)</span>
      </div>
      <div v-if="eff.rule && preview" class="ret-bar" :class="preview.deleted ? 'ret-bar--warn' : 'ret-bar--ok'">
        <template v-if="preview.deleted">
          {{ preview.deleted }} version{{ preview.deleted === 1 ? ' is' : 's are' }} past this rule and would be removed now
          (marked <span class="expires-badge">expires</span> below)<span v-if="preview.skipped"> · {{ preview.skipped }} more match but are kept (tagged)</span>.
        </template>
        <template v-else>
          No version is past this rule right now<span v-if="preview.skipped"> ({{ preview.skipped }} match but are kept because they are tagged)</span>.
        </template>
        <span class="muted-text"> Nothing is deleted automatically.</span>
      </div>

      <!-- Own policy -->
      <div v-if="canEdit" class="ret-form">
        <span class="ret-form__title">Own policy</span>
        <label class="ret-field">
          Keep last <input v-model="form.keepLast" type="number" min="1" class="ret-input" placeholder="—" />
        </label>
        <label class="ret-field">
          Max age <input v-model="form.maxAgeDays" type="number" min="1" class="ret-input" placeholder="—" /> days
        </label>
        <button class="ret-btn ret-btn--primary" :disabled="saving" @click="saveOwn">
          <q-icon name="mdi-content-save-outline" size="13px" /> Save
        </button>
        <button v-if="eff.own" class="ret-btn" :disabled="saving" @click="removeOwn">Remove own policy</button>
        <span v-if="formError" class="ret-error">{{ formError }}</span>
        <span v-else class="muted-text ret-form__hint">
          An own policy replaces the type policies entirely. A rule matches versions outside the newest "keep last" AND older than "max age".
        </span>
      </div>
    </template>
  </CanvasPanel>
</template>

<style scoped>
.ret-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 2px 10px;
  font-size: 12.5px;
}
.ret-source {
  padding: 2px 9px;
  border-radius: 10px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  border: 1px solid currentColor;
  white-space: nowrap;
}
.ret-source--artifact { color: var(--fs-warn); }
.ret-source--types    { color: var(--fs-accent); }
.ret-source--none     { color: var(--fs-text-muted); }
.ret-rule { color: var(--fs-text-primary); font-weight: 500; }

.ret-types {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 2px 10px;
  font-size: 11.5px;
}
.ret-type-chip {
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--fs-bg-hover);
  border: 1px solid var(--fs-border);
  color: var(--fs-text-primary);
}
.ret-type-chip--off { opacity: 0.5; text-decoration: line-through; }
.ret-link { color: var(--fs-accent); text-decoration: none; }
.ret-link:hover { text-decoration: underline; }

.ret-bar {
  padding: 7px 12px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 10px;
  color: var(--fs-text-primary);
}
.ret-bar--warn { background: color-mix(in srgb, var(--fs-warn) 10%, transparent); border: 1px solid color-mix(in srgb, var(--fs-warn) 35%, transparent); }
.ret-bar--ok   { background: var(--fs-bg-hover); border: 1px solid var(--fs-border); }
.ret-bar--done {
  background: color-mix(in srgb, var(--fs-pos) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fs-pos) 30%, transparent);
  color: var(--fs-pos);
}
.expires-badge {
  padding: 0 6px;
  border-radius: 8px;
  font-size: 10.5px;
  color: var(--fs-warn);
  border: 1px solid var(--fs-warn);
}

.ret-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 14px;
  padding: 10px 2px 2px;
  border-top: 1px solid var(--fs-border-dim);
  font-size: 12px;
  color: var(--fs-text-muted);
}
.ret-form__title {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.ret-form__hint { flex-basis: 100%; }
.ret-field { display: inline-flex; align-items: center; gap: 6px; }
.ret-input {
  width: 70px;
  height: 26px;
  padding: 0 6px;
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border-bright);
  border-radius: 4px;
  color: var(--fs-text-primary);
  font: inherit;
  font-size: 12px;
  outline: none;
}
.ret-input:focus { border-color: var(--fs-accent); }
.ret-error { color: var(--fs-neg); flex-basis: 100%; }

.ret-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--fs-border-bright);
  background: transparent;
  color: var(--fs-text-primary);
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}
.ret-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ret-btn:not(:disabled):hover { background: var(--fs-bg-hover); }
.ret-btn--primary { border-color: var(--fs-accent); color: var(--fs-accent); }
.ret-btn--danger  { border-color: var(--fs-neg); color: var(--fs-neg); margin-right: 4px; }

.muted-text { color: var(--fs-text-muted); font-size: 11.5px; }
</style>
