import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function usePermission() {
  const auth = useAuthStore()

  const can     = (permission: string) => auth.user?.permissions.includes(permission) ?? false
  const hasRole = (role: string)       => auth.user?.roles.includes(role) ?? false
  const isAdmin = computed(() => hasRole('admin'))

  return { can, hasRole, isAdmin }
}
