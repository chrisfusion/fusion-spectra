import { bffGet, bffPost, bffPut, bffDelete } from './bffClient'
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

interface PagedResponse<T> {
  items:    T[]
  total:    number
  page:     number
  pageSize: number
}

// ─── Artifacts ────────────────────────────────────────────────────────────────

export function listArtifacts(params?: {
  name?:     string
  tag?:      string
  type?:     string[]
  page?:     number
  pageSize?: number
}): Promise<ArtifactsPage> {
  const q = new URLSearchParams()
  if (params?.name)               q.set('name',     params.name)
  if (params?.tag)                q.set('tag',      params.tag)
  if (params?.page !== undefined) q.set('page',     String(params.page))
  if (params?.pageSize)           q.set('pageSize', String(params.pageSize))
  params?.type?.forEach(t =>      q.append('type',  t))
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

export function getFileDownloadUrl(artifactId: number, semver: string, fileId: number): string {
  return `${getBffUrl()}/api/index/api/v1/artifacts/${artifactId}/versions/${semver}/files/${fileId}/download`
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export function putTag(artifactId: number, tag: string, version: string): Promise<ArtifactTag> {
  return bffPut<ArtifactTag>(`${BASE}/artifacts/${artifactId}/tags/${tag}`, { version })
}

export function deleteTag(artifactId: number, tag: string): Promise<void> {
  return bffDelete(`${BASE}/artifacts/${artifactId}/tags/${tag}`)
}
