export type ContextId = 'data' | 'pipelines' | 'monitoring' | 'forge' | 'fusion-index' | 'admin'

export interface NavLeaf {
  id: string
  label: string
  icon: string
  route: string
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
          { id: 'datasets', label: 'Datasets',  icon: 'mdi-folder-table-outline', route: '/data/datasets' },
          { id: 'schemas',  label: 'Schemas',   icon: 'mdi-file-code-outline',    route: '/data/schemas' },
          { id: 'tags',     label: 'Tags',       icon: 'mdi-tag-multiple-outline', route: '/data/tags' },
          { id: 'lineage',  label: 'Lineage',    icon: 'mdi-graph-outline',        route: '/data/lineage' },
        ]
      },
      {
        id: 'storage',
        label: 'Storage',
        icon: 'mdi-harddisk',
        children: [
          { id: 'buckets', label: 'Buckets', icon: 'mdi-bucket-outline', route: '/data/buckets' },
          { id: 'usage',   label: 'Usage',   icon: 'mdi-chart-bar',      route: '/data/usage' },
          { id: 'partitions', label: 'Partitions', icon: 'mdi-table-split', route: '/data/partitions' },
        ]
      },
      {
        id: 'access',
        label: 'Access',
        icon: 'mdi-shield-lock-outline',
        children: [
          { id: 'policies',    label: 'Policies',    icon: 'mdi-file-lock-outline', route: '/data/policies' },
          { id: 'classifiers', label: 'Classifiers', icon: 'mdi-label-outline',     route: '/data/classifiers' },
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
          { id: 'active-pipes',   label: 'Active',    icon: 'mdi-play-circle-outline', route: '/pipelines/active',    badge: { text: '3', variant: 'pos' } },
          { id: 'scheduled',      label: 'Scheduled', icon: 'mdi-clock-outline',       route: '/pipelines/scheduled' },
          { id: 'pipe-archive',   label: 'Archive',   icon: 'mdi-archive-outline',     route: '/pipelines/archive' },
        ]
      },
      {
        id: 'jobs-group',
        label: 'Jobs',
        icon: 'mdi-briefcase-outline',
        children: [
          { id: 'jobs-running',  label: 'Running',  icon: 'mdi-motion-play-outline', route: '/pipelines/jobs/running',  badge: { text: '2', variant: 'warn' } },
          { id: 'jobs-history',  label: 'History',  icon: 'mdi-history',             route: '/pipelines/jobs/history' },
          { id: 'jobs-failed',   label: 'Failed',   icon: 'mdi-alert-circle-outline', route: '/pipelines/jobs/failed',  badge: { text: '1', variant: 'neg' } },
          { id: 'jobs-schedule', label: 'Schedules', icon: 'mdi-calendar-clock',     route: '/pipelines/jobs/schedules' },
        ]
      },
      {
        id: 'templates',
        label: 'Templates',
        icon: 'mdi-clipboard-text-outline',
        children: [
          { id: 'tpl-etl',    label: 'ETL',    icon: 'mdi-file-document-outline', route: '/pipelines/templates/etl' },
          { id: 'tpl-stream', label: 'Stream', icon: 'mdi-file-document-outline', route: '/pipelines/templates/stream' },
          { id: 'tpl-batch',  label: 'Batch',  icon: 'mdi-file-document-outline', route: '/pipelines/templates/batch' },
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
          { id: 'health-overview', label: 'Overview', icon: 'mdi-view-dashboard-outline', route: '/monitoring/health' },
          { id: 'nodes',           label: 'Nodes',    icon: 'mdi-server-outline',          route: '/monitoring/nodes' },
          { id: 'storage-health',  label: 'Storage',  icon: 'mdi-database-check-outline',  route: '/monitoring/storage' },
        ]
      },
      {
        id: 'metrics',
        label: 'Metrics',
        icon: 'mdi-chart-line',
        children: [
          { id: 'perf',       label: 'Performance', icon: 'mdi-speedometer',       route: '/monitoring/metrics/performance' },
          { id: 'throughput', label: 'Throughput',  icon: 'mdi-transfer',           route: '/monitoring/metrics/throughput' },
          { id: 'latency',    label: 'Latency',     icon: 'mdi-timer-sand-outline', route: '/monitoring/metrics/latency' },
        ]
      },
      {
        id: 'alerts',
        label: 'Alerts',
        icon: 'mdi-bell-alert-outline',
        children: [
          { id: 'alerts-active',  label: 'Active',  icon: 'mdi-bell-ring-outline', route: '/monitoring/alerts/active',  badge: { text: '3', variant: 'neg' } },
          { id: 'alerts-rules',   label: 'Rules',   icon: 'mdi-cog-outline',       route: '/monitoring/alerts/rules' },
          { id: 'alerts-history', label: 'History', icon: 'mdi-history',           route: '/monitoring/alerts/history' },
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
          { id: 'forge-overview',    label: 'Overview',    icon: 'mdi-view-dashboard-outline', route: '/forge' },
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
          { id: 'fi-mon-overview', label: 'Overview', icon: 'mdi-chart-box-outline', route: '/fusion-index/monitoring' },
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
          { id: 'all-users',   label: 'All Users',   icon: 'mdi-account-multiple-outline', route: '/admin/users' },
          { id: 'roles',       label: 'Roles',       icon: 'mdi-shield-account-outline',   route: '/admin/roles' },
          { id: 'permissions', label: 'Permissions', icon: 'mdi-key-outline',              route: '/admin/permissions' },
        ]
      },
      {
        id: 'system-group',
        label: 'System',
        icon: 'mdi-cog-outline',
        children: [
          { id: 'config',       label: 'Configuration', icon: 'mdi-tune',                route: '/admin/config' },
          { id: 'integrations', label: 'Integrations',  icon: 'mdi-puzzle-outline',      route: '/admin/integrations' },
          { id: 'audit',        label: 'Audit Log',     icon: 'mdi-clipboard-list-outline', route: '/admin/audit' },
        ]
      },
      {
        id: 'platform-group',
        label: 'Platform',
        icon: 'mdi-layers-outline',
        children: [
          { id: 'services', label: 'Services', icon: 'mdi-server-network-outline', route: '/admin/platform/services' },
          { id: 'database', label: 'Database', icon: 'mdi-database-cog-outline',   route: '/admin/platform/database' },
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
