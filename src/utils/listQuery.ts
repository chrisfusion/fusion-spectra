// Shared list parameters of fusion-weave and fusion-wizard (fusion-shared/listquery):
// q, since/until (RFC 3339 or a duration back from now: 24h, 7d), source (gitops or a
// managed-by value), sort (prefix - for descending), limit, continue. Multi-value filters
// are sent comma-separated and match any value; different filters combine with AND.

export interface ListParams {
  q?:             string
  since?:         string
  until?:         string
  source?:        string[]
  sort?:          string
  limit?:         number
  continue?:      string
  labelSelector?: string   // weave only
}

// Pagination metadata of weave lists (Kubernetes list shape): both set only while more items follow.
export interface ListMeta {
  continue?:           string
  remainingItemCount?: number
}

export interface K8sPage<T> {
  metadata?: ListMeta
  items:     T[]
}

type QueryValue = string | number | boolean | string[] | undefined | null

// Builds "?a=1&b=x,y" (or "") — empty strings, empty arrays and undefined are left out.
export function toQueryString(params: object): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params) as [string, QueryValue][]) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) {
      if (v.length) q.set(k, v.join(','))
    } else {
      q.set(k, String(v))
    }
  }
  const s = q.toString()
  return s ? '?' + s : ''
}

export const TIME_WINDOWS = [
  { value: '',    label: 'Any time' },
  { value: '1h',  label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
] as const
