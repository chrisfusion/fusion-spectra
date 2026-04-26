<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as indexApi from '@/api/indexApi'
import type { TypeResponse } from '@/api/indexApi'

const $q = useQuasar()

// ─── Placeholder data (Users / Services / Config) ─────────────────────────────

const users = [
  { name: 'Jane Doe',    email: 'jane@fusion.local',    role: 'Admin',    status: 'active',   last: '2 min ago' },
  { name: 'Bob Smith',   email: 'bob@fusion.local',     role: 'Analyst',  status: 'active',   last: '1 hr ago' },
  { name: 'Carol Wang',  email: 'carol@fusion.local',   role: 'Engineer', status: 'active',   last: '3 hr ago' },
  { name: 'Dave Kumar',  email: 'dave@fusion.local',    role: 'Analyst',  status: 'inactive', last: '2 days ago' },
  { name: 'Eve Torres',  email: 'eve@fusion.local',     role: 'Engineer', status: 'active',   last: '30 min ago' },
]

const services = [
  { name: 'fusion-spectra',  version: '0.3.1', health: 'ok',      replicas: '1/1' },
  { name: 'fusion-forge',    version: '1.2.0', health: 'ok',      replicas: '1/1' },
  { name: 'fusion-index',    version: '0.9.2', health: 'ok',      replicas: '2/2' },
  { name: 'fusion-etl',      version: '2.0.4', health: 'pending', replicas: '0/1' },
  { name: 'keycloak',        version: '24.0',  health: 'ok',      replicas: '1/1' },
  { name: 'postgresql',      version: '16.2',  health: 'ok',      replicas: '1/1' },
]

const roleVariant: Record<string, string> = { Admin: 'warn', Analyst: 'info', Engineer: 'accent' }

// ─── Types ─────────────────────────────────────────────────────────────────────

const types        = ref<TypeResponse[]>([])
const typesLoading = ref(true)
const typesError   = ref<string | null>(null)

// create form
const adding     = ref(false)
const newName    = ref('')
const newDesc    = ref('')
const newNameRef = ref<HTMLInputElement | null>(null)
const creating   = ref(false)
const createError = ref('')

// inline edit
const editingId  = ref<number | null>(null)
const editName   = ref('')
const editDesc   = ref('')
const editNameRef = ref<HTMLInputElement | null>(null)
const saving     = ref(false)
const editError  = ref('')

// delete
const deleting = ref<Set<number>>(new Set())

async function loadTypes() {
  typesLoading.value = true
  typesError.value   = null
  try {
    types.value = await indexApi.listTypes()
  } catch (e) {
    typesError.value = e instanceof Error ? e.message : 'Failed to load types'
  } finally {
    typesLoading.value = false
  }
}

function startAdd() {
  adding.value     = true
  newName.value    = ''
  newDesc.value    = ''
  createError.value = ''
  nextTick(() => newNameRef.value?.focus())
}

function cancelAdd() {
  adding.value      = false
  createError.value = ''
}

async function confirmAdd() {
  const name = newName.value.trim()
  if (!name) { createError.value = 'Name is required'; return }
  creating.value    = true
  createError.value = ''
  try {
    const created = await indexApi.createType({
      name,
      description: newDesc.value.trim() || undefined,
    })
    types.value = [created, ...types.value]
    adding.value = false
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Failed to create type'
  } finally {
    creating.value = false
  }
}

function startEdit(t: TypeResponse) {
  editingId.value  = t.id
  editName.value   = t.name
  editDesc.value   = t.description ?? ''
  editError.value  = ''
  nextTick(() => editNameRef.value?.focus())
}

function cancelEdit() {
  editingId.value = null
  editError.value = ''
}

async function confirmEdit() {
  const name = editName.value.trim()
  if (!name) { editError.value = 'Name is required'; return }
  saving.value    = true
  editError.value = ''
  try {
    const updated = await indexApi.updateType(editingId.value!, {
      name,
      description: editDesc.value.trim() || undefined,
    })
    const idx = types.value.findIndex(t => t.id === updated.id)
    if (idx !== -1) types.value[idx] = updated
    editingId.value = null
  } catch (e) {
    editError.value = e instanceof Error ? e.message : 'Failed to update type'
  } finally {
    saving.value = false
  }
}

