import { useAuthStore } from '@/stores/auth'
import type { VenvBuild, VenvBuildPage, ValidationResponse } from '@/types'

// In k8s: window.FUSION_CONFIG.forgeBaseUrl = plugin NodePort URL;
//         nginx in the plugin container proxies /api/v1/ to fusion-forge:8080.
// In dev:  VITE_FORGE_BASE_URL=http://localhost:8081 (kubectl port-forward).
function apiBase(): string {
  return (window as Window & { FUSION_CONFIG?: { forgeBaseUrl?: string } })
    .FUSION_CONFIG?.forgeBaseUrl || import.meta.env.VITE_FORGE_BASE_URL || ''
}

async function apiFetch<T>(path: string): Promise<T> {
  const auth = useAuthStore()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth.user?.accessToken) {
    headers['Authorization'] = `Bearer ${auth.user.accessToken}`
  }
  const res = await fetch(`${apiBase()}/api/v1${path}`, { headers })
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`)
  return res.json() as Promise<T>
}

async function apiMultipart<T>(path: string, body: FormData): Promise<T> {
  const auth = useAuthStore()
  const headers: Record<string, string> = {}
  if (auth.user?.accessToken) {
    headers['Authorization'] = `Bearer ${auth.user.accessToken}`
  }
  // Do not set Content-Type — browser sets it with the correct boundary for multipart
  const res = await fetch(`${apiBase()}/api/v1${path}`, { method: 'POST', headers, body })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function apiText(path: string): Promise<string | null> {
  const auth = useAuthStore()
  const headers: Record<string, string> = {}
  if (auth.user?.accessToken) {
    headers['Authorization'] = `Bearer ${auth.user.accessToken}`
  }
  const res = await fetch(`${apiBase()}/api/v1${path}`, { headers })
  if (res.status === 204) return ''
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`)
  return res.text()
}

export const forgeClient = {
  list: (page = 0, pageSize = 20, status?: string) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (status) params.set('status', status)
    return apiFetch<VenvBuildPage>(`/venvs?${params}`)
  },

  get: (id: number) => apiFetch<VenvBuild>(`/venvs/${id}`),

  create: (form: FormData) => apiMultipart<VenvBuild>('/venvs', form),

  validate: (form: FormData) => apiMultipart<ValidationResponse>('/venvs/validate', form),

  getLogs: (id: number) => apiText(`/venvs/${id}/logs`),
}
