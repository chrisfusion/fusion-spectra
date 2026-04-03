import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export function registerGuards(router: Router): void {
  router.beforeEach((to) => {
    const auth = useAuthStore()

    if (to.matched.some((r) => r.meta.requiresAuth) && !auth.isAuthenticated) {
      return { name: 'login' }
    }

    if (to.name === 'login' && auth.isAuthenticated) {
      return { name: 'overview' }
    }
  })
}
