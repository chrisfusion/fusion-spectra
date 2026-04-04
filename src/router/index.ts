import { createRouter, createWebHistory } from 'vue-router'
import { registerGuards } from './guards'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('@/layouts/AuthLayout.vue'),
      children: [
        { path: '', name: 'login', component: () => import('@/pages/LoginPage.vue') },
      ],
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('@/pages/CallbackPage.vue'),
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '',          redirect: '/overview' },
        { path: 'overview',  name: 'overview',  component: () => import('@/pages/OverviewPage.vue') },
        { path: 'dashboard', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue') },
        { path: 'jobs',      name: 'jobs',      component: () => import('@/pages/JobsPage.vue') },  // legacy mock — superseded by /index/jobs
        { path: 'venvs',     name: 'venvs',     component: () => import('@/pages/VenvsPage.vue') },
        { path: 'admin',     name: 'admin',     component: () => import('@/pages/AdminPage.vue') },
        { path: 'help',      name: 'help',      component: () => import('@/pages/HelpPage.vue') },
        { path: 'index/templates',     name: 'index-templates',       component: () => import('fusion-index-plugin/TemplatesView') },
        { path: 'index/templates/:id', name: 'index-template-detail', component: () => import('fusion-index-plugin/TemplateDetailView') },
        { path: 'index/jobs',          name: 'index-jobs',            component: () => import('fusion-index-plugin/JobsView') },
        { path: 'index/artifacts',     name: 'index-artifacts',       component: () => import('fusion-index-plugin/ArtifactsView') },
        { path: 'forge/venvs',         name: 'forge-venvs',           component: () => import('fusion-forge-plugin/VenvsView') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

registerGuards(router)

export default router
