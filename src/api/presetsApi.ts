import { bffGet } from './bffClient'

export interface KafkaPreset {
  name:       string
  brokers:    string[]
  secretRef?: string
}

export interface SecretPreset {
  name:        string
  secretName:  string
  secretKey?:  string
}

export interface PresetsResponse {
  kafka:   KafkaPreset[]
  secrets: SecretPreset[]
}

export function getPresets(): Promise<PresetsResponse> {
  return bffGet<PresetsResponse>('/bff/presets')
}
