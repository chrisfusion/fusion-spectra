import { useAuthStore } from '@/stores/auth'
import { createUserManager } from './oidc'
import { createBypassUser, createTokenUser } from './devBypass'
import { cfg } from './runtimeConfig'
import type { UserManager } from 'oidc-client-ts'

export type AuthMode = 'oidc' | 'bypass' | 'token'

// Runtime config (ConfigMap) takes precedence over build-time env vars.
export const authMode: AuthMode =
  ((cfg().authMode as AuthMode) || (import.meta.env.VITE_AUTH_MODE as AuthMode) || 'oidc')

let _userManager: UserManager | null = null

function getUserManager(): UserManager | null {
  if (authMode !== 'oidc') return null
  if (!_userManager) _userManager = createUserManager()
  return _userManager
}

export async function initAuth(): Promise<void> {
  const auth = useAuthStore()

  if (authMode === 'bypass') {
    auth.setUser(createBypassUser())
    return
  }

  if (authMode === 'token') {
    const token = cfg().devToken || import.meta.env.VITE_DEV_TOKEN
    if (!token) throw new Error('authMode=token requires devToken (ConfigMap) or VITE_DEV_TOKEN to be set')
    auth.setUser(createTokenUser(token))
    return
  }

  // oidc — try to restore an existing session silently
  const mgr = getUserManager()!
  const user = await mgr.getUser()
  if (user && !user.expired) {
    auth.setUser({
      sub: user.profile.sub,
      name: user.profile.name ?? user.profile.preferred_username ?? user.profile.sub,
      email: user.profile.email ?? '',
      preferred_username: user.profile.preferred_username ?? user.profile.sub,
      accessToken: user.access_token,
    })
  }
}

export async function login(): Promise<void> {
  const mgr = getUserManager()
  if (!mgr) return
  await mgr.signinRedirect()
}

export async function handleCallback(): Promise<void> {
  const mgr = getUserManager()
  if (!mgr) return
  const user = await mgr.signinRedirectCallback()
  const auth = useAuthStore()
  auth.setUser({
    sub: user.profile.sub,
    name: user.profile.name ?? user.profile.preferred_username ?? user.profile.sub,
    email: user.profile.email ?? '',
    preferred_username: user.profile.preferred_username ?? user.profile.sub,
    accessToken: user.access_token,
  })
}

export async function logout(): Promise<void> {
  const mgr = getUserManager()
  if (mgr) {
    // Initiate IdP redirect first — clearUser() after so the router guard
    // does not fire between the two calls and race to /login.
    await mgr.signoutRedirect()
  }
  useAuthStore().clearUser()
}
