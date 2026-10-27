import { bffFetch, bffGet, bffPost, bffPut, bffDelete, ApiError } from './bffClient'
import { getBffUrl } from '@/config/runtime'

const BASE = '/api/index/api/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TypeResponse {
  id:          number
  name:        string
  description: string | null
  createdAt:   string
  updatedAt:   string
}

export interface Artifact {
  id:          number
  fullName:    string
  description: string | null
  types:       TypeResponse[]
  versionCount?:        number
  largestVersionBytes?: number
  totalBytes?:          number
  createdAt:   string
  updatedAt:   string
}

export interface ArtifactTag {
  id:         number
  artifactId: number
  tag:        string
  versionId:  number
  createdAt:  string
  updatedAt:  string
}

export interface ArtifactVersion {
  id:         number
  artifactId: number
  version:    string
  major:      number
  minor:      number
  patch:      number
  config:     string | null
  totalBytes?: number
  tags:       ArtifactTag[]
  createdAt:  string
}

export interface ArtifactFile {
  id:             number
  versionId:      number
  name:           string
  contentType:    string | null
  sizeBytes:      number | null
  storageBackend: string
  status:         string
  downloadUrl:    string
  createdAt:      string
  updatedAt:      string
}

export interface CreateArtifactRequest {
  fullName:    string
  description?: string
}

export interface CreateVersionRequest {
  version: string
  config?: string
  tags?:   string[]
}

export interface ArtifactsPage {
  items:    Artifact[]
  total:    number
  page:     number
  pageSize: number
}

export interface PagedResponse<T> {
  items:    T[]
  total:    number
  page:     number
  pageSize: number
}

// ─── Artifacts ────────────────────────────────────────────────────────────────

export type ArtifactSort = 'createdAt' | 'name' | 'versionCount' | 'largestVersion' | 'totalSize'

// All filters combine with AND (type itself is OR across its values).
export interface ArtifactListParams {
  name?:               string    // full-name prefix
  tag?:                string
  missingTag?:         string
  type?:               string[]
  olderThan?:          string    // RFC3339
  minVersions?:        number
  maxVersions?:        number    // 0 = artifacts without versions
  hasFiles?:           boolean
  hasIncompleteFiles?: boolean
  minTotalBytes?:      number
  hasRetention?:       boolean
  sort?:               ArtifactSort
  order?:              'asc' | 'desc'
  page?:               number    // 0-based
  pageSize?:           number
}

export function listArtifacts(params: ArtifactListParams = {}): Promise<ArtifactsPage> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue
    if (Array.isArray(v)) v.forEach(x => q.append(k, x))
    else q.set(k, String(v))
  }
  const qs = q.toString()
  return bffGet<PagedResponse<Artifact>>(`${BASE}/artifacts${qs ? '?' + qs : ''}`)
}

export function getArtifact(id: number): Promise<Artifact> {
  return bffGet<Artifact>(`${BASE}/artifacts/${id}`)
}

export function createArtifact(body: CreateArtifactRequest): Promise<Artifact> {
  return bffPost<Artifact>(`${BASE}/artifacts`, body)
}

export function deleteArtifact(id: number): Promise<void> {
  return bffDelete(`${BASE}/artifacts/${id}`)
}

export function deleteVersion(artifactId: number, semver: string): Promise<void> {
  return bffDelete(`${BASE}/artifacts/${artifactId}/versions/${semver}`)
}

// ─── Versions ─────────────────────────────────────────────────────────────────

export function listVersions(artifactId: number): Promise<ArtifactVersion[]> {
  return bffGet<ArtifactVersion[]>(`${BASE}/artifacts/${artifactId}/versions`)
}

export function getVersion(artifactId: number, semver: string): Promise<ArtifactVersion> {
  return bffGet<ArtifactVersion>(`${BASE}/artifacts/${artifactId}/versions/${semver}`)
}

export function createVersion(artifactId: number, body: CreateVersionRequest): Promise<ArtifactVersion> {
  return bffPost<ArtifactVersion>(`${BASE}/artifacts/${artifactId}/versions`, body)
}

// ─── Files ────────────────────────────────────────────────────────────────────

export function listFiles(artifactId: number, semver: string): Promise<ArtifactFile[]> {
  return bffGet<ArtifactFile[]>(`${BASE}/artifacts/${artifactId}/versions/${semver}/files`)
}

