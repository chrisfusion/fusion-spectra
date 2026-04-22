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
        { path: '/fusion-index/:pathMatch(.*)*',  component: () => import('@/pages/FusionIndexPage.vue'), meta: { context: 'fusion-index' } },
        { path: '/admin/:pathMatch(.*)*',         component: () => import('@/pages/AdminPage.vue'),       meta: { context: 'admin' } },
      ]
    }
  ]
})

router.beforeEach(async () => {
  const auth = useAuthStore()
  const authenticated = await auth.init()
  if (!authenticated) {
    auth.loginRedirect()
    return false
  }
})

export default router