function confirmDelete(t: TypeResponse) {
  $q.dialog({
    title: 'Delete type',
    message: `Delete type <b>${t.name}</b>? This will remove it from all artifacts.`,
    html: true,
    ok:     { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deleting.value = new Set([...deleting.value, t.id])
    try {
      await indexApi.deleteType(t.id)
      types.value = types.value.filter(x => x.id !== t.id)
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Failed to delete type' })
    } finally {
      deleting.value = new Set([...deleting.value].filter(id => id !== t.id))
    }
  })
}

onMounted(loadTypes)
</script>

<template>
  <div class="page-grid">

    <!-- ── Platform panels ─────────────────────────────────────────────────── -->

    <!-- Users panel -->
    <CanvasPanel title="Users" icon="mdi-account-group-outline" :wide="true">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Active</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.email">
            <td>
              <div class="user-cell">
                <div class="user-cell__avatar">{{ u.name.split(' ').map(w => w[0]).join('') }}</div>
                <span>{{ u.name }}</span>
              </div>
            </td>
            <td class="fs-mono muted-text">{{ u.email }}</td>
            <td><span class="fs-badge" :class="`fs-badge--${roleVariant[u.role]}`">{{ u.role }}</span></td>
            <td>
              <span class="status-row">
                <span class="fs-dot" :class="u.status === 'active' ? 'fs-dot--ok' : 'fs-dot--idle'" />
                {{ u.status }}
              </span>
            </td>
            <td class="muted-text">{{ u.last }}</td>
          </tr>
        </tbody>
      </table>
    </CanvasPanel>

    <!-- Platform services -->
    <CanvasPanel title="Platform Services" icon="mdi-server-network-outline">
      <div class="services-list">
        <div v-for="s in services" :key="s.name" class="service-item">
          <span class="fs-dot" :class="`fs-dot--${s.health}`" />
          <span class="service-item__name fs-mono">{{ s.name }}</span>
          <span class="fs-badge fs-badge--accent fs-mono">{{ s.version }}</span>
          <span class="service-item__replicas fs-mono muted-text">{{ s.replicas }}</span>
        </div>
      </div>
    </CanvasPanel>

    <!-- System config -->
    <CanvasPanel title="System Config" icon="mdi-tune">
      <div class="config-list">
        <div class="config-item">
          <span class="config-item__key fs-mono muted-text">AUTH_MODE</span>
          <span class="config-item__val fs-mono">bypass</span>
        </div>
        <div class="config-item">
          <span class="config-item__key fs-mono muted-text">NAMESPACE</span>
          <span class="config-item__val fs-mono">fusion</span>
        </div>
        <div class="config-item">
          <span class="config-item__key fs-mono muted-text">INGRESS_HOST</span>
          <span class="config-item__val fs-mono">spectra.fusion.local</span>
        </div>
        <div class="config-item">
          <span class="config-item__key fs-mono muted-text">CLUSTER</span>
          <span class="config-item__val fs-mono">minikube</span>
        </div>
        <div class="config-item">
          <span class="config-item__key fs-mono muted-text">LOG_LEVEL</span>
          <span class="config-item__val fs-mono">INFO</span>
        </div>
        <div class="config-item">
          <span class="config-item__key fs-mono muted-text">FEDERATION</span>
          <span class="fs-badge fs-badge--warn">disabled</span>
        </div>
      </div>
    </CanvasPanel>

    <!-- ── Global Settings ─────────────────────────────────────────────────── -->

    <div class="section-header">
      <q-icon name="mdi-earth" size="15px" class="section-header__icon" />
      Global Settings
    </div>

    <!-- Artifact Types -->
    <CanvasPanel
      title="Artifact Types"
      icon="mdi-tag-multiple-outline"
      :wide="true"
      :loading="typesLoading"
      :error="typesError"
      @refresh="loadTypes"
    >
      <template #actions>
        <button v-if="!adding" class="action-btn" @click="startAdd">
          <q-icon name="mdi-plus" size="13px" />
          Add Type
        </button>
      </template>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 200px">Name</th>
            <th>Description</th>
            <th style="width: 80px"></th>
          </tr>
        </thead>
        <tbody>

          <!-- Inline create row -->
          <tr v-if="adding" class="edit-row">
            <td>
              <input
                ref="newNameRef"
                v-model="newName"
                class="inline-input fs-mono"
                placeholder="type-name"
                maxlength="255"
                :disabled="creating"
                @keydown.enter="confirmAdd"
                @keydown.escape="cancelAdd"
              />
              <span v-if="createError" class="row-error">{{ createError }}</span>
            </td>
            <td>
              <input
                v-model="newDesc"
                class="inline-input"
                placeholder="Optional description"
                maxlength="2000"
                :disabled="creating"
                @keydown.enter="confirmAdd"
                @keydown.escape="cancelAdd"
              />
            </td>
            <td class="row-actions">
              <button class="icon-btn icon-btn--ok" :disabled="creating" title="Save" @click="confirmAdd">
                <q-spinner v-if="creating" size="11px" />
                <q-icon v-else name="mdi-check" size="13px" />
              </button>
              <button class="icon-btn" :disabled="creating" title="Cancel" @click="cancelAdd">
                <q-icon name="mdi-close" size="13px" />
              </button>
            </td>
          </tr>

          <!-- Empty state -->
          <tr v-if="!adding && types.length === 0">
            <td colspan="3" class="empty-row">No types defined yet</td>
          </tr>

          <!-- Type rows -->
          <tr v-for="t in types" :key="t.id">

            <!-- Editing this row -->
            <template v-if="editingId === t.id">
              <td>
                <input
                  ref="editNameRef"
                  v-model="editName"
                  class="inline-input fs-mono"
                  maxlength="255"
                  :disabled="saving"
                  @keydown.enter="confirmEdit"
                  @keydown.escape="cancelEdit"
                />
                <span v-if="editError" class="row-error">{{ editError }}</span>
              </td>
              <td>
                <input
                  v-model="editDesc"
                  class="inline-input"
                  placeholder="Optional description"
                  maxlength="2000"
                  :disabled="saving"
                  @keydown.enter="confirmEdit"
                  @keydown.escape="cancelEdit"
                />
              </td>
              <td class="row-actions">
                <button class="icon-btn icon-btn--ok" :disabled="saving" title="Save" @click="confirmEdit">
                  <q-spinner v-if="saving" size="11px" />
                  <q-icon v-else name="mdi-check" size="13px" />
                </button>
                <button class="icon-btn" :disabled="saving" title="Cancel" @click="cancelEdit">
                  <q-icon name="mdi-close" size="13px" />
                </button>
              </td>
            </template>

            <!-- Display row -->
            <template v-else>
              <td>
                <span class="fs-badge fs-badge--info fs-mono">{{ t.name }}</span>
              </td>
              <td class="muted-text desc-cell">{{ t.description ?? '—' }}</td>
              <td class="row-actions">
                <button
                  class="icon-btn"
                  :disabled="deleting.has(t.id)"
                  title="Edit"
                  @click="startEdit(t)"
                >
                  <q-icon name="mdi-pencil-outline" size="13px" />
                </button>
                <button
                  class="icon-btn icon-btn--danger"
                  :disabled="deleting.has(t.id)"
                  title="Delete"
                  @click="confirmDelete(t)"
                >
                  <q-spinner v-if="deleting.has(t.id)" size="11px" />
                  <q-icon v-else name="mdi-trash-can-outline" size="13px" />
                </button>
              </td>
            </template>

          </tr>
        </tbody>
      </table>
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

/* Section header spanning both columns */
.section-header {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 18px 2px 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.section-header__icon { color: var(--fs-accent); opacity: 0.7; }

/* Tables */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.data-table th {
  text-align: left;
  padding: 0 10px 8px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.data-table td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--fs-border-dim);
  color: var(--fs-text-primary);
  vertical-align: middle;
}
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td      { background: var(--fs-bg-hover); }
.data-table .edit-row td     { background: var(--fs-bg-hover); }

.muted-text  { color: var(--fs-text-muted) !important; font-size: 11.5px; }
.status-row  { display: flex; align-items: center; gap: 5px; color: var(--fs-text-secondary); text-transform: capitalize; }
.empty-row   { color: var(--fs-text-muted); font-size: 12px; padding: 24px 10px !important; text-align: center; }

.user-cell { display: flex; align-items: center; gap: 8px; }
.user-cell__avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--fs-violet), var(--fs-cyan));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

