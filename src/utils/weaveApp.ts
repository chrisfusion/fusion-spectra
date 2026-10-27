import type { WeaveApp, WeaveAppExecution, WeaveAppWritablePath, AppRuntimeSettings } from '@/api/weaveMonitorApi'

// Shared display helpers for WeaveApps (list + detail page).

// A codeSource app runs fusion-index code on a runner image; the image itself is then an
// implementation detail, the artifact @ tag is what the user chose.
export function appSource(a: WeaveApp): string {
  const cs = a.spec.codeSource
  return cs ? `${cs.artifactName} @ ${cs.tag}` : a.spec.image
}

// status.executions is newest first.
export function lastExecution(a: WeaveApp): WeaveAppExecution | undefined {
  return a.status?.executions?.[0]
}

export function hasIngress(a: WeaveApp): boolean {
  return !!(a.spec.service?.ingressName || a.spec.service?.ingress)
}

export function formatWritablePath(p: WeaveAppWritablePath): string {
  return [p.mountPath, p.sizeLimit, p.medium].filter(Boolean).join(' · ')
}

// Parses the runtime-settings JSON from the detail page's editor and mirrors the cheap parts of the
// operator's checks (absolute, not '/', no duplicates); clashes with volumes/code mount are left to
// weave, which marks the app Invalid. Returns an error string or the parsed settings.
export function parseRuntimeSettings(json: string, withAnnotations: boolean): string | AppRuntimeSettings {
  let raw: unknown
  try { raw = JSON.parse(json || '{}') } catch { return 'Invalid JSON' }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Expected a JSON object'
  const { writablePaths = [], ingressAnnotations = {}, ...rest } = raw as Record<string, unknown>
  const allowed = withAnnotations ? '"writablePaths", "ingressAnnotations"' : '"writablePaths"'
  const extra = Object.keys(rest)
  if (extra.length || (!withAnnotations && 'ingressAnnotations' in (raw as object))) {
    return `Unknown key ${extra[0] ?? 'ingressAnnotations'} — allowed: ${allowed}`
  }

  if (!Array.isArray(writablePaths)) return 'writablePaths must be a list'
  const seen = new Set<string>()
  const paths: WeaveAppWritablePath[] = []
  for (const p of writablePaths as Record<string, unknown>[]) {
    const mp = p?.mountPath
    if (typeof mp !== 'string' || !mp.startsWith('/') || mp === '/') return `mountPath must be an absolute path other than "/" (got ${JSON.stringify(mp)})`
    if (seen.has(mp)) return `Duplicate mountPath ${mp}`
    seen.add(mp)
    if (p.sizeLimit !== undefined && typeof p.sizeLimit !== 'string') return `sizeLimit of ${mp} must be a string such as "200Mi"`
    if (p.medium !== undefined && p.medium !== '' && p.medium !== 'Memory') return `medium of ${mp} must be "Memory" or omitted`
    paths.push({ mountPath: mp, ...(p.sizeLimit ? { sizeLimit: p.sizeLimit as string } : {}), ...(p.medium ? { medium: 'Memory' as const } : {}) })
  }

  if (!withAnnotations) return { writablePaths: paths }
  if (typeof ingressAnnotations !== 'object' || ingressAnnotations === null || Array.isArray(ingressAnnotations)) return 'ingressAnnotations must be an object'
  for (const [k, v] of Object.entries(ingressAnnotations)) {
    if (typeof v !== 'string') return `Annotation ${k} must have a string value`
  }
  return { writablePaths: paths, ingressAnnotations: ingressAnnotations as Record<string, string> }
}
