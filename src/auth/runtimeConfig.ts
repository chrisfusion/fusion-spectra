// Runtime configuration injected by Kubernetes via a mounted ConfigMap
// (public/config.js → /usr/share/nginx/html/config.js).
// In local dev the file exists but is empty; Vite env vars take precedence.

export interface RuntimeConfig {
  authMode?: string
  oidcAuthority?: string
  oidcClientId?: string
  oidcRedirectUri?: string
  devToken?: string
  // Base URL of the fusion-index-plugin NodePort (browser-accessible).
  // The plugin's nginx proxies /api/v1/ to index-backend via k8s hostname.
  indexBaseUrl?: string
}

declare global {
  interface Window {
    FUSION_CONFIG?: RuntimeConfig
  }
}

export function cfg(): RuntimeConfig {
  return window.FUSION_CONFIG ?? {}
}
