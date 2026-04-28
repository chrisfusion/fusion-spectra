import { bffGet, bffPost, bffDelete } from './bffClient'

const BASE = '/api/weave/api/v1'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnvVar {
  name:   string
  value?: string
}

export interface ResourceList {
  cpu?:    string
  memory?: string
}

export interface ResourceRequirements {
  requests?: ResourceList
  limits?:   ResourceList
}

export interface WeaveVolumeMount {
  name:           string
  mountPath:      string
  secretName?:    string
  configMapName?: string
}

export interface WeaveRetryPolicy {
  maxRetries:     number
  backoffSeconds: number
}

export interface WeaveJobTemplateSpec {
  image:                  string
  command?:               string[]
  args?:                  string[]
  env?:                   EnvVar[]
  resources?:             ResourceRequirements
  volumes?:               WeaveVolumeMount[]
  retryPolicy?:           WeaveRetryPolicy
  parallelism?:           number
  completions?:           number
  activeDeadlineSeconds?: number
  serviceAccountName?:    string
}

// ─── Service Template types ───────────────────────────────────────────────────

export interface WeaveServicePort {
  name:        string
  port:        number
  targetPort?: number
  protocol?:   'TCP' | 'UDP' | 'SCTP'
}

export interface WeaveIngressRule {
  host:        string
  path?:       string
  pathType?:   'Exact' | 'Prefix' | 'ImplementationSpecific'
  servicePort: string
}

export interface WeaveIngressSpec {
  ingressClassName?: string
  rules:             WeaveIngressRule[]
  tlsSecretName?:    string
}

export interface WeaveProbeHTTPGet {
  path?:   string
  port:    string | number
  scheme?: 'HTTP' | 'HTTPS'
}

export interface WeaveProbeExec {
  command: string[]
}

export interface WeaveProbeTCPSocket {
  port: string | number
}

export interface WeaveProbe {
  httpGet?:             WeaveProbeHTTPGet
  exec?:                WeaveProbeExec
  tcpSocket?:           WeaveProbeTCPSocket
  initialDelaySeconds?: number
  periodSeconds?:       number
  timeoutSeconds?:      number
  successThreshold?:    number
  failureThreshold?:    number
}

export interface WeaveServiceTemplateSpec {
  image:                 string
  ports:                 WeaveServicePort[]
  command?:              string[]
  args?:                 string[]
  env?:                  EnvVar[]
  resources?:            ResourceRequirements
  volumes?:              WeaveVolumeMount[]
  serviceAccountName?:   string
  replicas?:             number
  serviceType?:          'ClusterIP' | 'NodePort' | 'LoadBalancer'
  livenessProbe?:        WeaveProbe
  readinessProbe?:       WeaveProbe
  startupProbe?:         WeaveProbe
  ingress?:              WeaveIngressSpec
  unhealthyDuration?:    string
  revisionHistoryLimit?: number
}

export interface WeaveServiceTemplateStatus {
  valid?:              boolean
  validationMessage?:  string
  observedGeneration?: number
}

export interface WeaveServiceTemplate {
  apiVersion: string
  kind:       string
  metadata: {
    name:               string
    namespace?:         string
    uid?:               string
    resourceVersion?:   string
    creationTimestamp?: string
    generation?:        number
  }
  spec:    WeaveServiceTemplateSpec
  status?: WeaveServiceTemplateStatus
}

export interface WeaveServiceTemplateList {
  apiVersion: string
  kind:       string
  metadata:   { resourceVersion?: string }
  items:      WeaveServiceTemplate[]
}

export interface CreateServiceTemplatePayload {
  metadata: { name: string }
  spec:     WeaveServiceTemplateSpec
}

export interface WeaveJobTemplateStatus {
  valid?:              boolean
  validationMessage?:  string
  observedGeneration?: number
}

export interface WeaveJobTemplate {
  apiVersion: string
  kind:       string
  metadata: {
    name:               string
    namespace?:         string
    uid?:               string
    resourceVersion?:   string
    creationTimestamp?: string
    generation?:        number
  }
  spec:    WeaveJobTemplateSpec
  status?: WeaveJobTemplateStatus
}

export interface WeaveJobTemplateList {
  apiVersion: string
  kind:       string
  metadata:   { resourceVersion?: string }
  items:      WeaveJobTemplate[]
}

export interface CreateJobTemplatePayload {
  metadata: { name: string }
  spec:     WeaveJobTemplateSpec
}

// ─── Job Templates ────────────────────────────────────────────────────────────

export function listJobTemplates(): Promise<WeaveJobTemplateList> {
  return bffGet<WeaveJobTemplateList>(`${BASE}/jobtemplates`)
}

export function getJobTemplate(name: string): Promise<WeaveJobTemplate> {
  return bffGet<WeaveJobTemplate>(`${BASE}/jobtemplates/${encodeURIComponent(name)}`)
}

export function createJobTemplate(payload: CreateJobTemplatePayload): Promise<WeaveJobTemplate> {
  return bffPost<WeaveJobTemplate>(`${BASE}/jobtemplates`, {
    apiVersion: 'weave.fusion-platform.io/v1alpha1',
    kind:       'WeaveJobTemplate',
    ...payload,
  })
}

export function deleteJobTemplate(name: string): Promise<void> {
  return bffDelete(`${BASE}/jobtemplates/${encodeURIComponent(name)}`)
}

// ─── Service Templates ────────────────────────────────────────────────────────

export function listServiceTemplates(): Promise<WeaveServiceTemplateList> {
  return bffGet<WeaveServiceTemplateList>(`${BASE}/servicetemplates`)
}

export function getServiceTemplate(name: string): Promise<WeaveServiceTemplate> {
  return bffGet<WeaveServiceTemplate>(`${BASE}/servicetemplates/${encodeURIComponent(name)}`)
}

export function createServiceTemplate(payload: CreateServiceTemplatePayload): Promise<WeaveServiceTemplate> {
  return bffPost<WeaveServiceTemplate>(`${BASE}/servicetemplates`, {
    apiVersion: 'weave.fusion-platform.io/v1alpha1',
    kind:       'WeaveServiceTemplate',
    ...payload,
  })
}

export function deleteServiceTemplate(name: string): Promise<void> {
  return bffDelete(`${BASE}/servicetemplates/${encodeURIComponent(name)}`)
}
