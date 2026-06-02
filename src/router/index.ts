import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      redirect: '/dashboard',
      children: [
        { path: '/dashboard', component: () => import('@/pages/DashboardPage.vue'), meta: { context: 'home' } },
        { path: '/data/:pathMatch(.*)*',          component: () => import('@/pages/DataPage.vue'),        meta: { context: 'data' } },
        { path: '/pipelines/weave/jobtemplates',         component: () => import('@/pages/pipelines/JobTemplateListPage.vue'),   meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/jobtemplates/create', component: () => import('@/pages/pipelines/JobTemplateCreatePage.vue'),  meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/jobtemplates/expert',         component: () => import('@/pages/pipelines/JobTemplateExpertPage.vue'),      meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/servicetemplates',             component: () => import('@/pages/pipelines/ServiceTemplateListPage.vue'),    meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/servicetemplates/create',      component: () => import('@/pages/pipelines/ServiceTemplateCreatePage.vue'),  meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/servicetemplates/expert',      component: () => import('@/pages/pipelines/ServiceTemplateExpertPage.vue'),  meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/chains',                 component: () => import('@/pages/pipelines/WeaveChainListPage.vue'),          meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/chains/create',        component: () => import('@/pages/pipelines/WeaveChainCreatePage.vue'),        meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/chains/simple-deploy', component: () => import('@/pages/pipelines/WeaveSimpleDeployChainPage.vue'),  meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/chains/etl',          component: () => import('@/pages/pipelines/WeaveEtlChainPage.vue'),             meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/chains/advanced',  component: () => import('@/pages/pipelines/WeaveAdvancedChainPage.vue'),          meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/chains/:name',      component: () => import('@/pages/pipelines/WeaveChainDetailPage.vue'),           meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/triggers',        component: () => import('@/pages/pipelines/WeaveTriggerListPage.vue'),   meta: { context: 'pipelines' } },
        { path: '/pipelines/weave/triggers/create', component: () => import('@/pages/pipelines/WeaveTriggerCreatePage.vue'), meta: { context: 'pipelines' } },
        { path: '/pipelines/runs/running',        component: () => import('@/pages/pipelines/WeaveRunsRunningPage.vue'),  meta: { context: 'pipelines' } },
        { path: '/pipelines/runs/failed',         component: () => import('@/pages/pipelines/WeaveRunsFailedPage.vue'),   meta: { context: 'pipelines' } },
        { path: '/pipelines/runs/:name',          component: () => import('@/pages/pipelines/WeaveRunDetailPage.vue'),    meta: { context: 'pipelines' } },
        { path: '/pipelines/runs',                component: () => import('@/pages/pipelines/WeaveRunsOverviewPage.vue'), meta: { context: 'pipelines' } },
        { path: '/pipelines/services',        component: () => import('@/pages/pipelines/ServiceInstanceListPage.vue'),   meta: { context: 'pipelines' } },
        { path: '/pipelines/services/create', component: () => import('@/pages/pipelines/ServiceInstanceCreatePage.vue'), meta: { context: 'pipelines' } },
        { path: '/pipelines/services/:name',  component: () => import('@/pages/pipelines/ServiceInstanceDetailPage.vue'), meta: { context: 'pipelines' } },
        { path: '/pipelines/:pathMatch(.*)*',     component: () => import('@/pages/PipelinesPage.vue'),   meta: { context: 'pipelines' } },
        { path: '/monitoring/:pathMatch(.*)*',    component: () => import('@/pages/MonitoringPage.vue'),  meta: { context: 'monitoring' } },
        { path: '/forge',                  component: () => import('@/pages/forge/ForgeIndexPage.vue'),  meta: { context: 'forge' } },
        { path: '/forge/venvs',           component: () => import('@/pages/forge/VenvListPage.vue'),    meta: { context: 'forge' } },
        { path: '/forge/venvs/create',    component: () => import('@/pages/forge/VenvCreatePage.vue'),  meta: { context: 'forge' } },
        { path: '/forge/venvs/:id',        component: () => import('@/pages/forge/VenvDetailPage.vue'),      meta: { context: 'forge' } },
        { path: '/forge/gitbuilds/create',  component: () => import('@/pages/forge/GitBuildCreatePage.vue'),   meta: { context: 'forge' } },
        { path: '/forge/gitbuilds/:id',    component: () => import('@/pages/forge/GitBuildDetailPage.vue'),   meta: { context: 'forge' } },
        { path: '/forge/appbuilds/create', component: () => import('@/pages/forge/AppBuildCreatePage.vue'),     meta: { context: 'forge' } },
        { path: '/forge/appbuilds/:id',    component: () => import('@/pages/forge/AppBuildDetailPage.vue'),   meta: { context: 'forge' } },
        { path: '/forge/gitwatchers/create',    component: () => import('@/pages/forge/GitWatcherCreatePage.vue'), meta: { context: 'forge' } },
        { path: '/forge/gitwatchers/:name/edit', component: () => import('@/pages/forge/GitWatcherEditPage.vue'),   meta: { context: 'forge' } },
        { path: '/forge/gitwatchers/:name',      component: () => import('@/pages/forge/GitWatcherDetailPage.vue'), meta: { context: 'forge' } },
        { path: '/forge/gitwatchers',            component: () => import('@/pages/forge/GitWatcherListPage.vue'),   meta: { context: 'forge' } },
        { path: '/forge/gitops-builder/create', component: () => import('@/pages/forge/GitOpsBuilderPage.vue'),  meta: { context: 'forge' } },
        { path: '/forge/:pathMatch(.*)*',  component: () => import('@/pages/forge/ForgeIndexPage.vue'),       meta: { context: 'forge' } },
        { path: '/fusion-index',                   component: () => import('@/pages/FusionIndexPage.vue'),              meta: { context: 'fusion-index' } },
        { path: '/fusion-index/artifacts',         component: () => import('@/pages/index/ArtifactListPage.vue'),       meta: { context: 'fusion-index' } },
        { path: '/fusion-index/artifacts/create',              component: () => import('@/pages/index/ArtifactCreatePage.vue'),        meta: { context: 'fusion-index' } },
        { path: '/fusion-index/artifacts/:id/versions/create', component: () => import('@/pages/index/ArtifactVersionCreatePage.vue'), meta: { context: 'fusion-index' } },
        { path: '/fusion-index/artifacts/:id',                 component: () => import('@/pages/index/ArtifactDetailPage.vue'),         meta: { context: 'fusion-index' } },
        { path: '/fusion-index/:pathMatch(.*)*',   component: () => import('@/pages/FusionIndexPage.vue'),              meta: { context: 'fusion-index' } },
        { path: '/changelog', component: () => import('@/pages/ChangelogPage.vue'), meta: { context: 'changelog' } },
        { path: '/help',      component: () => import('@/pages/HelpPage.vue'),      meta: { context: 'help' } },
        { path: '/admin/roles',       component: () => import('@/pages/admin/RoleAssignmentsPage.vue'),            meta: { context: 'admin', adminOnly: true } },
        { path: '/admin/permissions', component: () => import('@/pages/admin/ResourcePermissionsPage.vue'),       meta: { context: 'admin', adminOnly: true } },
        { path: '/admin/types',       component: () => import('@/pages/admin/ArtifactTypesPage.vue'),             meta: { context: 'admin', adminOnly: true } },
        { path: '/admin/health',         component: () => import('@/pages/admin/ServiceStatusOverridesPage.vue'),  meta: { context: 'admin', adminOnly: true } },
        { path: '/admin/index-cleanup',  component: () => import('@/pages/admin/IndexCleanupPage.vue'),          meta: { context: 'admin', adminOnly: true } },
        { path: '/admin/forge-cleanup',  component: () => import('@/pages/admin/ForgeCleanupPage.vue'),          meta: { context: 'admin', adminOnly: true } },
        { path: '/admin/:pathMatch(.*)*', component: () => import('@/pages/AdminPage.vue'),                      meta: { context: 'admin', adminOnly: true } },
      ]
    }
  ]
})

