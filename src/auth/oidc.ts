import { UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { cfg } from './runtimeConfig'

export function createUserManager(): UserManager {
  return new UserManager({
    authority:    cfg().oidcAuthority    || import.meta.env.VITE_OIDC_AUTHORITY,
    client_id:    cfg().oidcClientId     || import.meta.env.VITE_OIDC_CLIENT_ID,
    redirect_uri: cfg().oidcRedirectUri  || import.meta.env.VITE_OIDC_REDIRECT_URI
                  || `${window.location.origin}/auth/callback`,
    post_logout_redirect_uri: window.location.origin,
    response_type: 'code',
    scope: 'openid profile email',
    userStore: new WebStorageStateStore({ store: localStorage }),
  })
}
