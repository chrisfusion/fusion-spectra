import { bffGet } from './bffClient'

export interface LiveResult {
  reachable:   boolean
  status_code?: number
  latency_ms?:  number
  error?:       string
}

export interface ServiceOverride {
  id:          number
  service:     string
  status:      'Healthy' | 'Unhealthy' | 'Offline' | 'Maintenance'
  description: string
  updated_by:  string
  updated_at:  string
}

export interface ServiceStatus {
  name:     string
  live:     LiveResult | null
  override: ServiceOverride | null
}

export interface SystemHealthResponse {
  services: ServiceStatus[]
}

export function getSystemHealth(): Promise<SystemHealthResponse> {
  return bffGet<SystemHealthResponse>('/bff/system-health')
}