export function uploadFile(
  artifactId: number,
  semver: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<ArtifactFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${getBffUrl()}${BASE}/artifacts/${artifactId}/versions/${semver}/files`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status === 401) {
        window.location.href = `${getBffUrl()}/bff/login`
        return
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as ArtifactFile)
      } else {
        const body = JSON.parse(xhr.responseText || '{}') as { error?: string }
        reject(new ApiError(xhr.status, body.error ?? xhr.statusText))
      }
    }
    xhr.onerror = () => reject(new ApiError(0, 'Network error'))
    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

export function getFileDownloadUrl(artifactId: number, semver: string, fileId: number): string {
  return `${getBffUrl()}/api/index/api/v1/artifacts/${artifactId}/versions/${semver}/files/${fileId}/download`
}

// ─── Types ────────────────────────────────────────────────────────────────────

export function listTypes(): Promise<TypeResponse[]> {
  return bffGet<TypeResponse[]>(`${BASE}/types`)
}

export function createType(body: { name: string; description?: string }): Promise<TypeResponse> {
  return bffPost<TypeResponse>(`${BASE}/types`, body)
}

export function updateType(id: number, body: { name: string; description?: string }): Promise<TypeResponse> {
  return bffPut<TypeResponse>(`${BASE}/types/${id}`, body)
}

export function deleteType(id: number): Promise<void> {
  return bffDelete(`${BASE}/types/${id}`)
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export interface MetricsTypeCount {
  typeName: string
  count:    number
}

export interface RegistrySnapshot {
  cachedAt:                 string
  totalArtifacts:           number
  totalVersions:            number
  totalTags:                number
  filesAvailable:           number
  filesPending:             number
  filesError:               number
  totalStorageBytes:        number
  artifactsWithoutTags:     number
  artifactsWithoutVersions: number
  artifactsWithoutFiles:    number
  versionsWithoutFiles:     number
  brokenTags:               number
  unusedTypes:              number
  retentionPolicies:        number
  typeCounts:               MetricsTypeCount[]
  storageBytesByBackend:    { backend: string; bytes: number }[]
}

export function getMetrics(): Promise<RegistrySnapshot> {
  return bffGet<RegistrySnapshot>('/api/index/q/metrics')
}

// ─── Admin maintenance ────────────────────────────────────────────────────────

const ADMIN_BASE = `${BASE}/admin`

export interface BulkDeleteResult {
  deleted: number
  skipped: number
}

// Cleanups that list / bulk-delete by age only: GET and DELETE /admin/<path>?olderThan=
export type AdminCleanupPath =
  | 'artifacts/empty' | 'artifacts/no-files' | 'versions/empty' | 'files/incomplete' | 'types/unused'

interface AdminListParams {
  olderThan: string
  page?:     number
  pageSize?: number
}

export function adminList<T>(path: AdminCleanupPath, p: AdminListParams): Promise<PagedResponse<T>> {
  const q = new URLSearchParams({ olderThan: p.olderThan })
  if (p.page !== undefined) q.set('page',     String(p.page))
  if (p.pageSize)           q.set('pageSize', String(p.pageSize))
  return bffGet(`${ADMIN_BASE}/${path}?${q}`)
}

export async function adminDelete(path: AdminCleanupPath, olderThan: string): Promise<BulkDeleteResult> {
  const res = await bffFetch(`${ADMIN_BASE}/${path}?olderThan=${encodeURIComponent(olderThan)}`, { method: 'DELETE' })
  return res.json() as Promise<BulkDeleteResult>
}

// ─── Version filters / bulk version delete ────────────────────────────────────

// Filters shared by GET /versions and DELETE /admin/versions; all given ones combine with AND.
export interface VersionFilter {
  keepLast?:           number
  olderThan?:          string
  from?:               string
  below?:              string
  hasFiles?:           boolean
  hasIncompleteFiles?: boolean
  minBytes?:           number
  maxBytes?:           number
}

export interface BulkVersionDeleteResult {
  deleted:  number
  skipped:  number
  dryRun:   boolean
  versions: { artifactId: number; version: string }[]
}

function versionFilterQS(f: VersionFilter): URLSearchParams {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  return q
}

// deletable=true: exactly the versions DELETE /admin/versions with the same filters removes.
export function listAllVersions(f: VersionFilter, page: number, pageSize: number, deletable = false): Promise<PagedResponse<ArtifactVersion>> {
  const q = versionFilterQS(f)
  q.set('page', String(page)); q.set('pageSize', String(pageSize))
  if (deletable) q.set('deletable', 'true')
  return bffGet(`${BASE}/versions?${q}`)
}

export async function bulkDeleteVersions(f: VersionFilter, dryRun: boolean): Promise<BulkVersionDeleteResult> {
  const q = versionFilterQS(f)
  if (dryRun) q.set('dryRun', 'true')
  const res = await bffFetch(`${ADMIN_BASE}/versions?${q}`, { method: 'DELETE' })
  return res.json() as Promise<BulkVersionDeleteResult>
}

// ─── Retention policies ───────────────────────────────────────────────────────

export interface RetentionRule {
  keepLast?:   number | null
  maxAgeDays?: number | null
}

export interface RetentionPolicy {
  id:            number
  artifactId:    number | null
  artifactName?: string
  typeId:        number | null
  typeName?:     string
  keepLast:      number | null
  maxAgeDays:    number | null
  createdAt:     string
  updatedAt:     string
}

export function listRetentionPolicies(): Promise<RetentionPolicy[]> {
  return bffGet<RetentionPolicy[]>(`${BASE}/retention-policies`)
}

export function setRetention(scope: 'artifacts' | 'types', id: number, rule: RetentionRule): Promise<RetentionPolicy> {
  return bffPut<RetentionPolicy>(`${BASE}/${scope}/${id}/retention`, rule)
}

export function deleteRetention(scope: 'artifacts' | 'types', id: number): Promise<void> {
  return bffDelete(`${BASE}/${scope}/${id}/retention`)
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export function putTag(artifactId: number, tag: string, version: string): Promise<ArtifactTag> {
  return bffPut<ArtifactTag>(`${BASE}/artifacts/${artifactId}/tags/${tag}`, { version })
}

export function deleteTag(artifactId: number, tag: string): Promise<void> {
  return bffDelete(`${BASE}/artifacts/${artifactId}/tags/${tag}`)
}

export interface TagListItem {
  id:           number
  artifactId:   number
  artifactName: string
  tag:          string
  versionId:    number
  version:      string
  broken:       boolean
  updatedAt:    string
}

// broken=true: tags whose version has no AVAILABLE file.
export function listTags(p: { tag?: string; broken?: boolean; page?: number; pageSize?: number }): Promise<PagedResponse<TagListItem>> {
  const q = new URLSearchParams()
  if (p.tag)                 q.set('tag',      p.tag)
  if (p.broken !== undefined) q.set('broken',  String(p.broken))
  if (p.page !== undefined)  q.set('page',     String(p.page))
  if (p.pageSize)            q.set('pageSize', String(p.pageSize))
  return bffGet(`${BASE}/tags?${q}`)
}
