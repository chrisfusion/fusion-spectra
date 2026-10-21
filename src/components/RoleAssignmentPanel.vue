<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { usePermission } from '@/composables/usePermission'
import { escapeHtml } from '@/utils/format'

// One role assignment, normalised so the same table serves group → role and
// user (OIDC sub) → role assignments.
export interface RoleAssignmentRow {
  id: number
  subject: string
  role_name: string
  created_by: string
  created_at: string
}

export interface RoleAssignmentApi {
  list(): Promise<RoleAssignmentRow[]>
  create(subject: string, role: string): Promise<RoleAssignmentRow>
  remove(id: number): Promise<void>
}

const props = defineProps<{
  title: string
  icon: string
  subjectLabel: string
  placeholder: string
  emptyText: string
  hint?: string
  roles: string[]
  api: RoleAssignmentApi
}>()

const $q = useQuasar()
const { can } = usePermission()

const assignments  = ref<RoleAssignmentRow[]>([])
const loading      = ref(true)
const loadError    = ref<string | null>(null)

// create form
const adding        = ref(false)
const newSubject    = ref('')
const newRole       = ref(props.roles[0])
const newSubjectRef = ref<HTMLInputElement | null>(null)
const creating      = ref(false)
const createError   = ref('')

// delete
const deleting = ref<Set<number>>(new Set())

async function load() {
  loading.value   = true
  loadError.value = null
  try {
    assignments.value = await props.api.list()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load assignments'
  } finally {
    loading.value = false
  }
}

function startAdd() {
  adding.value      = true
  newSubject.value  = ''
  newRole.value     = props.roles[0]
  createError.value = ''
  nextTick(() => newSubjectRef.value?.focus())
}

function cancelAdd() {
  adding.value      = false
  createError.value = ''
}

async function confirmAdd() {
  const subject = newSubject.value.trim()
  if (!subject) { createError.value = `${props.subjectLabel} is required`; return }
  creating.value    = true
  createError.value = ''
  try {
    const created = await props.api.create(subject, newRole.value)
    assignments.value = [created, ...assignments.value]
    adding.value = false
  } catch (e: unknown) {
    const status = (e as { status?: number }).status
    if (status === 409) {
      createError.value = 'Assignment already exists'
    } else {
      createError.value = e instanceof Error ? e.message : 'Failed to create assignment'
    }
  } finally {
    creating.value = false
  }
}

function confirmDelete(a: RoleAssignmentRow) {
  $q.dialog({
    title: 'Remove assignment',
    message: `Remove <b>${escapeHtml(a.subject)} → ${escapeHtml(a.role_name)}</b>?`,
    html: true,
    ok:     { label: 'Remove', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deleting.value = new Set([...deleting.value, a.id])
    try {
      await props.api.remove(a.id)
      assignments.value = assignments.value.filter(x => x.id !== a.id)
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Failed to remove assignment' })
    } finally {
      deleting.value = new Set([...deleting.value].filter(id => id !== a.id))
    }
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

function roleBadge(role: string) {
  return role === 'admin' ? 'fs-badge--warn' : role === 'engineer' ? 'fs-badge--accent' : 'fs-badge--info'
}

onMounted(load)
</script>

<template>
  <CanvasPanel
    :title="title"
    :icon="icon"
    :wide="true"
    :loading="loading"
    :error="loadError"
    @refresh="load"
  >
    <template #actions>
      <button v-if="!adding && can('admin:roles:manage')" class="action-btn" @click="startAdd">
        <q-icon name="mdi-plus" size="13px" />
        Add Assignment
      </button>
    </template>

    <p v-if="hint" class="panel-hint">{{ hint }}</p>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 220px">{{ subjectLabel }}</th>
          <th style="width: 130px">Role</th>
          <th>Created By</th>
          <th style="width: 170px">Created At</th>
          <th style="width: 48px"></th>
        </tr>
      </thead>
      <tbody>

        <!-- Inline create row -->
        <tr v-if="adding" class="edit-row">
          <td>
            <input
              ref="newSubjectRef"
              v-model="newSubject"
              class="inline-input fs-mono"
              :placeholder="placeholder"
              maxlength="255"
              :disabled="creating"
              @keydown.enter="confirmAdd"
              @keydown.escape="cancelAdd"
            />
            <span v-if="createError" class="row-error">{{ createError }}</span>
          </td>
          <td>
            <select v-model="newRole" class="inline-input" :disabled="creating">
              <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
            </select>
          </td>
          <td class="muted-text">—</td>
          <td class="muted-text">—</td>
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
        <tr v-if="!adding && assignments.length === 0">
          <td colspan="5" class="empty-row">{{ emptyText }}</td>
        </tr>

        <!-- Assignment rows -->
        <tr v-for="a in assignments" :key="a.id">
          <td class="fs-mono">{{ a.subject }}</td>
          <td><span class="fs-badge" :class="roleBadge(a.role_name)">{{ a.role_name }}</span></td>
          <td class="muted-text fs-mono">{{ a.created_by || '—' }}</td>
          <td class="muted-text">{{ formatDate(a.created_at) }}</td>
          <td class="row-actions">
            <button
              v-if="can('admin:roles:manage')"
              class="icon-btn icon-btn--danger"
              :disabled="deleting.has(a.id)"
              title="Remove"
              @click="confirmDelete(a)"
            >
              <q-spinner v-if="deleting.has(a.id)" size="11px" />
              <q-icon v-else name="mdi-trash-can-outline" size="13px" />
            </button>
          </td>
        </tr>

      </tbody>
    </table>
  </CanvasPanel>
</template>

<style scoped>
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

.panel-hint {
  margin: 0 0 10px;
  font-size: 11.5px;
  color: var(--fs-text-muted);
  line-height: 1.5;
}

.muted-text { color: var(--fs-text-muted) !important; font-size: 11.5px; }
.empty-row  { color: var(--fs-text-muted); font-size: 12px; padding: 24px 10px !important; text-align: center; }

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
