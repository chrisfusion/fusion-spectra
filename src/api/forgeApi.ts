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
  pythonVersion:        string
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

// ─── Git Builds ───────────────────────────────────────────────────────────────

export interface GitBuildPayload {
  repo_url:         string
  repo_ref?:        string
  metadata_source?: 'manual' | 'version' | 'full'
  name?:            string
  version?:         string
  description?:     string
  entrypoint_file?: string
  project_dir?:     string
  python_version?:  string
}

export interface GitBuild extends VenvBuild {
  repoUrl:        string
  repoRef:        string
  metadataSource: 'manual' | 'version' | 'full'
  entrypointFile: string | null
  projectDir:     string | null
}

export interface GitBuildPage {
  items:    GitBuild[]
  total:    number
  page:     number
  pageSize: number
}

export function listGitBuilds(params?: {
  page?:     number
  pageSize?: number
  status?:   string | string[]
  name?:     string
}): Promise<GitBuildPage> {
  const q = new URLSearchParams()
  if (params?.page !== undefined) q.set('page',     String(params.page))
  if (params?.pageSize)           q.set('pageSize', String(params.pageSize))
  if (params?.status) {
    const statuses = Array.isArray(params.status) ? params.status : [params.status]
    statuses.forEach(s => q.append('status', denormalizeStatus(s)))
  }
  if (params?.name) q.set('name', params.name)
  const qs = q.toString()
  return bffGet<GitBuildPage>(`${BASE}/gitbuilds${qs ? '?' + qs : ''}`)
    .then(p => ({ ...p, items: p.items.map(normalizeStatus) as GitBuild[] }))
}

export function createGitBuild(payload: GitBuildPayload): Promise<GitBuild> {
  return bffFetch(`${BASE}/gitbuilds`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).then(r => r.json() as Promise<GitBuild>)
}

export function getGitBuild(id: number): Promise<GitBuild> {
  return bffGet<GitBuild>(`${BASE}/gitbuilds/${id}`).then(b => normalizeStatus(b) as GitBuild)
}

export async function getGitBuildLogs(id: number): Promise<string> {
  const res = await bffFetch(`${BASE}/gitbuilds/${id}/logs`)
  if (res.status === 204) return ''
  return res.text()
}

