import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface AuthUser {
  sub: string
  name: string
  email: string
  preferred_username: string
  accessToken: string
}

// Store ID 'auth' matches the shell's auth store. When pinia is shared via
// Module Federation, useAuthStore() returns the same instance the shell initialised.
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const isAuthenticated = computed(() => user.value !== null)

  function setUser(u: AuthUser) { user.value = u }
  function clearUser() { user.value = null }

  return { user, isAuthenticated, setUser, clearUser }
})
