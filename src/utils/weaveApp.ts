import type { WeaveApp, WeaveAppExecution } from '@/api/weaveMonitorApi'

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
