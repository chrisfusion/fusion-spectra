import { bffGet } from './bffClient'

// ── Changelog ──────────────────────────────────────────────────────────────────

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

// ── Help articles ──────────────────────────────────────────────────────────────

export type DiátaxisType = 'tutorial' | 'how-to' | 'reference' | 'explanation'

export const DIATAXIS_TYPES: DiátaxisType[] = ['tutorial', 'how-to', 'reference', 'explanation']

export const DIATAXIS_LABELS: Record<DiátaxisType, string> = {
  tutorial:    'Tutorial',
  'how-to':    'How-to',
  reference:   'Reference',
  explanation: 'Explanation',
}

export const DIATAXIS_COLORS: Record<DiátaxisType, string> = {
  tutorial:    'var(--fs-violet)',
  'how-to':    'var(--fs-pos)',
  reference:   'var(--fs-blue)',
  explanation: 'var(--fs-amber)',
}

export interface HelpArticle {
  service: string
  type:    DiátaxisType
  slug:    string
  title:   string
  tags:    string[]
  routes:  string[]
  summary: string
}

export interface HelpArticleDetail extends HelpArticle {
  body: string
}

export interface HelpListResponse {
  data:       HelpArticle[]
  pagination: ChangelogPagination
}

// ── Videos ─────────────────────────────────────────────────────────────────────

export interface VideoItem {
  service:      string
  slug:         string
  title:        string
  summary:      string
  thumbnailUrl: string
  videoUrl:     string
  tags:         string[]
}

export interface VideoListResponse {
  data:       VideoItem[]
  pagination: ChangelogPagination
}

// ── API functions ──────────────────────────────────────────────────────────────

const BASE = '/api/content/api/v1'

export function listChangelog(page = 1, pageSize = 20): Promise<ChangelogResponse> {
  return bffGet<ChangelogResponse>(`${BASE}/changelog?page=${page}&pageSize=${pageSize}`)
}

export function listHelp(params: {
  service?:  string
  type?:     string
  tag?:      string
  route?:    string
  q?:        string
  page?:     number
  pageSize?: number
} = {}): Promise<HelpListResponse> {
  const q = new URLSearchParams()
  if (params.service)  q.set('service',  params.service)
  if (params.type)     q.set('type',     params.type)
  if (params.tag)      q.set('tag',      params.tag)
  if (params.route)    q.set('route',    params.route)
  if (params.q)               q.set('q',        params.q)
  if (params.page     != null) q.set('page',     String(params.page))
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize))
  const qs = q.toString()
  return bffGet<HelpListResponse>(`${BASE}/help${qs ? '?' + qs : ''}`)
}

export function getHelpArticle(service: string, type: string, slug: string): Promise<HelpArticleDetail> {
  return bffGet<HelpArticleDetail>(`${BASE}/help/${service}/${type}/${slug}`)
}

export function listVideos(params: {
  service?:  string
  page?:     number
  pageSize?: number
} = {}): Promise<VideoListResponse> {
  const q = new URLSearchParams()
  if (params.service)          q.set('service',  params.service)
  if (params.page     != null) q.set('page',     String(params.page))
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize))
  const qs = q.toString()
  return bffGet<VideoListResponse>(`${BASE}/videos${qs ? '?' + qs : ''}`)
}
