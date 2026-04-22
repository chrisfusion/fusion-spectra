<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { defaultKeymap, historyKeymap, history, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, HighlightStyle, indentOnInput } from '@codemirror/language'
import { linter } from '@codemirror/lint'
import { tags } from '@lezer/highlight'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  minHeight?: string
  maxHeight?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'valid': [valid: boolean]
}>()

// ─── Theme ────────────────────────────────────────────────────────────────────

const fsTheme = EditorView.theme({
  '&': {
    color:           'var(--fs-text-primary)',
    backgroundColor: 'var(--fs-bg-input, var(--fs-bg-hover))',
    border:          '1px solid var(--fs-border)',
    borderRadius:    '4px',
    fontSize:        '12.5px',
  },
  '&.cm-focused': {
    outline:     'none',
    borderColor: 'var(--fs-accent)',
    boxShadow:   '0 0 0 2px var(--fs-accent-soft)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--fs-font-mono)',
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding:    '8px 10px',
    caretColor: 'var(--fs-accent)',
    minHeight:  props.minHeight ?? '120px',
    maxHeight:  props.maxHeight ?? '320px',
  },
  '.cm-gutters':          { display: 'none' },
  '.cm-activeLine':       { backgroundColor: 'rgba(255,255,255,0.03)' },
  '.cm-cursor':           { borderLeftColor: 'var(--fs-accent)' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(99,179,237,0.2) !important' },
  '.cm-lintRange-error':  { textDecorationColor: 'var(--fs-neg, #e57373)' },
  '.cm-tooltip':          { backgroundColor: 'var(--fs-bg-surface)', border: '1px solid var(--fs-border)', borderRadius: '4px', fontSize: '11.5px', color: 'var(--fs-text-primary)' },
  '.cm-diagnostic-error': { borderLeft: '3px solid var(--fs-neg, #e57373)' },
}, { dark: true })

const fsHighlight = HighlightStyle.define([
  { tag: tags.string,       color: '#a8cc8c' },
  { tag: tags.number,       color: '#d19a66' },
  { tag: tags.bool,         color: '#c678dd' },
  { tag: tags.null,         color: '#c678dd' },
  { tag: tags.propertyName, color: '#61afef' },
  { tag: tags.punctuation,  color: 'var(--fs-text-muted)' },
  { tag: tags.bracket,      color: 'var(--fs-text-muted)' },
])

// ─── Editor lifecycle ─────────────────────────────────────────────────────────

const container = ref<HTMLElement | null>(null)
let   view: EditorView | null = null

onMounted(() => {
  const extensions = [
    history(),
    indentOnInput(),
    syntaxHighlighting(fsHighlight),
    json(),
    linter(jsonParseLinter()),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    fsTheme,
    EditorView.lineWrapping,
    EditorView.updateListener.of(update => {
      if (!update.docChanged) return
      const text = update.state.doc.toString()
      emit('update:modelValue', text)
      try { JSON.parse(text); emit('valid', true) }
      catch { emit('valid', text.trim() === '') } // empty = valid (field is optional)
    }),
  ]

  if (props.placeholder) {
    extensions.push(cmPlaceholder(props.placeholder))
  }

  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions,
    }),
    parent: container.value!,
  })
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

// Sync external modelValue changes into the editor (e.g. format button)
watch(() => props.modelValue, val => {
  if (!view || view.state.doc.toString() === val) return
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: val }
  })
})

// ─── Format button ────────────────────────────────────────────────────────────

function format() {
  if (!view) return
  try {
    const text = view.state.doc.toString()
    if (!text.trim()) return
    const formatted = JSON.stringify(JSON.parse(text), null, 2)
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: formatted }
    })
    emit('update:modelValue', formatted)
    emit('valid', true)
  } catch {
    // leave as-is; linter already shows the error
  }
}

defineExpose({ format })
</script>

<template>
  <div class="json-editor">
    <div ref="container" class="json-editor__cm" />
    <div class="json-editor__toolbar">
      <button class="json-editor__fmt-btn" type="button" @click="format">
        <span>{ }</span> Format
      </button>
    </div>
  </div>
</template>

<style scoped>
.json-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.json-editor__cm {
  border-radius: 4px;
  overflow: hidden;
}

.json-editor__toolbar {
  display: flex;
  justify-content: flex-end;
}

.json-editor__fmt-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  font-family: var(--fs-font-mono);
  color: var(--fs-text-muted);
  padding: 2px 6px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.json-editor__fmt-btn:hover {
  color: var(--fs-accent);
  background: var(--fs-bg-hover);
}
</style>
