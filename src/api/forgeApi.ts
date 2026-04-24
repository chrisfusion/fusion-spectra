import { bffGet, bffFetch, ApiError } from './bffClient'
import { getBffUrl } from '@/config/runtime'

const BASE = '/api/forge/api/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Violation {
  line:    number
  content: string
  message: string
}

export interface ValidationResult {
  valid:      boolean
  violations: Violation[]
}

export interface VenvBuild {
  id:                   number
  name:                 string
  version:              string
  description:          string | null
  status:               'PENDING' | 'BUILDING' | 'SUCCEEDED' | 'FAILED'
  buildType:            string
  creatorId:            string | null
  creatorEmail:         string | null
  indexArtifactId:      number | null
  indexArtifactVersion: string | null
  ciBuildName:          string | null
  createdAt:            string
  updatedAt:            string
}

export interface VenvPage {
  items:    VenvBuild[]
  total:    number
  page:     number
  pageSize: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Backend uses "SUCCESS"; frontend uses canonical "SUCCEEDED". Normalize on read, denormalize on write.
function normalizeStatus(b: VenvBuild): VenvBuild {
  return (b.status as string) === 'SUCCESS' ? { ...b, status: 'SUCCEEDED' } : b
}
function denormalizeStatus(s: string): string {
  return s === 'SUCCEEDED' ? 'SUCCESS' : s
}

// ─── Venvs ────────────────────────────────────────────────────────────────────

export function listVenvs(params?: {
  page?:     number
  pageSize?: number
  status?:   string | string[]
  name?:     string
}): Promise<VenvPage> {
  const q = new URLSearchParams()
  if (params?.page !== undefined) q.set('page',     String(params.page))
  if (params?.pageSize)           q.set('pageSize', String(params.pageSize))
  if (params?.status) {
    const statuses = Array.isArray(params.status) ? params.status : [params.status]
    statuses.forEach(s => q.append('status', denormalizeStatus(s)))
  }
  if (params?.name) q.set('name', params.name)
  const qs = q.toString()
  return bffGet<VenvPage>(`${BASE}/venvs${qs ? '?' + qs : ''}`)
    .then(p => ({ ...p, items: p.items.map(normalizeStatus) }))
}

export function getVenv(id: number): Promise<VenvBuild> {
  return bffGet<VenvBuild>(`${BASE}/venvs/${id}`).then(normalizeStatus)
}

export function createVenv(formData: FormData): Promise<VenvBuild> {
  return bffFetch(`${BASE}/venvs`, { method: 'POST', body: formData })
    .then(r => r.json() as Promise<VenvBuild>)
}

// validateVenv uses raw fetch because bffFetch throws on 422 and consumes the
// body; the validate endpoint returns a meaningful ValidationResult on 422.
export async function validateVenv(formData: FormData): Promise<ValidationResult> {
  const res = await fetch(`${getBffUrl()}${BASE}/venvs/validate`, {
    method:      'POST',
    body:        formData,
    credentials: 'include',
  })
  if (res.status === 401) {
    window.location.href = `${getBffUrl()}/bff/login`
    throw new ApiError(401, 'Unauthorized')
  }
  return res.json() as Promise<ValidationResult>
}

export async function getVenvLogs(id: number): Promise<string> {
  const res = await bffFetch(`${BASE}/venvs/${id}/logs`)
  if (res.status === 204) return ''
  return res.text()
}