// Timestamp-based guard: prevents reload loops within 8s but self-expires so
// Ctrl+Shift+R or waiting recovers the page (unlike a boolean that sessionStorage
// preserves indefinitely through hard refreshes).
const CHUNK_RELOAD_KEY = '__chunk_reload_ts__'
const CHUNK_RELOAD_COOLDOWN = 8_000

function isChunkError(msg: string | undefined): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload/i.test(msg ?? '')
}

function reloadForChunk(path?: string): void {
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0)
  if (Date.now() - last < CHUNK_RELOAD_COOLDOWN) return
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  window.location.replace(
    path ? window.location.origin + '/#' + path : window.location.href
  )
}

router.onError((err, to) => {
  if (isChunkError(err.message)) reloadForChunk(to?.fullPath)
})

router.afterEach(() => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY)
})

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkError(event.reason?.message)) reloadForChunk()
})

// Vite 5 dispatches this for preloaded-module failures that don't always
// surface through unhandledrejection.
window.addEventListener('vite:preloadError', (event: Event) => {
  event.preventDefault()
  reloadForChunk()
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const authenticated = await auth.init()
  if (!authenticated) {
    auth.loginRedirect()
    return false
  }
  if (to.meta.adminOnly && !auth.user?.roles.includes('admin')) {
    return '/data'
  }
})

export default router
