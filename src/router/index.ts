import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

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

export default router
