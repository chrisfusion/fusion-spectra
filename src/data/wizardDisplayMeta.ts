// Optional per-definition, per-parameter display overrides for WizardRunPage.vue's generic form.
// A parameter with no entry here (or a definition with no entry at all) still renders fine —
// WizardRunPage falls back to a title-cased field name and the definition's own
// WizardParameter.description as the field hint. Only add an entry when the auto-generated
// rendering genuinely needs help: a friendlier label, a non-text widget (select/cron/tags), or a
// field that should only show conditionally on another field's value (showIf).

export type WizardFieldWidget = 'text' | 'textarea' | 'select' | 'cron' | 'tags' | 'checkbox' | 'objectRows' | 'externalAuthName'

export interface WizardFieldOption {
  label: string
  value: string
}

// One sub-field of an 'objectRows' entry (an objectList parameter's per-row editor), besides "key"
// (the add-new-row input — always plain text, using the parent's placeholder/pattern). Sub-field
// showIf is evaluated against the *row's own* fields, not the top-level form.
export interface WizardRowField {
  key:      string
  label?:   string
  widget?:  'text' | 'select' | 'cron'
  options?: WizardFieldOption[]
  showIf?:  { field: string, equals: string }
}

export interface WizardFieldDisplayMeta {
  label?:       string
  help?:        string
  placeholder?: string
  widget?:      WizardFieldWidget
  options?:     WizardFieldOption[]
  // Hide this field unless another field in the same form currently equals this value.
  showIf?:      { field: string, equals?: string, notEquals?: string }
  // Collapsed under an "Advanced options" toggle until the user opens it.
  advanced?:    boolean
  // widget: 'externalAuthName' only — the sibling parameter holding the mode ('serviceAccount' | 'oidc');
  // the name picker offers weave's allowlisted names for that mode.
  modeField?:   string
  // widget: 'objectRows' only — the sub-fields each row gets beyond "key".
  rowFields?:      WizardRowField[]
  keyPlaceholder?: string
}

// Optional per-definition short-title override, for the rare definition name whose auto-generated
// title-case rendering (hyphens -> spaces -> capitalize each word) doesn't read naturally —
// "batchcron-git-job" would otherwise render "Batchcron Git Job" instead of "BatchCron Git Job".
export const wizardTitleOverrides: Record<string, string> = {
  'batchcron-git-job': 'BatchCron Git Job',
}

// Optional weave externalAuthRef (short-lived SA/OIDC token injected into job pods): a mode select plus a
// name picker fed by weave's allowlist. Chain level applies to every run; the trigger-level override wins
// over it (weave applies run > trigger > chain).
const externalAuthModeOptions: WizardFieldOption[] = [
  { label: 'None',           value: '' },
  { label: 'ServiceAccount', value: 'serviceAccount' },
  { label: 'OIDC',           value: 'oidc' },
]
function externalAuthFields(prefix: 'externalAuth' | 'externalAuthOverride', label: string, help: string): Record<string, WizardFieldDisplayMeta> {
  return {
    [`${prefix}Mode`]: { label: `${label} token`, widget: 'select', options: externalAuthModeOptions, advanced: true, help },
    [`${prefix}Name`]: {
      label: `${label} token name`, widget: 'externalAuthName', modeField: `${prefix}Mode`, advanced: true,
      showIf: { field: `${prefix}Mode`, notEquals: '' },
    },
  }
}
const chainAuth = externalAuthFields('externalAuth', 'Job',
  'Inject a short-lived token into the job pods (ServiceAccount or OIDC)')
const triggerAuth = externalAuthFields('externalAuthOverride', 'Trigger override',
  'Overrides the job token above for runs started by these triggers')

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
    ...chainAuth,
    ...triggerAuth,
  },
  'batchcron-git-job': {
    jobName: {
      label: 'Job Name',
      placeholder: 'my-batchcron-job',
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
      placeholder: 'jobs/myjob',
      help: 'Relative path containing metadata.yaml — no .. (optional)',
    },
    jobs: {
      label: 'Jobs Config',
      widget: 'textarea',
      placeholder: 'Paste the autogenerated batch job list here',
      help: 'YAML or JSON list of { job: {...} } entries; each needs id and schedule. Validated by the backend at creation time.',
    },
    ...chainAuth,
  },
  'python-git-job': {
    jobName: {
      label: 'Job Name',
      placeholder: 'my-scripts',
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
    entrypoints: {
      label: 'Entrypoints',
      widget: 'objectRows',
      keyPlaceholder: 'train.py',
      help: 'metadata.yaml must list these under `files` — no ENTRYPOINT key',
      rowFields: [
        {
          key: 'type', widget: 'select',
          options: [{ label: 'Manual', value: 'OnDemand' }, { label: 'Cron', value: 'Cron' }],
        },
        { key: 'schedule', widget: 'cron', showIf: { field: 'type', equals: 'Cron' } },
      ],
    },
    ...chainAuth,
    ...triggerAuth,
  },
  'python-git-service': {
    serviceName: {
      label: 'Service Name',
      placeholder: 'my-dashboard',
      help: 'Shared Kubernetes name for the watcher, chain, and service blueprint',
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
      placeholder: 'apps/dashboard',
      help: 'Relative path containing metadata.yaml — no .. (optional)',
    },
    port: {
      label: 'Port',
      placeholder: '8501',
      help: "Port the app listens on (Streamlit's default is 8501)",
    },
    ingressName: {
      label: 'Ingress Name',
      placeholder: 'my-dashboard',
      help: 'DNS label to expose the service at <name>.<cluster domain> (optional, lowercase letters, digits, hyphens)',
    },
  },
}
