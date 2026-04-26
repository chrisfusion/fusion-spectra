<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import { bffAdminApi } from '@/api/bffAdminApi'
import type { ResourcePermission, RBACConfigResponse } from '@/api/bffAdminApi'

const $q = useQuasar()

// ─── Data ─────────────────────────────────────────────────────────────────────

const grants  = ref<ResourcePermission[]>([])
const loading = ref(true)
const error   = ref<string | null>(null)

const rbacConfig = ref<RBACConfigResponse>({ roles: [], groups: [], permissions: [] })

// ─── Filter ───────────────────────────────────────────────────────────────────

const filterResourceType = ref('')
const filterResourceId   = ref('')

const filtered = computed(() => {
  return grants.value.filter(g => {
    if (filterResourceType.value && g.resource_type !== filterResourceType.value) return false
    if (filterResourceId.value && !g.resource_id.includes(filterResourceId.value)) return false
    return true
  })
})

// ─── Create form ──────────────────────────────────────────────────────────────

const adding = ref(false)
const form = ref({
  subject_type:  'group' as 'user' | 'group' | 'role',
  subject:       '',
  permission:    '',
  resource_type: 'artifact',
  resource_id:   '',
})
const creating    = ref(false)
const createError = ref('')

const subjectOptions = computed(() => {
  if (form.value.subject_type === 'role')  return rbacConfig.value.roles
  if (form.value.subject_type === 'group') return rbacConfig.value.groups
  return []
})

const resourceTypes = ['artifact', 'venv']

function startAdd() {
  adding.value      = true
  createError.value = ''
  form.value = { subject_type: 'group', subject: '', permission: '', resource_type: 'artifact', resource_id: '' }
}

function cancelAdd() {
  adding.value      = false
  createError.value = ''
}

