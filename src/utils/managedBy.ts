// fusion-flux stamps every API-created resource with this label ("manual" by default,
// "wizard" when fusion-wizard owns it); kubectl/Flux-created objects carry none.
export const MANAGED_BY_LABEL = 'fusion-platform.io/managed-by'

export type ManagedByFilterValue = '' | 'manual' | 'wizard' | 'none'

export function managedBy(meta: { labels?: Record<string, string> } | undefined): string {
  return meta?.labels?.[MANAGED_BY_LABEL] ?? ''
}

export function matchesManagedBy(meta: { labels?: Record<string, string> } | undefined, filter: ManagedByFilterValue): boolean {
  if (!filter) return true
  const v = managedBy(meta)
  return filter === 'none' ? v === '' : v === filter
}
