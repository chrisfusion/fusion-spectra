import { bffGet } from './bffClient'

export interface ChangelogChanges {
  added?:   string[]
  changed?: string[]
  fixed?:   string[]
  removed?: string[]
}

export interface ChangelogProjectEntry {
  project: string
  version: string
  changes: ChangelogChanges
}

export interface ChangelogDateGroup {
  date:     string
  projects: ChangelogProjectEntry[]
}

export interface ChangelogPagination {
  page:     number
  pageSize: number
  total:    number
}

export interface ChangelogResponse {
  data:       ChangelogDateGroup[]
  pagination: ChangelogPagination
}

const BASE = '/api/content/api/v1'

export function listChangelog(page = 1, pageSize = 20): Promise<ChangelogResponse> {
  return bffGet<ChangelogResponse>(`${BASE}/changelog?page=${page}&pageSize=${pageSize}`)
}
