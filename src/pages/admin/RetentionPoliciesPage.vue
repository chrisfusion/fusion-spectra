<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { usePermission } from '@/composables/usePermission'
import * as indexApi from '@/api/indexApi'
import { describeRetention, parseRetentionInput } from '@/utils/retention'
import type { RetentionPolicy, TypeResponse, Artifact } from '@/api/indexApi'

type Scope = 'types' | 'artifacts'

const $q    = useQuasar()
const { can } = usePermission()

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

const scopeOf = (p: RetentionPolicy): Scope => (p.artifactId !== null ? 'artifacts' : 'types')
const targetId = (p: RetentionPolicy): number => (p.artifactId ?? p.typeId)!
const targetName = (p: RetentionPolicy) => p.artifactName ?? p.typeName ?? `#${targetId(p)}`

// ── Policy list ───────────────────────────────────────────────────────────────

const policies = ref<RetentionPolicy[]>([])
const loading  = ref(false)
const error    = ref<string | null>(null)
const deleting = ref<Set<number>>(new Set())

async function loadPolicies() {
  loading.value = true; error.value = null
  try { policies.value = await indexApi.listRetentionPolicies() ?? [] }
  catch (e) { error.value = e instanceof Error ? e.message : 'Failed to load policies' }
  finally { loading.value = false }
}

function removePolicy(p: RetentionPolicy) {
  $q.dialog({
    title: 'Delete retention policy',
    message: `Delete the retention policy of ${scopeOf(p) === 'types' ? 'type' : 'artifact'} "${targetName(p)}"?`,
    ok: { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deleting.value = new Set([...deleting.value, p.id])
    try {
      await indexApi.deleteRetention(scopeOf(p), targetId(p))
      policies.value = policies.value.filter(x => x.id !== p.id)
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed' })
    } finally {
      deleting.value = new Set([...deleting.value].filter(id => id !== p.id))
    }
  })
}

// ── Set policy form (PUT upserts, so create and edit are the same call) ───────

const types = ref<TypeResponse[]>([])

const form = reactive({
  scope:        'types' as Scope,
  typeId:       null as number | null,
  artifactName: '',
  keepLast:     '' as string | number,
  maxAgeDays:   '' as string | number,
})
const saving    = ref(false)
const formError = ref('')

const artifactMatches = ref<Artifact[]>([])
let searchTimer: ReturnType<typeof setTimeout> | null = null

function onArtifactInput(value: string) {
  form.artifactName = value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    if (!value.trim()) { artifactMatches.value = []; return }
    try { artifactMatches.value = (await indexApi.listArtifacts({ name: value.trim(), pageSize: 8 })).items ?? [] }
    catch { artifactMatches.value = [] }
  }, 300)
}

const existingTypePolicy = computed(() =>
  form.scope === 'types' && form.typeId !== null
    ? policies.value.find(p => p.typeId === form.typeId) ?? null
    : null)

async function resolveArtifactId(name: string): Promise<number | null> {
  const known = artifactMatches.value.find(a => a.fullName === name)
  if (known) return known.id
  const page = await indexApi.listArtifacts({ name, pageSize: 20 })
  return (page.items ?? []).find(a => a.fullName === name)?.id ?? null
}

async function savePolicy() {
  formError.value = ''
  const rule = parseRetentionInput(form.keepLast, form.maxAgeDays)
  if (typeof rule === 'string') { formError.value = rule; return }

  saving.value = true
  try {
    let id: number | null
    if (form.scope === 'types') {
      id = form.typeId
      if (id === null) { formError.value = 'Pick a type'; return }
    } else {
      const name = form.artifactName.trim()
      if (!name) { formError.value = 'Enter an artifact name'; return }
      id = await resolveArtifactId(name)
      if (id === null) { formError.value = `No artifact named "${name}"`; return }
    }
    await indexApi.setRetention(form.scope, id, rule)
    $q.notify({ type: 'positive', message: 'Retention policy saved' })
    resetForm()
    await loadPolicies()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Save failed'
  } finally { saving.value = false }
}

function editPolicy(p: RetentionPolicy) {
  form.scope        = scopeOf(p)
  form.typeId       = p.typeId
  form.artifactName = p.artifactName ?? ''
  form.keepLast     = p.keepLast ?? ''
  form.maxAgeDays   = p.maxAgeDays ?? ''
  formError.value   = ''
}

function resetForm() {
  Object.assign(form, { typeId: null, artifactName: '', keepLast: '', maxAgeDays: '' })
  formError.value = ''
}

onMounted(async () => {
  loadPolicies()
  try { types.value = await indexApi.listTypes() ?? [] } catch { types.value = [] }
})
</script>

