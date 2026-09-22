// Optional per-definition, per-parameter display overrides for WizardRunPage.vue's generic form.
// A parameter with no entry here (or a definition with no entry at all) still renders fine —
// WizardRunPage falls back to a title-cased field name and the definition's own
// WizardParameter.description as the field hint. Only add an entry when the auto-generated
// rendering genuinely needs help: a friendlier label, a non-text widget (select/cron/tags), or a
// field that should only show conditionally on another field's value (showIf).

export type WizardFieldWidget = 'text' | 'select' | 'cron' | 'tags' | 'checkbox'

export interface WizardFieldOption {
  label: string
  value: string
}

export interface WizardFieldDisplayMeta {
  label?:       string
  help?:        string
  placeholder?: string
  widget?:      WizardFieldWidget
  options?:     WizardFieldOption[]
  // Hide this field unless another field in the same form currently equals this value.
  showIf?:      { field: string, equals: string }
}

export const wizardDisplayMeta: Record<string, Record<string, WizardFieldDisplayMeta>> = {
  'batch-git-job': {
    jobName: {
      label: 'Job Name',
      placeholder: 'my-batch-job',
      help: 'Shared Kubernetes name for the watcher, chain, and job blueprint',
    },
    repoUrl: {
      label: 'Repo URL',
      placeholder: 'https://github.com/org/repo',
      help: 'Public HTTP(S) git URL',
    },
    repoRef: {
      label: 'Ref',
      placeholder: 'main',
      help: 'Branch or tag to watch',
    },
    projectDir: {
      label: 'Subfolder',
      placeholder: 'services/myapp',
      help: 'Relative path containing metadata.yaml — no .. (optional)',
    },
    triggerType: {
      label: 'Trigger',
      widget: 'select',
      options: [
        { label: 'Manual',               value: 'OnDemand' },
        { label: 'Also on a schedule',   value: 'Cron' },
      ],
      help: 'The batch always starts once immediately — this only controls future runs',
    },
    schedule: {
      label: 'Schedule',
      widget: 'cron',
      showIf: { field: 'triggerType', equals: 'Cron' },
    },
  },
}
