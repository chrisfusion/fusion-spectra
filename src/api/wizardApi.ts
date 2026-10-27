import { bffGet, bffPost, bffDelete } from './bffClient'
import { toQueryString, type ListParams } from '@/utils/listQuery'

const BASE = '/api/wizard/api/v1'

// ─── Types ────────────────────────────────────────────────────────────────────
// Mirrors fusion-wizard's internal/apiserver view types (definitionView, runView,
// resourceView) and api/v1alpha1 CRD types. See fusion-wizard/CLAUDE.md.

export type ParameterType = 'string' | 'number' | 'boolean' | 'stringList' | 'objectList'

export interface WizardParameter {
  name:        string
  type?:       ParameterType   // default 'string'
  description?: string
  required?:   boolean
  default?:    unknown
  pattern?:    string
}

export type StepType = 'gitWatcher' | 'waitBuild' | 'tag' | 'jobTemplate' | 'serviceTemplate' | 'chain' | 'trigger' | 'batchTrigger' | 'app'

export interface WizardStep {
  name:    string
  type:    StepType
  forEach?: string
  params?: Record<string, string>
}

export interface WizardDefinitionSpec {
  description?: string
  parameters:   WizardParameter[]
  steps:        WizardStep[]
}

export interface WizardDefinition {
  name:       string
  generation: number
  valid:      boolean
  error?:     string
  spec:       WizardDefinitionSpec
}

export type RunPhase = 'Pending' | 'Running' | 'Ready' | 'Failed' | 'RollingBack' | 'RolledBack' | 'RollbackFailed'

export const RUN_PHASES: RunPhase[] = ['Pending', 'Running', 'Ready', 'Failed', 'RollingBack', 'RolledBack', 'RollbackFailed']
export const RUN_PHASE_LABEL: Record<RunPhase, string> = {
  Pending: 'Pending', Running: 'Running', Ready: 'Ready', Failed: 'Failed',
  RollingBack: 'Rolling Back', RolledBack: 'Rolled Back', RollbackFailed: 'Rollback Failed',
}
export type StepPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'RolledBack' | 'RollbackFailed'
export type RunDesiredState = 'Applied' | 'RolledBack'

export interface ManagedResourceRef {
  service:      string
  kind:         string
  name:         string
  externalID?:  string
  disposition?: string
}

export interface WizardRunStepStatus {
  key:          string
  name:         string
  type?:        StepType
  item?:        string
  phase?:       StepPhase
  message?:     string
  failures?:    number
  outputs?:     Record<string, string>
  resources?:   ManagedResourceRef[]
  startedAt?:   string
  completedAt?: string
}

export interface WizardRunStatus {
  phase?:              RunPhase
  message?:            string
  observedGeneration?: number
  steps?:              WizardRunStepStatus[]
  startedAt?:          string
  completedAt?:        string
}

export interface WizardRun {
  name:            string
  definition:      string
  desiredState:    RunDesiredState
  parameters?:     Record<string, unknown>
  createdBy?:      string
  createdByEmail?: string
  createdAt:       string
  deleting?:       boolean
  status:          WizardRunStatus
}

export interface ResourceReference {
  run:  string
  step: string
}

export interface WizardResource {
  service:     string
  kind:        string
  name:        string
  externalID?: string
  specHash?:   string
  managed:     boolean
  terminating?: boolean
  refs:        ResourceReference[]
  createdAt:   string
}

// ─── Definitions ──────────────────────────────────────────────────────────────

export function listDefinitions(): Promise<{ items: WizardDefinition[] }> {
  return bffGet(`${BASE}/definitions`)
}

export function getDefinition(name: string): Promise<WizardDefinition> {
  return bffGet(`${BASE}/definitions/${encodeURIComponent(name)}`)
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export interface CreateRunRequest {
  definition: string
  name?:      string
  parameters?: Record<string, unknown>
}

export function createRun(req: CreateRunRequest): Promise<WizardRun> {
  return bffPost(`${BASE}/runs`, req)
}

// Shared list parameters (source: only gitops is meaningful — WizardRuns Flux applied) plus
// definition/phase (match any) and createdBy. Sort keys: created (default -created), name,
// phase, definition. total is the filtered count; continue is set while more pages follow.
export interface WizardRunListParams extends Omit<ListParams, 'labelSelector'> {
  definition?: string[]
  phase?:      RunPhase[]
  createdBy?:  string
}

export function listRuns(params: WizardRunListParams = {}): Promise<{ items: WizardRun[], total: number, continue?: string }> {
  return bffGet(`${BASE}/runs${toQueryString(params)}`)
}

export function getRun(name: string): Promise<WizardRun> {
  return bffGet(`${BASE}/runs/${encodeURIComponent(name)}`)
}

export function retryRun(name: string): Promise<WizardRun> {
  return bffPost(`${BASE}/runs/${encodeURIComponent(name)}/retry`)
}

export function rollbackRun(name: string): Promise<WizardRun> {
  return bffPost(`${BASE}/runs/${encodeURIComponent(name)}/rollback`)
}

export function deleteRun(name: string): Promise<void> {
  return bffDelete(`${BASE}/runs/${encodeURIComponent(name)}`)
}

export interface BulkRollbackRequest {
  names?:      string[]
  definition?: string
}

export interface BulkRollbackResult {
  accepted: string[]
  failed:   { name: string, error: string }[]
}

export function bulkRollback(req: BulkRollbackRequest): Promise<BulkRollbackResult> {
  return bffPost(`${BASE}/runs/bulk-rollback`, req)
}

// ─── Resources (ledger) ───────────────────────────────────────────────────────

export function listResources(params: {
  service?: string
  kind?:    string
} = {}): Promise<{ items: WizardResource[] }> {
  return bffGet(`${BASE}/resources${toQueryString(params)}`)
}