export async function validateGitBuild(payload: GitBuildPayload): Promise<ValidationResult> {
  const res = await fetch(`${getBffUrl()}${BASE}/gitbuilds/validate`, {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(payload),
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

// ─── App Builds ───────────────────────────────────────────────────────────────

export interface AppBuildPayload {
  repo_url:     string
  repo_ref?:    string
  project_dir?: string
}

export interface AppBuild extends VenvBuild {
  repoUrl:             string
  repoRef:             string
  projectDir:          string | null
  runner:              string | null
  baseDependenciesUrl: string | null
}

export interface AppBuildPage {
  items:    AppBuild[]
  total:    number
  page:     number
  pageSize: number
}

export function listAppBuilds(params?: {
  page?:     number
  pageSize?: number
  status?:   string | string[]
  name?:     string
}): Promise<AppBuildPage> {
  const q = new URLSearchParams()
  if (params?.page !== undefined) q.set('page',     String(params.page))
  if (params?.pageSize)           q.set('pageSize', String(params.pageSize))
  if (params?.status) {
    const statuses = Array.isArray(params.status) ? params.status : [params.status]
    statuses.forEach(s => q.append('status', denormalizeStatus(s)))
  }
  if (params?.name) q.set('name', params.name)
  const qs = q.toString()
  return bffGet<AppBuildPage>(`${BASE}/appbuilds${qs ? '?' + qs : ''}`)
    .then(p => ({ ...p, items: p.items.map(normalizeStatus) as AppBuild[] }))
}

export function createAppBuild(payload: AppBuildPayload): Promise<AppBuild> {
  return bffFetch(`${BASE}/appbuilds`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).then(r => r.json() as Promise<AppBuild>)
}

export function getAppBuild(id: number): Promise<AppBuild> {
  return bffGet<AppBuild>(`${BASE}/appbuilds/${id}`).then(b => normalizeStatus(b) as AppBuild)
}

export async function getAppBuildLogs(id: number): Promise<string> {
  const res = await bffFetch(`${BASE}/appbuilds/${id}/logs`)
  if (res.status === 204) return ''
  return res.text()
}

export async function validateAppBuild(payload: AppBuildPayload): Promise<ValidationResult> {
  const res = await fetch(`${getBffUrl()}${BASE}/appbuilds/validate`, {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(payload),
    credentials: 'include',
  })
  if (res.status === 401) {
    window.location.href = `${getBffUrl()}/bff/login`
    throw new ApiError(401, 'Unauthorized')
  }
  return res.json() as Promise<ValidationResult>
}

// ─── GitWatchers ──────────────────────────────────────────────────────────────

export interface SecretKeyRef {
  name: string
  key:  string
}

export interface GitWatcherSpec {
  repoURL:         string
  repoRef?:        string
  buildType:       'git' | 'app'
  enabled?:        boolean
  tokenSecretRef?: SecretKeyRef
  name?:           string
  metadataSource?: 'manual' | 'version' | 'full'
  version?:        string
  pythonVersion?:  string
  entrypointFile?: string
  projectDir?:     string
  description?:    string
}

export interface GitWatcherStatus {
  phase:               string
  lastSeenCommit?:     string
  lastBuiltVersion?:   string
  lastBuildName?:      string
  lastBuildVersion?:   string
  consecutiveFailures: number
  lastCheckedAt?:      string
  lastError?:          string
  message?:            string
}

export interface GitWatcher {
  name:      string
  namespace: string
  createdAt: string
  spec:      GitWatcherSpec
  status:    GitWatcherStatus
}

export interface GitWatcherPage {
  items:    GitWatcher[]
  total:    number
  page:     number
  pageSize: number
}

export interface CreateGitWatcherPayload {
  name:             string
  repo_url:         string
  repo_ref?:        string
  build_type:       'git' | 'app'
  enabled?:         boolean
  token_secret_ref?: SecretKeyRef
  artifact_name?:   string
  metadata_source?: 'manual' | 'version' | 'full'
  version?:         string
  python_version?:  string
  entrypoint_file?: string
  project_dir?:     string
  description?:     string
}

export interface UpdateGitWatcherPayload {
  repo_url:         string
  repo_ref?:        string
  build_type:       'git' | 'app'
  enabled?:         boolean
  token_secret_ref?: SecretKeyRef
  artifact_name?:   string
  metadata_source?: 'manual' | 'version' | 'full'
  version?:         string
  python_version?:  string
  entrypoint_file?: string
  project_dir?:     string
  description?:     string
}

export function listGitWatchers(params?: {
  page?:     number
  pageSize?: number
}): Promise<GitWatcherPage> {
  const q = new URLSearchParams()
  if (params?.page !== undefined) q.set('page',     String(params.page))
  if (params?.pageSize)           q.set('pageSize', String(params.pageSize))
  const qs = q.toString()
  return bffGet<GitWatcherPage>(`${BASE}/gitwatchers${qs ? '?' + qs : ''}`)
}

export function getGitWatcher(name: string): Promise<GitWatcher> {
  return bffGet<GitWatcher>(`${BASE}/gitwatchers/${encodeURIComponent(name)}`)
}

export function createGitWatcher(payload: CreateGitWatcherPayload): Promise<GitWatcher> {
  return bffFetch(`${BASE}/gitwatchers`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).then(r => r.json() as Promise<GitWatcher>)
}

export function updateGitWatcher(name: string, payload: UpdateGitWatcherPayload): Promise<GitWatcher> {
  return bffFetch(`${BASE}/gitwatchers/${encodeURIComponent(name)}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).then(r => r.json() as Promise<GitWatcher>)
}

export async function deleteGitWatcher(name: string): Promise<void> {
  await bffFetch(`${BASE}/gitwatchers/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

// ─── Bulk Delete / Zombie Cleanup ─────────────────────────────────────────────

export interface BulkDeleteBuildsRequest {
  statuses:    string[]
  older_than:  string
  build_type?: string
}

export interface BulkDeleteFailure {
  id:    number
  error: string
}

export interface BulkDeleteBuildsResult {
  deleted: number[]
  failed:  BulkDeleteFailure[]
}

export function bulkDeleteBuilds(req: BulkDeleteBuildsRequest): Promise<BulkDeleteBuildsResult> {
  return bffFetch(`${BASE}/builds`, {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req),
  }).then(r => r.json() as Promise<BulkDeleteBuildsResult>)
}

export interface ZombieCleanupRequest {
  older_than:  string
  build_type?: string
}

export function zombieCleanupBuilds(req: ZombieCleanupRequest): Promise<BulkDeleteBuildsResult> {
  return bffFetch(`${BASE}/builds/zombie-cleanup`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req),
  }).then(r => r.json() as Promise<BulkDeleteBuildsResult>)
}
