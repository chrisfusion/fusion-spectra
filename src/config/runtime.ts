declare global {
  interface Window {
    FUSION_CONFIG?: {
      bffUrl?:                string
      extBffDownloadPattern?: string
      extBffPublicPattern?:   string
      extBffPublicTag?:       string
      etlStorageClass?:       string
      gitlabUrl?:             string
      gitlabProjectPath?:     string
      serviceUrlPattern?:     string
    }
  }
}

export function getBffUrl(): string {
  return window.FUSION_CONFIG?.bffUrl ?? import.meta.env.VITE_BFF_URL ?? 'http://bff.fusion.local'
}

export function getExtBffDownloadPattern(): string {
  return window.FUSION_CONFIG?.extBffDownloadPattern ?? ''
}

export function getExtBffPublicPattern(): string {
  return window.FUSION_CONFIG?.extBffPublicPattern ?? ''
}

export function getExtBffPublicTag(): string {
  return window.FUSION_CONFIG?.extBffPublicTag ?? 'public'
}

export function getEtlStorageClass(): string {
  return window.FUSION_CONFIG?.etlStorageClass ?? ''
}

export function getGitlabUrl(): string {
  return window.FUSION_CONFIG?.gitlabUrl ?? import.meta.env.VITE_GITLAB_URL ?? 'https://gitlab.fusion.local'
}

export function getGitlabProjectPath(): string {
  return window.FUSION_CONFIG?.gitlabProjectPath ?? import.meta.env.VITE_GITLAB_PROJECT_PATH ?? ''
}

// URL a deployed service is reachable at; `{name}` is its ingress name (the DNS label weave prefixes
// to its cluster-wide ingress.hostSuffix). Empty = unknown, callers fall back to showing the name only.
export function getServiceUrlPattern(): string {
  return window.FUSION_CONFIG?.serviceUrlPattern ?? ''
}
