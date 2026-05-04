import { bffGet } from './bffClient'

const BASE = '/api/weave/monitor/v1'

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

export function listRuns(): Promise<RunSummary[]> {
  return bffGet<RunSummary[]>(`${BASE}/runs`)
}

export function getRunStats(window: StatsWindow): Promise<RunStatsResponse> {
  return bffGet<RunStatsResponse>(`${BASE}/stats/runs?window=${window}`)
}
