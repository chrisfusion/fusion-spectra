// Runtime configuration injected by Kubernetes via a mounted ConfigMap
// (public/config.js → /usr/share/nginx/html/config.js).
// In local dev the file exists but is empty; Vite env vars take precedence.

export interface RuntimeConfig {
  authMode?: string
  oidcAuthority?: string
  oidcClientId?: string
  oidcRedirectUri?: string
  devToken?: string
}

declare global {
  interface Window {
    FUSION_CONFIG?: RuntimeConfig
  }
}

export function cfg(): RuntimeConfig {
  return window.FUSION_CONFIG ?? {}
}
