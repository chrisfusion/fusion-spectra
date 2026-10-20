import { bffGet, bffPost, bffDelete, bffPatch } from './bffClient'
import type { ImageOverride } from './weaveApi'

export type { ImageOverride }

const BASE         = '/api/weave/monitor/v1'
const CRUD_BASE    = '/api/weave/api/v1'

export type RunPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Stopped'

export interface RunSummary {
  name:            string
  chain:           string
  phase:           RunPhase
  startTime:       string | null
  completionTime:  string | null
  stepCount:       number
  failedSteps:     number
  message:         string | null
}

export type StatsWindow = '1h' | '24h' | '7d'

export interface RunStatsResponse {
  window:        string
  total:         number
  succeeded:     number
  failed:        number
  running:       number
  pending:       number
  stopped:       number
  successRate:   number
  avgDurationMs: number
  minDurationMs: number
  maxDurationMs: number
}

// ─── Run detail types ─────────────────────────────────────────────────────────

export type StepPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Skipped' | 'Retrying' | 'Deployed'

export interface RunStepStatus {
  name:            string
  phase:           StepPhase
  jobRef?:         { name: string } | null
  deploymentRef?:  { name: string } | null
  retryCount?:     number
  nextRetryAfter?: string | null
  startTime?:      string | null
  completionTime?: string | null
  message?:        string
  outputCaptured?: boolean
}

export interface StepOverride {
  stepName:     string
  // artifactName/tag are both set or both omitted; omitted = image-only mode
  // (no code-loader / fusion-index lookup, needs an imageOverrides entry).
  artifactName?: string
  tag?:          string
  ingressName?: string
  indexURL?:    string
}

export interface WeaveRunSpec {
  chainRef:             { name: string }
  triggerRef?:          { name: string } | null
  parameterOverrides?:  Array<{ name: string; value: string }>
  stepOverrides?:       StepOverride[]
  imageOverrides?:      ImageOverride[]
}

export type DeploymentHealth = 'Healthy' | 'Unhealthy' | 'RollingBack' | 'RolledBack' | 'Unknown'

export interface ActiveDeploymentStatus {
  deploymentName:            string
  stepName:                  string
  health:                    DeploymentHealth
  codeSourceArtifact?:       string
  codeSourceTag?:            string
  codeSourceDeployedVersion?: string
  // Present while an image override is active; previousImage enables rollback.
  image?:                    string
  previousImage?:            string
  unhealthyDurationSeconds?: number
  unhealthySince?:           string | null
}

export interface WeaveRunStatus {
  phase:              RunPhase
  steps:              RunStepStatus[]
  startTime?:         string | null
  completionTime?:    string | null
  message?:           string
  sharedPVCName?:     string
  activeDeployments?: Record<string, ActiveDeploymentStatus>
}

export interface WeaveRun {
  metadata: {
    name:               string
    namespace?:         string
    uid?:               string
    creationTimestamp?: string
    labels?:            Record<string, string>
  }
  spec:    WeaveRunSpec
  status?: WeaveRunStatus
}

export interface K8sJobCondition {
  type:    string
  status:  string
  message?: string
}

export interface K8sJob {
  metadata: { name: string; namespace?: string }
  status?: {
    active?:         number
    succeeded?:      number
    failed?:         number
    startTime?:      string
    completionTime?: string
    conditions?:     K8sJobCondition[]
  }
}

export interface K8sEvent {
  reason:          string
  message:         string
  type:            string
  count:           number
  firstTimestamp?: string
  lastTimestamp?:  string
  involvedObject:  { name: string; kind: string }
}

export interface RunDetail {
  run:    WeaveRun
  jobs:   K8sJob[]
  events: K8sEvent[]
}

// What the shared LogViewer needs — both LogResponse and AppLogResponse satisfy it.
export interface LogSnapshot {
  lines:   string[]
  podName: string
}

export interface LogResponse {
  runName:  string
  stepName: string
  podName:  string
  lines:    string[]
}

// ─── WeaveApp (single-resource service/job) ──────────────────────────────────

