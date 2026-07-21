import { bffGet, bffPost, bffDelete, bffPatch } from './bffClient'

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
  artifactName: string
  tag:          string
  ingressName?: string
  indexURL?:    string
}

export interface WeaveRunSpec {
  chainRef:             { name: string }
  triggerRef?:          { name: string } | null
  parameterOverrides?:  Array<{ name: string; value: string }>
  stepOverrides?:       StepOverride[]
}

export type DeploymentHealth = 'Healthy' | 'Unhealthy' | 'RollingBack' | 'RolledBack' | 'Unknown'

export interface ActiveDeploymentStatus {
  deploymentName:            string
  stepName:                  string
  health:                    DeploymentHealth
  codeSourceArtifact:        string
  codeSourceTag:             string
  codeSourceDeployedVersion: string
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

export interface LogResponse {
  runName:  string
  stepName: string
  podName:  string
  lines:    string[]
}

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

export interface WeaveRunList {
  items: WeaveRun[]
}

export function listAllRuns(): Promise<WeaveRun[]> {
  return bffGet<WeaveRunList>(`${CRUD_BASE}/runs`).then(r => r.items ?? [])
}

export function createServiceRun(payload: {
  metadata: { name: string; namespace?: string }
  spec: { chainRef: { name: string }; stepOverrides: StepOverride[] }
}): Promise<WeaveRun> {
  return bffPost<WeaveRun>(`${CRUD_BASE}/runs`, {
    apiVersion: 'weave.fusion-platform.io/v1alpha1',
    kind: 'WeaveRun',
    ...payload,
  })
}
