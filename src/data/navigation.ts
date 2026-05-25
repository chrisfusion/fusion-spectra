export type ContextId = 'home' | 'data' | 'pipelines' | 'monitoring' | 'forge' | 'fusion-index' | 'changelog' | 'help' | 'admin'

export interface NavLeaf {
  id: string
  label: string
  icon: string
  route: string
  placeholder?: boolean
  tooltip?: string
  badge?: { text: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'accent' }
}

export interface NavGroup {
  id: string
  label: string
  icon: string
  section?: string
  children: NavLeaf[]
}

export interface Context {
  id: ContextId
  label: string
  icon: string
  rootPath: string
  adminOnly?: boolean
  bottomUtil?: boolean
  groups: NavGroup[]
}

export const contexts: Context[] = [
  {
    id: 'home',
    label: 'Home',
    icon: 'mdi-home-outline',
    rootPath: '/dashboard',
    groups: []
  },

  {
    id: 'data',
    label: 'Data',
    icon: 'mdi-database-outline',
    rootPath: '/data',
    groups: [
      {
        id: 'catalog',
        label: 'Catalog',
        icon: 'mdi-book-open-page-variant-outline',
        children: [
          { id: 'datasets', label: 'Datasets',  icon: 'mdi-folder-table-outline', route: '/data/datasets', placeholder: true },
          { id: 'schemas',  label: 'Schemas',   icon: 'mdi-file-code-outline',    route: '/data/schemas',  placeholder: true },
          { id: 'tags',     label: 'Tags',       icon: 'mdi-tag-multiple-outline', route: '/data/tags',     placeholder: true },
          { id: 'lineage',  label: 'Lineage',    icon: 'mdi-graph-outline',        route: '/data/lineage',  placeholder: true },
        ]
      },
      {
        id: 'storage',
        label: 'Storage',
        icon: 'mdi-harddisk',
        children: [
          { id: 'buckets',    label: 'Buckets',    icon: 'mdi-bucket-outline', route: '/data/buckets',     placeholder: true },
          { id: 'usage',      label: 'Usage',      icon: 'mdi-chart-bar',      route: '/data/usage',       placeholder: true },
          { id: 'partitions', label: 'Partitions', icon: 'mdi-table-split',    route: '/data/partitions',  placeholder: true },
        ]
      },
      {
        id: 'access',
        label: 'Access',
        icon: 'mdi-shield-lock-outline',
        children: [
          { id: 'policies',    label: 'Policies',    icon: 'mdi-file-lock-outline', route: '/data/policies',    placeholder: true },
          { id: 'classifiers', label: 'Classifiers', icon: 'mdi-label-outline',     route: '/data/classifiers', placeholder: true },
        ]
      }
    ]
  },

  {
    id: 'pipelines',
    label: 'Weave',
    icon: 'mdi-pipe',
    rootPath: '/pipelines',
    groups: [
      {
        id: 'runs-monitoring',
        label: 'Monitoring',
        section: 'Runs',
        icon: 'mdi-chart-timeline-variant',
        children: [
          { id: 'jobs-history',  label: 'Run Overview', icon: 'mdi-view-dashboard-outline', route: '/pipelines/runs',           tooltip: 'Run overview and history' },
          { id: 'svc-list',      label: 'GitOps Runs',  icon: 'mdi-source-branch-sync',     route: '/pipelines/services',       tooltip: 'GitOps-controlled service runs' },
          { id: 'triggers-list', label: 'Triggers',     icon: 'mdi-lightning-bolt-outline', route: '/pipelines/weave/triggers', tooltip: 'Event-based run triggers' },
        ]
      },
      {
        id: 'runs-control',
        label: 'Control',
        section: 'Runs',
        icon: 'mdi-tune',
        children: [
          { id: 'triggers-create', label: 'Add Trigger',           icon: 'mdi-plus-circle-outline', route: '/pipelines/weave/triggers/create', tooltip: 'Create a new trigger' },
          { id: 'svc-launch',      label: 'Attach Step to GitOps', icon: 'mdi-source-branch-plus',  route: '/pipelines/services/create',       tooltip: 'Attach a step blueprint to GitOps' },
          { id: 'triggers-edit',   label: 'Edit Triggers',         icon: 'mdi-square-edit-outline', route: '/pipelines/weave/triggers',        tooltip: 'Manage and edit existing triggers' },
        ]
      },
      {
        id: 'run-blueprints',
        label: 'Run Blueprints',
        section: 'Blueprints',
        icon: 'mdi-file-document-multiple-outline',
        children: [
          { id: 'chains-list',          label: 'All Blueprints', icon: 'mdi-link-chain',          route: '/pipelines/weave/chains',              tooltip: 'All pipeline run blueprints' },
          { id: 'chains-create',        label: 'Single Step',    icon: 'mdi-plus-circle-outline', route: '/pipelines/weave/chains/create',        tooltip: 'Single job/service wizard' },
          { id: 'chains-simple-deploy', label: 'Webservice',     icon: 'mdi-auto-fix',            route: '/pipelines/weave/chains/simple-deploy', tooltip: 'Webservice deployment wizard' },
          { id: 'chains-etl',           label: 'ETL',            icon: 'mdi-database-sync',       route: '/pipelines/weave/chains/etl',           tooltip: 'ETL pipeline wizard' },
          { id: 'chains-advanced',      label: 'Advanced',       icon: 'mdi-sitemap',             route: '/pipelines/weave/chains/advanced',      tooltip: 'Advanced chain builder' },
        ]
      },
      {
        id: 'step-blueprints',
        label: 'Step Blueprints',
        section: 'Blueprints',
        icon: 'mdi-layers-outline',
        children: [
          { id: 'tpl-jobtemplates',           label: 'Job Blueprints', icon: 'mdi-briefcase-outline',      route: '/pipelines/weave/jobtemplates',        tooltip: 'Batch/compute job definitions' },
          { id: 'tpl-jobtemplate-create',     label: 'Add Job',        icon: 'mdi-plus-circle-outline',    route: '/pipelines/weave/jobtemplates/create', tooltip: 'Create a job blueprint' },
          { id: 'tpl-jobtemplate-expert',     label: 'Job Expert',     icon: 'mdi-briefcase-edit-outline', route: '/pipelines/weave/jobtemplates/expert', tooltip: 'Expert YAML job create' },
          { id: 'tpl-servicetemplates',       label: 'Svc Blueprints', icon: 'mdi-server-outline',         route: '/pipelines/weave/servicetemplates',        tooltip: 'Service deployment definitions' },
          { id: 'tpl-servicetemplate-create', label: 'Add Service',    icon: 'mdi-plus-circle-outline',    route: '/pipelines/weave/servicetemplates/create', tooltip: 'Create a service blueprint' },
          { id: 'tpl-servicetemplate-expert', label: 'Svc Expert',     icon: 'mdi-server-network',         route: '/pipelines/weave/servicetemplates/expert', tooltip: 'Expert YAML service create' },
        ]
      },
    ]
  },

  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: 'mdi-monitor-dashboard',
    rootPath: '/monitoring',
    groups: [
      {
        id: 'health',
        label: 'System Health',
        icon: 'mdi-heart-pulse',
        children: [
          { id: 'health-overview', label: 'Overview', icon: 'mdi-view-dashboard-outline', route: '/monitoring/health',   placeholder: true },
          { id: 'nodes',           label: 'Nodes',    icon: 'mdi-server-outline',          route: '/monitoring/nodes',    placeholder: true },
          { id: 'storage-health',  label: 'Storage',  icon: 'mdi-database-check-outline',  route: '/monitoring/storage',  placeholder: true },
        ]
      },
      {
        id: 'metrics',
        label: 'Metrics',
        icon: 'mdi-chart-line',
        children: [
          { id: 'perf',       label: 'Performance', icon: 'mdi-speedometer',       route: '/monitoring/metrics/performance', placeholder: true },
          { id: 'throughput', label: 'Throughput',  icon: 'mdi-transfer',           route: '/monitoring/metrics/throughput',  placeholder: true },
          { id: 'latency',    label: 'Latency',     icon: 'mdi-timer-sand-outline', route: '/monitoring/metrics/latency',     placeholder: true },
        ]
      },
      {
        id: 'alerts',
        label: 'Alerts',
        icon: 'mdi-bell-alert-outline',
        children: [
          { id: 'alerts-active',  label: 'Active',  icon: 'mdi-bell-ring-outline', route: '/monitoring/alerts/active',  placeholder: true, badge: { text: '3', variant: 'neg' } },
          { id: 'alerts-rules',   label: 'Rules',   icon: 'mdi-cog-outline',       route: '/monitoring/alerts/rules',   placeholder: true },
          { id: 'alerts-history', label: 'History', icon: 'mdi-history',           route: '/monitoring/alerts/history', placeholder: true },
        ]
      }
    ]
  },

  {
    id: 'forge',
    label: 'Forge',
    icon: 'mdi-hammer-wrench',
    rootPath: '/forge',
    groups: [
      {
        id: 'forge-monitoring',
        label: 'Monitoring',
        section: 'Monitoring',
        icon: 'mdi-monitor-dashboard',
        children: [
          { id: 'forge-build-overview', label: 'Build Overview', icon: 'mdi-list-box-outline',       route: '/forge/venvs' },
          { id: 'forge-gitops-builds',  label: 'GitOps Builds',  icon: 'mdi-source-branch-sync',     route: '/forge/gitwatchers' },
        ]
      },
      {
        id: 'forge-venv-builder',
        label: 'Builder',
        section: 'Build',
        icon: 'mdi-language-python',
        children: [
          { id: 'forge-venv-create',     label: 'Create Venv',    icon: 'mdi-plus-circle-outline',  route: '/forge/venvs/create' },
          { id: 'forge-gitops-builder',  label: 'GitOps Builder', icon: 'mdi-source-branch-plus',   route: '/forge/gitops-builder/create' },
        ]
      }
    ]
  },

  {
    id: 'fusion-index',
    label: 'Fusion Index',
    icon: 'mdi-package-variant-closed',
    rootPath: '/fusion-index',
    groups: [
      {
        id: 'fi-registry',
        label: 'Registry',
        icon: 'mdi-package-variant',
        children: [
          { id: 'fi-dashboard',     label: 'Dashboard',     icon: 'mdi-view-dashboard-outline',   route: '/fusion-index' },
          { id: 'fi-artifact-list',   label: 'Artifact List',   icon: 'mdi-package-variant-closed', route: '/fusion-index/artifacts' },
          { id: 'fi-artifact-create', label: 'Create Artifact', icon: 'mdi-upload-outline',         route: '/fusion-index/artifacts/create' },
        ]
      },
      {
        id: 'fi-monitoring',
        label: 'Monitoring',
        icon: 'mdi-monitor-dashboard',
        children: [
          { id: 'fi-mon-overview', label: 'Overview', icon: 'mdi-chart-box-outline', route: '/fusion-index/monitoring', placeholder: true },
        ]
      }
    ]
  },

  {
    id: 'changelog',
    label: 'Changelog',
    icon: 'mdi-clipboard-text-clock-outline',
    rootPath: '/changelog',
    bottomUtil: true,
    groups: []
  },

  {
    id: 'help',
    label: 'Help',
    icon: 'mdi-help-circle-outline',
    rootPath: '/help',
    bottomUtil: true,
    groups: []
  },

  {
    id: 'admin',
    label: 'Admin',
    icon: 'mdi-shield-crown-outline',
    rootPath: '/admin',
    adminOnly: true,
    groups: [
      {
        id: 'users-group',
        label: 'Users',
        icon: 'mdi-account-group-outline',
        children: [
          { id: 'all-users',   label: 'All Users',   icon: 'mdi-account-multiple-outline', route: '/admin/users',       placeholder: true },
          { id: 'roles',       label: 'Roles',       icon: 'mdi-shield-account-outline',   route: '/admin/roles' },
          { id: 'permissions', label: 'Permissions', icon: 'mdi-key-outline',              route: '/admin/permissions' },
        ]
      },
      {
        id: 'system-group',
        label: 'System',
        icon: 'mdi-cog-outline',
        children: [
          { id: 'config',       label: 'Configuration', icon: 'mdi-tune',                   route: '/admin/config',        placeholder: true },
          { id: 'integrations', label: 'Integrations',  icon: 'mdi-puzzle-outline',         route: '/admin/integrations',  placeholder: true },
          { id: 'audit',        label: 'Audit Log',     icon: 'mdi-clipboard-list-outline', route: '/admin/audit',         placeholder: true },
        ]
      },
      {
        id: 'platform-group',
        label: 'Platform',
        icon: 'mdi-layers-outline',
        children: [
          { id: 'service-status-overrides', label: 'Service Status Overrides', icon: 'mdi-heart-pulse',          route: '/admin/health' },
          { id: 'services',                 label: 'Services',                  icon: 'mdi-server-network-outline', route: '/admin/platform/services', placeholder: true },
          { id: 'database',                 label: 'Database',                  icon: 'mdi-database-cog-outline',   route: '/admin/platform/database', placeholder: true },
        ]
      },
      {
        id: 'index-group',
        label: 'Index',
        icon: 'mdi-package-variant-closed',
        children: [
          { id: 'artifact-types',  label: 'Artifact Types', icon: 'mdi-tag-multiple-outline',   route: '/admin/types' },
          { id: 'index-cleanup',   label: 'Index Cleanup',  icon: 'mdi-broom',                  route: '/admin/index-cleanup' },
        ]
      }
    ]
  }
]
