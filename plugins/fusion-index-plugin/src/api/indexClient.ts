import { useAuthStore } from '@/stores/auth'
import type { PageResponse, JobTemplate, JobTemplateVersion, Job, JobVersion } from '@/types'

// In k8s: window.FUSION_CONFIG.indexBaseUrl = plugin NodePort URL;
//         nginx in the plugin container proxies /api/v1/ to index-backend:8080.
// In dev:  VITE_INDEX_BASE_URL=http://localhost:8080 (kubectl port-forward).
function apiBase(): string {
  return (window as Window & { FUSION_CONFIG?: { indexBaseUrl?: string } })
    .FUSION_CONFIG?.indexBaseUrl ?? import.meta.env.VITE_INDEX_BASE_URL ?? ''
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

export const indexClient = {
  listTemplates: (page = 0, pageSize = 20) =>
    apiFetch<PageResponse<JobTemplate>>(`/templates?page=${page}&pageSize=${pageSize}`),

  getTemplate: (id: number) =>
    apiFetch<JobTemplate>(`/templates/${id}`),

  listTemplateVersions: (id: number) =>
    apiFetch<JobTemplateVersion[]>(`/templates/${id}/versions`),

  getTemplateVersion: (id: number, vn: number) =>
    apiFetch<JobTemplateVersion>(`/templates/${id}/versions/${vn}`),

  listJobs: (page = 0, pageSize = 20) =>
    apiFetch<PageResponse<Job>>(`/jobs?page=${page}&pageSize=${pageSize}`),

  getJob: (id: number) =>
    apiFetch<Job>(`/jobs/${id}`),

  listJobVersions: (id: number) =>
    apiFetch<JobVersion[]>(`/jobs/${id}/versions`),
}
