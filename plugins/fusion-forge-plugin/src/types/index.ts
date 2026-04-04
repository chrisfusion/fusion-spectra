export type BuildStatus = 'PENDING' | 'BUILDING' | 'SUCCESS' | 'FAILED'

export interface VenvBuild {
  id: number
  name: string
  version: string
  description: string | null
  status: BuildStatus
  creatorId: string
  creatorEmail: string
  indexBackendJobId: number | null
  k8sJobName: string | null
  createdAt: string
  updatedAt: string
}

export interface VenvBuildPage {
  items: VenvBuild[]
  total: number
  page: number
  pageSize: number
}

export interface ValidationViolation {
  line: number
  content: string
  message: string
}

export interface ValidationResponse {
  valid: boolean
  violations: ValidationViolation[]
}
