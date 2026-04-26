<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { bffAdminApi } from '@/api/bffAdminApi'
import type { GroupRoleAssignment } from '@/api/bffAdminApi'
import { usePermission } from '@/composables/usePermission'

const $q = useQuasar()
const { can } = usePermission()

const ROLES = ['admin', 'engineer', 'viewer']

const assignments  = ref<GroupRoleAssignment[]>([])
const loading      = ref(true)
const loadError    = ref<string | null>(null)

// create form
const adding      = ref(false)
const newGroup    = ref('')
const newRole     = ref(ROLES[0])
const newGroupRef = ref<HTMLInputElement | null>(null)
const creating    = ref(false)
const createError = ref('')

// delete
const deleting = ref<Set<number>>(new Set())

async function load() {
  loading.value   = true
  loadError.value = null
  try {
    assignments.value = await bffAdminApi.listGroupRoles()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load assignments'
  } finally {
    loading.value = false
  }
}

function startAdd() {
  adding.value      = true
  newGroup.value    = ''
  newRole.value     = ROLES[0]
  createError.value = ''
  nextTick(() => newGroupRef.value?.focus())
}

function cancelAdd() {
  adding.value      = false
  createError.value = ''
}

async function confirmAdd() {
  const group = newGroup.value.trim()
  if (!group) { createError.value = 'Group name is required'; return }
  creating.value    = true
  createError.value = ''
  try {
    const created = await bffAdminApi.createGroupRole(group, newRole.value)
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

function confirmDelete(a: GroupRoleAssignment) {
  $q.dialog({
    title: 'Remove assignment',
    message: `Remove <b>${a.group_name} → ${a.role_name}</b>?`,
    html: true,
    ok:     { label: 'Remove', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deleting.value = new Set([...deleting.value, a.id])
    try {
      await bffAdminApi.deleteGroupRole(a.id)
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
  <div class="page-grid">
    <CanvasPanel
      title="Role Assignments"
      icon="mdi-shield-account-outline"
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

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 220px">Group</th>
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
                ref="newGroupRef"
                v-model="newGroup"
                class="inline-input fs-mono"
                placeholder="keycloak-group-name"
                maxlength="255"
                :disabled="creating"
                @keydown.enter="confirmAdd"
                @keydown.escape="cancelAdd"
              />
              <span v-if="createError" class="row-error">{{ createError }}</span>
            </td>
            <td>
              <select v-model="newRole" class="inline-input" :disabled="creating">
                <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
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
            <td colspan="5" class="empty-row">No assignments yet — all roles come from rbac.yaml</td>
          </tr>

          <!-- Assignment rows -->
          <tr v-for="a in assignments" :key="a.id">
            <td class="fs-mono">{{ a.group_name }}</td>
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
