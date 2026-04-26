<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as indexApi from '@/api/indexApi'
import type { TypeResponse } from '@/api/indexApi'

const $q = useQuasar()

const types        = ref<TypeResponse[]>([])
const typesLoading = ref(true)
const typesError   = ref<string | null>(null)

const adding      = ref(false)
const newName     = ref('')
const newDesc     = ref('')
const newNameRef  = ref<HTMLInputElement | null>(null)
const creating    = ref(false)
const createError = ref('')

const editingId   = ref<number | null>(null)
const editName    = ref('')
const editDesc    = ref('')
const editNameRef = ref<HTMLInputElement | null>(null)
const saving      = ref(false)
const editError   = ref('')

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
  adding.value      = true
  newName.value     = ''
  newDesc.value     = ''
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
    const created = await indexApi.createType({ name, description: newDesc.value.trim() || undefined })
    types.value = [created, ...types.value]
    adding.value = false
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Failed to create type'
  } finally {
    creating.value = false
  }
}

function startEdit(t: TypeResponse) {
  editingId.value = t.id
  editName.value  = t.name
  editDesc.value  = t.description ?? ''
  editError.value = ''
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
          <tr v-if="adding" class="edit-row">
            <td>
              <input ref="newNameRef" v-model="newName" class="inline-input fs-mono"
                placeholder="type-name" maxlength="255" :disabled="creating"
                @keydown.enter="confirmAdd" @keydown.escape="cancelAdd" />
              <span v-if="createError" class="row-error">{{ createError }}</span>
            </td>
            <td>
              <input v-model="newDesc" class="inline-input" placeholder="Optional description"
                maxlength="2000" :disabled="creating"
                @keydown.enter="confirmAdd" @keydown.escape="cancelAdd" />
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

          <tr v-if="!adding && types.length === 0">
            <td colspan="3" class="empty-row">No types defined yet</td>
          </tr>

          <tr v-for="t in types" :key="t.id">
            <template v-if="editingId === t.id">
              <td>
                <input ref="editNameRef" v-model="editName" class="inline-input fs-mono"
                  maxlength="255" :disabled="saving"
                  @keydown.enter="confirmEdit" @keydown.escape="cancelEdit" />
                <span v-if="editError" class="row-error">{{ editError }}</span>
              </td>
              <td>
                <input v-model="editDesc" class="inline-input" placeholder="Optional description"
                  maxlength="2000" :disabled="saving"
                  @keydown.enter="confirmEdit" @keydown.escape="cancelEdit" />
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
            <template v-else>
              <td><span class="fs-badge fs-badge--info fs-mono">{{ t.name }}</span></td>
              <td class="muted-text desc-cell">{{ t.description ?? '—' }}</td>
              <td class="row-actions">
                <button class="icon-btn" :disabled="deleting.has(t.id)" title="Edit" @click="startEdit(t)">
                  <q-icon name="mdi-pencil-outline" size="13px" />
                </button>
                <button class="icon-btn icon-btn--danger" :disabled="deleting.has(t.id)" title="Delete" @click="confirmDelete(t)">
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
.desc-cell  { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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
