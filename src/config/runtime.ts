declare global {
  interface Window {
    FUSION_CONFIG?: { bffUrl?: string }
  }
}

export function getBffUrl(): string {
  return window.FUSION_CONFIG?.bffUrl ?? import.meta.env.VITE_BFF_URL ?? 'http://bff.fusion.local'
}
