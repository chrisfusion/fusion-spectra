export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface JobTemplate {
  id: number
  name: string
  description: string
  dockerImage: string
  latestVersionNumber: number
  createdAt: string
  updatedAt: string
}

export interface JobTemplateVersion {
  id: number
  templateId: number
  versionNumber: number
  dockerImage: string
  defaultRunConfig: string
  changelog: string
  createdAt: string
}

export interface Job {
  id: number
  name: string
  description: string
  templateVersionId: number
  latestVersionNumber: number
  createdAt: string
  updatedAt: string
}

export interface JobVersion {
  id: number
  jobId: number
  versionNumber: number
  dockerImage: string
  gitUrl: string
  gitRef: string
  gitSubpath: string
  runConfig: string
  templateVersionId: number
  createdAt: string
  artifactCount: number
}