async function confirmAdd() {
  if (!form.value.subject || !form.value.permission || !form.value.resource_id.trim()) {
    createError.value = 'All fields are required'
    return
  }
  creating.value    = true
  createError.value = ''
  try {
    const created = await bffAdminApi.createResourcePermission({
      subject_type:  form.value.subject_type,
      subject:       form.value.subject.trim(),
      permission:    form.value.permission,
      resource_type: form.value.resource_type,
      resource_id:   form.value.resource_id.trim(),
    })
    grants.value = [created, ...grants.value]
    adding.value = false
  } catch (e: unknown) {
    const status = (e as { status?: number }).status
    createError.value = status === 409
      ? 'Grant already exists'
      : e instanceof Error ? e.message : 'Failed to create grant'
  } finally {
    creating.value = false
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

const deleting = ref<Set<number>>(new Set())

function confirmDelete(g: ResourcePermission) {
  $q.dialog({
    title: 'Remove grant',
    message: `Remove <b>${g.permission}</b> on ${g.resource_type} <b>${g.resource_id}</b> from ${g.subject_type} <b>${g.subject}</b>?`,
    html: true,
    ok:     { label: 'Remove', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    deleting.value = new Set([...deleting.value, g.id])
    try {
      await bffAdminApi.deleteResourcePermission(g.id)
      grants.value = grants.value.filter(x => x.id !== g.id)
    } catch (e) {
      $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Failed to remove grant' })
    } finally {
      deleting.value = new Set([...deleting.value].filter(id => id !== g.id))
    }
  })
}

// ─── Load ─────────────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value   = null
  try {
    const [g, cfg] = await Promise.all([
      bffAdminApi.listResourcePermissions(),
      bffAdminApi.getRBACConfig(),
    ])
    grants.value     = g
    rbacConfig.value = cfg
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function subjectTypeBadge(t: string) {
  if (t === 'user')  return 'fs-badge--accent'
  if (t === 'role')  return 'fs-badge--warn'
  return 'fs-badge--info'
}
</script>

<template>
  <div class="page-grid">
    <CanvasPanel
      title="Resource Permissions"
      icon="mdi-key-chain-variant"
      :wide="true"
      :loading="loading"
      :error="error"
      @refresh="load"
    >
      <template #actions>
        <button v-if="!adding" class="action-btn" @click="startAdd">
          <q-icon name="mdi-plus" size="13px" />
          Add Grant
        </button>
      </template>

      <!-- Filter bar -->
      <div class="filter-bar">
        <select v-model="filterResourceType" class="filter-select">
          <option value="">All resource types</option>
          <option v-for="rt in resourceTypes" :key="rt" :value="rt">{{ rt }}</option>
        </select>
        <input v-model="filterResourceId" class="filter-input" placeholder="Filter by resource ID…" />
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 80px">Type</th>
            <th style="width: 160px">Subject</th>
            <th>Permission</th>
            <th style="width: 90px">Resource</th>
            <th style="width: 120px">Resource ID</th>
            <th style="width: 130px">Created By</th>
            <th style="width: 40px"></th>
          </tr>
        </thead>
        <tbody>

          <!-- Create row -->
          <tr v-if="adding" class="edit-row">
            <td>
              <select v-model="form.subject_type" class="inline-select" :disabled="creating"
                @change="form.subject = ''">
                <option value="group">group</option>
                <option value="role">role</option>
                <option value="user">user</option>
              </select>
            </td>
            <td>
              <select v-if="form.subject_type !== 'user'" v-model="form.subject"
                class="inline-select" :disabled="creating">
                <option value="" disabled>— select —</option>
                <option v-for="s in subjectOptions" :key="s" :value="s">{{ s }}</option>
              </select>
              <input v-else v-model="form.subject" class="inline-input fs-mono"
                placeholder="user sub" :disabled="creating" />
            </td>
            <td>
              <select v-model="form.permission" class="inline-select" :disabled="creating">
                <option value="" disabled>— select —</option>
                <option v-for="p in rbacConfig.permissions" :key="p" :value="p">{{ p }}</option>
              </select>
            </td>
            <td>
              <select v-model="form.resource_type" class="inline-select" :disabled="creating">
                <option v-for="rt in resourceTypes" :key="rt" :value="rt">{{ rt }}</option>
              </select>
            </td>
            <td>
              <input v-model="form.resource_id" class="inline-input fs-mono"
                placeholder="ID" :disabled="creating" @keydown.enter="confirmAdd" @keydown.escape="cancelAdd" />
            </td>
            <td colspan="2" class="row-actions">
              <span v-if="createError" class="row-error">{{ createError }}</span>
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
          <tr v-if="!adding && filtered.length === 0">
            <td colspan="7" class="empty-row">No resource grants defined yet</td>
          </tr>

          <!-- Grant rows -->
          <tr v-for="g in filtered" :key="g.id">
            <td>
              <span class="fs-badge" :class="subjectTypeBadge(g.subject_type)">{{ g.subject_type }}</span>
            </td>
            <td class="fs-mono muted-text">{{ g.subject }}</td>
            <td class="perm-cell">{{ g.permission }}</td>
            <td class="muted-text">{{ g.resource_type }}</td>
            <td class="fs-mono">{{ g.resource_id }}</td>
            <td class="muted-text">{{ g.created_by || '—' }}</td>
            <td class="row-actions">
              <button class="icon-btn icon-btn--danger" :disabled="deleting.has(g.id)"
                title="Remove" @click="confirmDelete(g)">
                <q-spinner v-if="deleting.has(g.id)" size="11px" />
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

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.filter-select,
.filter-input {
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border);
  border-radius: 3px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--fs-text-primary);
  outline: none;
  font-family: inherit;
}
.filter-select { min-width: 140px; }
.filter-input  { flex: 1; }

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
.perm-cell  { font-size: 11.5px; font-family: var(--fs-font-mono, monospace); color: var(--fs-accent); }

.inline-input,
.inline-select {
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
.inline-input:disabled,
.inline-select:disabled { opacity: 0.5; }

.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
  white-space: nowrap;
}
.row-error {
  font-size: 10.5px;
  color: var(--fs-neg, #e57373);
  margin-right: 4px;
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