export type AppPhase          = 'Pending' | 'Ready' | 'Running' | 'Invalid'
export type AppExecutionPhase = 'Running' | 'Succeeded' | 'Failed'

export interface WeaveAppExecution {
  entrypoint:      string
  jobName:         string
  phase:           AppExecutionPhase
  startTime?:      string | null
  completionTime?: string | null
  message?:        string
}

export interface WeaveApp {
  metadata: { name: string; creationTimestamp?: string; labels?: Record<string, string> }
  spec:     { type: 'service' | 'job'; image: string }
  status?: {
    phase?:             AppPhase
    validationMessage?: string
    deploymentName?:    string
    executions?:        WeaveAppExecution[]   // newest first; outlives the Job's TTL
  }
}

export interface AppLogResponse {
  appName:     string
  type:        string
  entrypoint?: string
  execution?:  string
  podName:     string
  container:   string
  lines:       string[]
}

export function getApp(name: string): Promise<WeaveApp> {
  return bffGet<WeaveApp>(`${CRUD_BASE}/apps/${encodeURIComponent(name)}`)
}

// service: the Deployment's pod; job: the given execution (default: newest).
// setup=true returns the code-loader init container's log instead of the main one.
export function getAppLogs(name: string, opts: { execution?: string; setup?: boolean } = {}): Promise<AppLogResponse> {
  const q = new URLSearchParams()
  if (opts.execution) q.set('execution', opts.execution)
  if (opts.setup)     q.set('container', 'code-loader')
  const qs = q.toString()
  return bffGet<AppLogResponse>(`${BASE}/apps/${encodeURIComponent(name)}/logs${qs ? '?' + qs : ''}`)
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export function listRuns(): Promise<RunSummary[]> {
  return bffGet<RunSummary[]>(`${BASE}/runs`)
}

export function getRunStats(window: StatsWindow): Promise<RunStatsResponse> {
  return bffGet<RunStatsResponse>(`${BASE}/stats/runs?window=${window}`)
}

export function getRun(name: string): Promise<RunDetail> {
  return bffGet<RunDetail>(`${BASE}/runs/${encodeURIComponent(name)}`)
}

export function getStepLogs(runName: string, stepName: string): Promise<LogResponse> {
  return bffGet<LogResponse>(`${BASE}/runs/${encodeURIComponent(runName)}/steps/${encodeURIComponent(stepName)}/logs`)
}

export function deleteRun(name: string): Promise<void> {
  return bffDelete(`${CRUD_BASE}/runs/${encodeURIComponent(name)}`)
}

export function stopRun(name: string): Promise<WeaveRun> {
  return bffPost<WeaveRun>(`${CRUD_BASE}/runs/${encodeURIComponent(name)}/stop`, {})
}

export function restartDeployStep(runName: string, stepName: string): Promise<void> {
  return bffPatch(`${CRUD_BASE}/runs/${encodeURIComponent(runName)}`, {
    metadata: { annotations: { 'fusion-platform.io/restart-step': stepName } },
  })
}

// Upserts one imageOverrides entry on a non-terminal run (validated server-side
// against the allowed prefixes); a Deployed run-owned step rolls to the image.
export function setRunImage(runName: string, override: ImageOverride): Promise<WeaveRun> {
  return bffPost<WeaveRun>(`${CRUD_BASE}/runs/${encodeURIComponent(runName)}/image`, override)
}

export interface WeaveRunList {
  items: WeaveRun[]
}

export function listAllRuns(): Promise<WeaveRun[]> {
  return bffGet<WeaveRunList>(`${CRUD_BASE}/runs`).then(r => r.items ?? [])
}

export function createServiceRun(payload: {
  metadata: { name: string; namespace?: string }
  spec: { chainRef: { name: string }; stepOverrides: StepOverride[]; imageOverrides?: ImageOverride[] }
}): Promise<WeaveRun> {
  return bffPost<WeaveRun>(`${CRUD_BASE}/runs`, {
    apiVersion: 'weave.fusion-platform.io/v1alpha1',
    kind: 'WeaveRun',
    ...payload,
  })
}
