import { bffGet, bffPost, bffPut, bffPatch, bffDelete } from './bffClient'

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

export interface WeaveCodeSourceSpec {
  artifactName:            string
  tag:                     string
  indexURL?:               string
  mountPath?:              string
  loaderImage?:            string
  loaderImagePullPolicy?:  'Always' | 'Never' | 'IfNotPresent'
}

export interface PodSecurityContext {
  runAsUser?:  number
  runAsGroup?: number
  fsGroup?:    number
}

export interface ContainerSecurityContext {
  runAsNonRoot?:             boolean
  allowPrivilegeEscalation?: boolean
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
  activeDeadlineSeconds?:   number
  serviceAccountName?:      string
  podSecurityContext?:      PodSecurityContext
  containerSecurityContext?: ContainerSecurityContext
  codeSource?:              WeaveCodeSourceSpec
}

// ─── Service Template types ───────────────────────────────────────────────────

export interface WeaveServicePort {
  name:        string
  port:        number
  targetPort?: number
  protocol?:   'TCP' | 'UDP' | 'SCTP'
}

export interface WeaveIngressRule {
  name:        string
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
  unhealthyDuration?:       string
  revisionHistoryLimit?:    number
  podSecurityContext?:      PodSecurityContext
  containerSecurityContext?: ContainerSecurityContext
  codeSource?:              WeaveCodeSourceSpec
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

// ─── WeaveChain types ─────────────────────────────────────────────────────────

export interface WeaveChainStep {
  name:                string
  stepKind?:           'Job' | 'Deploy'
  jobTemplateRef?:     { name: string }
  serviceTemplateRef?: { name: string }
  dependsOn?:          string[]
  runOnSuccess?:       boolean
  runOnFailure?:       boolean
  envOverrides?:       EnvVar[]
  producesOutput?:     boolean
  consumesOutputFrom?: string[]
}

export interface WeaveSharedStorageSpec {
  size:               string
  storageClassName?:  string
}

// Names a deploy-time-allowlisted ServiceAccount (mode "serviceAccount") or
// Keycloak OIDC client (mode "oidc") — the operator mints a short-lived token
// per job-creation attempt, mounted as a file (Job-kind steps only). Independent
// of and stackable with authSecretRef. Valid names per mode come from
// fetchExternalAuthOptions().
export interface WeaveExternalAuthRef {
  mode: 'serviceAccount' | 'oidc'
  name: string
}

export interface WeaveChainSpec {
  steps:             WeaveChainStep[]
  failurePolicy?:    'StopAll' | 'ContinueOthers' | 'RetryFailed'
  concurrencyPolicy?: 'Wait' | 'Forbid'
  sharedStorage?:    WeaveSharedStorageSpec
  // Names a Secret injected via envFrom into every step pod of the chain
  // (Job and Deploy kind alike); overridable per-trigger/per-run.
  authSecretRef?:    { name: string }
  externalAuthRef?:  WeaveExternalAuthRef
  // Whether authSecretRef/externalAuthRef are ALSO injected as env vars, on
  // top of their unconditional file mount. Operator default is true; omit
  // this field to keep that default.
  unsafeEnvironmentInjector?: boolean
}

export interface WeaveChainStatus {
  observedGeneration?: number
  valid:               boolean
  validationMessage?:  string
}

export interface WeaveChain {
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
  spec:    WeaveChainSpec
  status?: WeaveChainStatus
}

export interface WeaveChainList {
  apiVersion: string
  kind:       string
  metadata:   { resourceVersion?: string }
  items:      WeaveChain[]
}

export interface CreateChainPayload {
  metadata: { name: string }
  spec:     WeaveChainSpec
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

export function updateJobTemplate(current: WeaveJobTemplate, spec: WeaveJobTemplateSpec): Promise<WeaveJobTemplate> {
  return bffPut<WeaveJobTemplate>(`${BASE}/jobtemplates/${encodeURIComponent(current.metadata.name)}`, {
    apiVersion: current.apiVersion,
    kind:       current.kind,
    metadata: {
      name:            current.metadata.name,
      namespace:       current.metadata.namespace,
      resourceVersion: current.metadata.resourceVersion,
    },
    spec,
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

export function updateServiceTemplate(current: WeaveServiceTemplate, spec: WeaveServiceTemplateSpec): Promise<WeaveServiceTemplate> {
  return bffPut<WeaveServiceTemplate>(`${BASE}/servicetemplates/${encodeURIComponent(current.metadata.name)}`, {
    apiVersion: current.apiVersion,
    kind:       current.kind,
    metadata: {
      name:            current.metadata.name,
      namespace:       current.metadata.namespace,
      resourceVersion: current.metadata.resourceVersion,
    },
    spec,
  })
}

export function deleteServiceTemplate(name: string): Promise<void> {
  return bffDelete(`${BASE}/servicetemplates/${encodeURIComponent(name)}`)
}

// ─── Weave Chains ─────────────────────────────────────────────────────────────

export function listWeaveChains(): Promise<WeaveChainList> {
  return bffGet<WeaveChainList>(`${BASE}/chains`)
}

export function getWeaveChain(name: string): Promise<WeaveChain> {
  return bffGet<WeaveChain>(`${BASE}/chains/${encodeURIComponent(name)}`)
}

export function createWeaveChain(payload: CreateChainPayload): Promise<WeaveChain> {
  return bffPost<WeaveChain>(`${BASE}/chains`, {
    apiVersion: 'weave.fusion-platform.io/v1alpha1',
    kind:       'WeaveChain',
    ...payload,
  })
}

export function deleteWeaveChain(name: string): Promise<void> {
  return bffDelete(`${BASE}/chains/${encodeURIComponent(name)}`)
}

// ─── Weave Triggers ───────────────────────────────────────────────────────────

export interface WeaveWebhookConfig {
  path:       string
  secretRef?: { name: string }
}

export interface WeaveKafkaConfig {
  brokers:            string[]
  topic:              string
  consumerGroup:      string
  secretRef?:         { name: string }
  eventFilter?:       string[]
  bucketFilter?:      string[]
  maxConcurrentRuns?: number
}

export interface WeaveBatchCronConfig {
  jobsConfigMapRef: { name: string }
}

export interface WeaveTriggerSpec {
  chainRef:            { name: string }
  type:                'OnDemand' | 'Cron' | 'Webhook' | 'BatchCron' | 'Kafka'
  schedule?:           string
  webhook?:            WeaveWebhookConfig
  batchCron?:          WeaveBatchCronConfig
  kafka?:              WeaveKafkaConfig
  paused?:             boolean
  parameterOverrides?: EnvVar[]
  // Overrides WeaveChainSpec.authSecretRef for every run created by this
  // trigger. Not settable via the Kafka/BatchCron dedicated endpoints.
  authSecretRefOverride?: { name: string }
  // Overrides WeaveChainSpec.externalAuthRef / .unsafeEnvironmentInjector for
  // every run created by this trigger. Not settable via the Kafka/BatchCron
  // dedicated endpoints.
  externalAuthRefOverride?: WeaveExternalAuthRef
  unsafeEnvironmentInjectorOverride?: boolean
}

export interface WeaveTriggerStatus {
  active:            boolean
  lastScheduleTime?: string
  lastRunName?:      string
  webhookURL?:       string
  pendingRuns?:      string[]
  // BatchCron only
  batchJobCount?:    number
  batchJobErrors?:   number
  // Persists why status.active=false (e.g. chain not found/invalid).
  inactiveReason?:   string
  // Set when this trigger's activation-source goroutine panicked; the
  // operator stops firing it until the one-shot fusion-platform.io/reset
  // annotation is applied (see resetWeaveTrigger).
  quarantined?:      boolean
  quarantineReason?: string
  quarantinedAt?:    string
}

export interface WeaveTrigger {
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
  spec:    WeaveTriggerSpec
  status?: WeaveTriggerStatus
}

export interface WeaveTriggerList {
  apiVersion: string
  kind:       string
  metadata:   { resourceVersion?: string }
  items:      WeaveTrigger[]
}

export interface CreateTriggerPayload {
  metadata: { name: string }
  spec:     WeaveTriggerSpec
}

export function listWeaveTriggers(): Promise<WeaveTriggerList> {
  return bffGet<WeaveTriggerList>(`${BASE}/triggers`)
}

export function getWeaveTrigger(name: string): Promise<WeaveTrigger> {
  return bffGet<WeaveTrigger>(`${BASE}/triggers/${encodeURIComponent(name)}`)
}

export function createWeaveTrigger(payload: CreateTriggerPayload): Promise<WeaveTrigger> {
  return bffPost<WeaveTrigger>(`${BASE}/triggers`, {
    apiVersion: 'weave.fusion-platform.io/v1alpha1',
    kind:       'WeaveTrigger',
    ...payload,
  })
}

export function fireWeaveTrigger(name: string): Promise<void> {
  return bffPatch(`${BASE}/triggers/${encodeURIComponent(name)}`, {
    metadata: { annotations: { 'fusion-platform.io/fire': 'true' } },
  })
}

// Clears status.quarantined after a panic in this trigger's activation-source
// goroutine. Generic to any WeaveTrigger (not type-specific), same as fire.
export function resetWeaveTrigger(name: string): Promise<void> {
  return bffPatch(`${BASE}/triggers/${encodeURIComponent(name)}`, {
    metadata: { annotations: { 'fusion-platform.io/reset': 'true' } },
  })
}

export function deleteWeaveTrigger(name: string): Promise<void> {
  return bffDelete(`${BASE}/triggers/${encodeURIComponent(name)}`)
}

// ─── External Auth ────────────────────────────────────────────────────────────

export interface WeaveExternalAuthOptions {
  serviceAccounts: string[]
  oidcSecrets:     string[]
}

// Reports the deploy-time allowlists configured for externalAuthRef, so a
// name picker can be populated per mode instead of hardcoding/guessing valid
// values. Static config echo, no cluster lookups.
export function fetchExternalAuthOptions(): Promise<WeaveExternalAuthOptions> {
  return bffGet<WeaveExternalAuthOptions>(`${BASE}/external-auth/options`)
}

// Kafka triggers go through a dedicated endpoint (separate RBAC permission
// from generic triggers); request body shape is flat, not a full WeaveTrigger.
export interface CreateKafkaTriggerPayload {
  name:     string
  chainRef: { name: string }
  kafka:    WeaveKafkaConfig
}

export function createKafkaTrigger(payload: CreateKafkaTriggerPayload): Promise<WeaveTrigger> {
  return bffPost<WeaveTrigger>(`${BASE}/kafkatriggers`, payload)
}

export function deleteKafkaTrigger(name: string): Promise<void> {
  return bffDelete(`${BASE}/kafkatriggers/${encodeURIComponent(name)}`)
}

// BatchCron triggers go through a dedicated endpoint (separate RBAC permission
// from generic triggers) since creation also provisions the backing jobs
// ConfigMap; request/response bodies are flat, not a full WeaveTrigger.
export interface WeaveBatchValidationError {
  line:    number
  message: string
}

export interface WeaveBatchValidateResponse {
  valid:   boolean
  errors?: WeaveBatchValidationError[]
}

export interface CreateBatchTriggerPayload {
  name:     string
  chainRef: { name: string }
  jobs:     string
}

export function validateBatchJobs(jobs: string): Promise<WeaveBatchValidateResponse> {
  return bffPost<WeaveBatchValidateResponse>(`${BASE}/batchtriggers/validate`, { jobs })
}

export function createBatchTrigger(payload: CreateBatchTriggerPayload): Promise<WeaveTrigger> {
  return bffPost<WeaveTrigger>(`${BASE}/batchtriggers`, payload)
}

export function deleteBatchTrigger(name: string): Promise<void> {
  return bffDelete(`${BASE}/batchtriggers/${encodeURIComponent(name)}`)
}

export function pauseBatchTrigger(name: string): Promise<WeaveTrigger> {
  return bffPost<WeaveTrigger>(`${BASE}/batchtriggers/${encodeURIComponent(name)}/stop`)
}

// Resuming via the generic PATCH endpoint (merge patch on spec.paused) rather
// than the dedicated /resume action, which additionally requires re-uploading
// the jobs YAML — spectra has no "fetch current jobs" endpoint to prefill that.
export function unpauseBatchTrigger(name: string): Promise<WeaveTrigger> {
  return bffPatch<WeaveTrigger>(`${BASE}/batchtriggers/${encodeURIComponent(name)}`, {
    spec: { paused: false },
  })
}
