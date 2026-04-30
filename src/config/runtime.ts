declare global {
  interface Window {
    FUSION_CONFIG?: {
      bffUrl?:                string
      extBffDownloadPattern?: string
      extBffPublicPattern?:   string
      extBffPublicTag?:       string
      etlStorageClass?:       string
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
