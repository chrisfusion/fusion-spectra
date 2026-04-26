import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function usePermission() {
  const auth = useAuthStore()

  const can = (permission: string, resourceId?: number | string): boolean => {
    const hasGlobal = auth.user?.permissions.includes(permission) ?? false
    if (hasGlobal) return true
    if (resourceId === undefined) return false
    return auth.user?.resource_permissions?.some(
      rp => rp.permission === permission && rp.resource_id === String(resourceId)
    ) ?? false
  }

  const hasRole = (role: string) => auth.user?.roles.includes(role) ?? false
  const isAdmin = computed(() => hasRole('admin'))

  return { can, hasRole, isAdmin }
}
