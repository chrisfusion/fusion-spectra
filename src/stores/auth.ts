import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getBffUrl } from '@/config/runtime'

export interface ResourcePermission {
  permission:    string
  resource_type: string
  resource_id:   string
}

export interface UserInfo {
  sub:                  string
  email:                string
  name:                 string
  roles:                string[]
  permissions:          string[]
  resource_permissions: ResourcePermission[]
}

export const useAuthStore = defineStore('auth', () => {
  const user        = ref<UserInfo | null>(null)
  const initialised = ref(false)

  async function init(): Promise<boolean> {
    if (initialised.value) return user.value !== null

    try {
      const res = await fetch(`${getBffUrl()}/bff/userinfo`, {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json() as UserInfo
        data.resource_permissions ??= []
        user.value = data
        initialised.value = true
        return true
      }
    } catch {
      // network error — treat as unauthenticated
    }

    initialised.value = true
    return false
  }

  function loginRedirect() {
    window.location.href = `${getBffUrl()}/bff/login`
  }

  async function logout() {
    await fetch(`${getBffUrl()}/bff/logout`, {
      method: 'POST',
      credentials: 'include'
    }).catch(() => {})
    user.value = null
    initialised.value = false
  }

  return { user, initialised, init, loginRedirect, logout }
})