/* Services */
.services-list { display: flex; flex-direction: column; gap: 4px; }
.service-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 6px;
  border-radius: 3px;
  transition: background var(--fs-ease);
}
.service-item:hover { background: var(--fs-bg-hover); }
.service-item__name     { flex: 1; font-size: 12px; color: var(--fs-text-primary); }
.service-item__replicas { font-size: 11px; }

/* Config */
.config-list { display: flex; flex-direction: column; }
.config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 6px;
  border-bottom: 1px solid var(--fs-border-dim);
  font-size: 12px;
}
.config-item:last-child { border-bottom: none; }
.config-item__key { font-size: 11.5px; }
.config-item__val { color: var(--fs-accent); font-size: 12px; }

/* Types panel */
.desc-cell { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.inline-input {
  width: 100%;
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-accent);
  border-radius: 3px;
  padding: 4px 7px;
  font-size: 12px;
  color: var(--fs-text-primary);
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
}
.inline-input:disabled { opacity: 0.5; }

.row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  justify-content: flex-end;
  white-space: nowrap;
}

.row-error {
  display: block;
  font-size: 10.5px;
  color: var(--fs-neg, #e57373);
  margin-top: 3px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  color: var(--fs-text-muted);
  transition: background var(--fs-ease), color var(--fs-ease);
  flex-shrink: 0;
}
.icon-btn:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.icon-btn--ok:hover:not(:disabled) {
  color: var(--fs-pos, #4caf50);
  background: color-mix(in srgb, var(--fs-pos, #4caf50) 10%, transparent);
}
.icon-btn--danger:hover:not(:disabled) {
  color: var(--fs-neg, #e57373);
  background: color-mix(in srgb, var(--fs-neg, #e57373) 8%, transparent);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 11.5px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  color: var(--fs-accent);
  background: none;
  border: 1px solid var(--fs-border-bright);
  transition: background var(--fs-ease), border-color var(--fs-ease);
  white-space: nowrap;
}
.action-btn:hover {
  background: var(--fs-bg-hover);
  border-color: var(--fs-accent);
}
</style>
