// URL query model of the artifact list (/fusion-index/artifacts). The query is the single
// source of truth for filters, sort and paging, so views survive back/forward and can be
// linked to — e.g. from the Index Cleanup health tiles.
import type { RouteLocationRaw } from 'vue-router'

export const ARTIFACT_LIST_PATH = '/fusion-index/artifacts'

// Query keys in UI units (days, MB); ArtifactListPage converts them to API params.
export type ArtifactListQuery = Partial<Record<
  | 'name' | 'type' | 'tag' | 'missingTag' | 'olderThanDays' | 'minVersions' | 'maxVersions'
  | 'hasFiles' | 'hasIncompleteFiles' | 'minTotalMB' | 'hasRetention'
  | 'sort' | 'order' | 'page' | 'size',
  string | string[]
>>

export interface ArtifactView {
  id:    string
  label: string
  icon:  string
  query: ArtifactListQuery
}

export const ARTIFACT_VIEWS: ArtifactView[] = [
  { id: 'largest',        label: 'Largest',               icon: 'mdi-weight',                query: { sort: 'totalSize', order: 'desc' } },
  { id: 'no-versions',    label: 'No versions',           icon: 'mdi-archive-off-outline',   query: { maxVersions: '0' } },
  { id: 'no-files',       label: 'Versions but no files', icon: 'mdi-folder-open-outline',   query: { minVersions: '1', hasFiles: 'false' } },
  { id: 'failed-uploads', label: 'Failed uploads',        icon: 'mdi-file-alert-outline',    query: { hasIncompleteFiles: 'true' } },
  { id: 'missing-latest', label: 'Missing "latest"',      icon: 'mdi-tag-off-outline',       query: { missingTag: 'latest' } },
]

export function artifactViewLink(id: string): RouteLocationRaw {
  const view = ARTIFACT_VIEWS.find(v => v.id === id)
  return { path: ARTIFACT_LIST_PATH, query: view?.query ?? {} }
}
