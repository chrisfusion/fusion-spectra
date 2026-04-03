/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_MODE: 'oidc' | 'bypass' | 'token'
  readonly VITE_OIDC_AUTHORITY: string
  readonly VITE_OIDC_CLIENT_ID: string
  readonly VITE_OIDC_REDIRECT_URI?: string
  readonly VITE_DEV_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