<template>
  <div class="page-grid">

    <!-- ── Policies ──────────────────────────────────────────────────────────── -->
    <CanvasPanel
      title="Retention Policies"
      icon="mdi-calendar-clock-outline"
      :wide="true"
      :loading="loading"
      :error="error ?? undefined"
      @refresh="loadPolicies"
    >
      <template #actions>
        <span class="section-hint">{{ policies.length }} policies</span>
      </template>

      <div class="result-bar result-bar--warn">
        <q-icon name="mdi-information-outline" size="14px" />
        Policies are stored only — fusion-index does not apply them. Use
        <router-link to="/admin/version-pruning">Version Pruning</router-link> to delete versions.
        An artifact's own policy overrides those of its types; with several type policies the most conservative value wins.
      </div>

      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr>
            <th>Scope</th><th>Target</th><th>Keep last</th><th>Max age</th><th>Matches</th><th>Updated</th><th></th>
          </tr></thead>
          <tbody>
            <tr v-for="p in policies" :key="p.id">
              <td><span class="scope-chip" :class="`scope-chip--${scopeOf(p)}`">{{ scopeOf(p) === 'types' ? 'Type' : 'Artifact' }}</span></td>
              <td class="col-name fs-mono">
                <router-link v-if="p.artifactId !== null" :to="`/fusion-index/artifacts/${p.artifactId}`">{{ targetName(p) }}</router-link>
                <template v-else>{{ targetName(p) }}</template>
              </td>
              <td class="fs-mono">{{ p.keepLast ?? '—' }}</td>
              <td class="fs-mono">{{ p.maxAgeDays ? `${p.maxAgeDays} d` : '—' }}</td>
              <td class="col-muted">{{ describeRetention(p) }}</td>
              <td class="col-muted">{{ formatDate(p.updatedAt) }}</td>
              <td class="col-actions">
                <template v-if="can('index:retention:manage', p.artifactId ?? undefined)">
                  <button class="icon-btn icon-btn--edit" title="Edit" @click="editPolicy(p)">
                    <q-icon name="mdi-pencil-outline" size="15px" />
                  </button>
                  <button class="icon-btn" title="Delete" :disabled="deleting.has(p.id)" @click="removePolicy(p)">
                    <q-icon name="mdi-delete-outline" size="15px" />
                  </button>
                </template>
              </td>
            </tr>
            <tr v-if="!loading && policies.length === 0">
              <td colspan="7" class="empty-row">No retention policies yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </CanvasPanel>

    <!-- ── Set policy ────────────────────────────────────────────────────────── -->
    <CanvasPanel v-if="can('index:retention:manage')" title="Set Policy" icon="mdi-calendar-edit" :wide="true" @refresh="resetForm">
      <div class="set-form">
        <label class="form-row">
          <span class="form-label">Scope</span>
          <select v-model="form.scope" class="fs-field">
            <option value="types">Artifact type</option>
            <option value="artifacts">Single artifact</option>
          </select>
        </label>
        <label v-if="form.scope === 'types'" class="form-row">
          <span class="form-label">Type</span>
          <select v-model="form.typeId" class="fs-field">
            <option :value="null" disabled>Select a type…</option>
            <option v-for="t in types" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </label>
        <label v-else class="form-row">
          <span class="form-label">Artifact</span>
          <input
            :value="form.artifactName"
            list="retention-artifact-list"
            class="fs-field fs-mono"
            placeholder="org.myteam.myapp"
            @input="onArtifactInput(($event.target as HTMLInputElement).value)"
          />
          <datalist id="retention-artifact-list">
            <option v-for="a in artifactMatches" :key="a.id" :value="a.fullName" />
          </datalist>
        </label>
        <label class="form-row">
          <span class="form-label">Keep last</span>
          <input v-model="form.keepLast" type="number" min="1" class="fs-field" placeholder="—" />
        </label>
        <label class="form-row">
          <span class="form-label">Max age (days)</span>
          <input v-model="form.maxAgeDays" type="number" min="1" class="fs-field" placeholder="—" />
        </label>
      </div>

      <div class="form-actions">
        <span v-if="formError" class="form-error">{{ formError }}</span>
        <span v-else-if="existingTypePolicy" class="form-help">This type already has a policy — saving replaces it.</span>
        <span v-else class="form-help">A rule matches versions outside the newest "keep last" AND older than "max age"; an empty field adds no constraint.</span>
        <button class="fs-btn" @click="resetForm">Clear</button>
        <button class="fs-btn fs-btn--primary" :disabled="saving" @click="savePolicy">
          <q-icon name="mdi-content-save-outline" size="14px" />
          Save Policy
        </button>
      </div>
    </CanvasPanel>

  </div>
</template>

<style scoped lang="scss">
@use '@/css/admin-page';

.result-bar--warn {
  line-height: 1.6;
  .q-icon { margin-right: 4px; vertical-align: -2px; }
  a { color: var(--fs-accent); }
}

.col-actions { width: 70px; text-align: right; white-space: nowrap; }
.icon-btn--edit:hover:not(:disabled) { color: var(--fs-accent); }

.scope-chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 10.5px;
  font-weight: 600;
  border: 1px solid currentColor;
}
.scope-chip--types     { color: var(--fs-accent); }
.scope-chip--artifacts { color: var(--fs-warn, #f59e0b); }

.set-form {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px 18px;
}
.form-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  align-items: center;
  gap: 8px;
}
.form-label { font-size: 12px; color: var(--fs-text-muted); }
.form-row .fs-field { width: 100%; min-width: 0; }
.form-help  { font-size: 11px; color: var(--fs-text-muted); margin-right: auto; }
.form-error { font-size: 12px; color: var(--fs-neg, #e57373); margin-right: auto; }

.form-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}
</style>
