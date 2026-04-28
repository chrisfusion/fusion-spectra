export type ContextId = 'data' | 'pipelines' | 'monitoring' | 'forge' | 'fusion-index' | 'admin'

export interface NavLeaf {
  id: string
  label: string
  icon: string
  route: string
  placeholder?: boolean
  badge?: { text: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'accent' }
}

export interface NavGroup {
  id: string
  label: string
  icon: string
  children: NavLeaf[]
}

export interface Context {
  id: ContextId
  label: string
  icon: string
  rootPath: string
  adminOnly?: boolean
  groups: NavGroup[]
}

export const contexts: Context[] = [
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
    label: 'Pipelines & Jobs',
    icon: 'mdi-pipe',
    rootPath: '/pipelines',
    groups: [
      {
        id: 'pipelines-group',
        label: 'Pipelines',
        icon: 'mdi-transit-connection-variant',
        children: [
          { id: 'active-pipes', label: 'Active',    icon: 'mdi-play-circle-outline', route: '/pipelines/active',    placeholder: true, badge: { text: '3', variant: 'pos' } },
          { id: 'scheduled',    label: 'Scheduled', icon: 'mdi-clock-outline',       route: '/pipelines/scheduled', placeholder: true },
          { id: 'pipe-archive', label: 'Archive',   icon: 'mdi-archive-outline',     route: '/pipelines/archive',   placeholder: true },
        ]
      },
      {
        id: 'jobs-group',
        label: 'Jobs',
        icon: 'mdi-briefcase-outline',
        children: [
          { id: 'jobs-running',  label: 'Running',   icon: 'mdi-motion-play-outline',  route: '/pipelines/jobs/running',   placeholder: true, badge: { text: '2', variant: 'warn' } },
          { id: 'jobs-history',  label: 'History',   icon: 'mdi-history',              route: '/pipelines/jobs/history',   placeholder: true },
          { id: 'jobs-failed',   label: 'Failed',    icon: 'mdi-alert-circle-outline', route: '/pipelines/jobs/failed',    placeholder: true, badge: { text: '1', variant: 'neg' } },
          { id: 'jobs-schedule', label: 'Schedules', icon: 'mdi-calendar-clock',       route: '/pipelines/jobs/schedules', placeholder: true },
        ]
      },
      {
        id: 'job-templates',
        label: 'Job Templates',
        icon: 'mdi-briefcase-outline',
        children: [
          { id: 'tpl-jobtemplates',        label: 'Job Templates',        icon: 'mdi-briefcase-outline',      route: '/pipelines/weave/jobtemplates' },
          { id: 'tpl-jobtemplate-create',  label: 'Create Job Template',  icon: 'mdi-plus-circle-outline',    route: '/pipelines/weave/jobtemplates/create' },
          { id: 'tpl-jobtemplate-expert',  label: 'Expert Create',        icon: 'mdi-briefcase-edit-outline', route: '/pipelines/weave/jobtemplates/expert' },
        ]
      },
      {
        id: 'service-templates',
        label: 'Service Templates',
        icon: 'mdi-server-outline',
        children: [
          { id: 'tpl-servicetemplates',       label: 'Service Templates',       icon: 'mdi-server-outline',      route: '/pipelines/weave/servicetemplates' },
          { id: 'tpl-servicetemplate-create', label: 'Create Service Template', icon: 'mdi-plus-circle-outline', route: '/pipelines/weave/servicetemplates/create' },
          { id: 'tpl-servicetemplate-expert', label: 'Expert Create',           icon: 'mdi-server-network',      route: '/pipelines/weave/servicetemplates/expert' },
        ]
      }
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
        id: 'forge-venv',
        label: 'Venv Builder',
        icon: 'mdi-language-python',
        children: [
          { id: 'forge-overview',    label: 'Overview',    icon: 'mdi-view-dashboard-outline', route: '/forge', placeholder: true },
          { id: 'forge-venv-list',   label: 'Venv Builds', icon: 'mdi-list-box-outline',       route: '/forge/venvs' },
          { id: 'forge-venv-create', label: 'Create Venv', icon: 'mdi-plus-circle-outline',    route: '/forge/venvs/create' },
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
          { id: 'services', label: 'Services', icon: 'mdi-server-network-outline', route: '/admin/platform/services', placeholder: true },
          { id: 'database', label: 'Database', icon: 'mdi-database-cog-outline',   route: '/admin/platform/database', placeholder: true },
        ]
      },
      {
        id: 'index-group',
        label: 'Index',
        icon: 'mdi-package-variant-closed',
        children: [
          { id: 'artifact-types', label: 'Artifact Types', icon: 'mdi-tag-multiple-outline', route: '/admin/types' },
        ]
      }
    ]
  }
]
