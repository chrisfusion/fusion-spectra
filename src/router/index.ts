import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      redirect: '/data',
      children: [
        { path: '/data/:pathMatch(.*)*',          component: () => import('@/pages/DataPage.vue'),        meta: { context: 'data' } },
        { path: '/pipelines/:pathMatch(.*)*',     component: () => import('@/pages/PipelinesPage.vue'),   meta: { context: 'pipelines' } },
        { path: '/monitoring/:pathMatch(.*)*',    component: () => import('@/pages/MonitoringPage.vue'),  meta: { context: 'monitoring' } },
        { path: '/forge',                  component: () => import('@/pages/forge/ForgeIndexPage.vue'),  meta: { context: 'forge' } },
        { path: '/forge/venvs',           component: () => import('@/pages/forge/VenvListPage.vue'),    meta: { context: 'forge' } },
        { path: '/forge/venvs/create',    component: () => import('@/pages/forge/VenvCreatePage.vue'),  meta: { context: 'forge' } },
        { path: '/forge/venvs/:id',       component: () => import('@/pages/forge/VenvDetailPage.vue'),  meta: { context: 'forge' } },
        { path: '/forge/:pathMatch(.*)*', component: () => import('@/pages/forge/ForgeIndexPage.vue'),  meta: { context: 'forge' } },
        { path: '/fusion-index',                   component: () => import('@/pages/FusionIndexPage.vue'),              meta: { context: 'fusion-index' } },
        { path: '/fusion-index/artifacts',         component: () => import('@/pages/index/ArtifactListPage.vue'),       meta: { context: 'fusion-index' } },
        { path: '/fusion-index/artifacts/create',              component: () => import('@/pages/index/ArtifactCreatePage.vue'),        meta: { context: 'fusion-index' } },
        { path: '/fusion-index/artifacts/:id/versions/create', component: () => import('@/pages/index/ArtifactVersionCreatePage.vue'), meta: { context: 'fusion-index' } },
        { path: '/fusion-index/artifacts/:id',                 component: () => import('@/pages/index/ArtifactDetailPage.vue'),         meta: { context: 'fusion-index' } },
        { path: '/fusion-index/:pathMatch(.*)*',   component: () => import('@/pages/FusionIndexPage.vue'),              meta: { context: 'fusion-index' } },
        { path: '/admin/roles',       component: () => import('@/pages/admin/RoleAssignmentsPage.vue'),     meta: { context: 'admin', adminOnly: true } },
        { path: '/admin/permissions', component: () => import('@/pages/admin/ResourcePermissionsPage.vue'), meta: { context: 'admin', adminOnly: true } },
        { path: '/admin/types',       component: () => import('@/pages/admin/ArtifactTypesPage.vue'),       meta: { context: 'admin', adminOnly: true } },
        { path: '/admin/:pathMatch(.*)*', component: () => import('@/pages/AdminPage.vue'),                 meta: { context: 'admin', adminOnly: true } },
      ]
    }
  ]
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
