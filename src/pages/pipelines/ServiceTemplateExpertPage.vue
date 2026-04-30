<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as weaveApi from '@/api/weaveApi'

const router = useRouter()

const K8S_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/

// ─── Identity ─────────────────────────────────────────────────────────────────

const name       = ref('')
const image      = ref('')
const nameError  = ref<string | null>(null)
const imageError = ref<string | null>(null)

// ─── Ports ────────────────────────────────────────────────────────────────────

interface PortRow { name: string; port: string; targetPort: string; protocol: 'TCP' | 'UDP' | 'SCTP' }
const ports      = ref<PortRow[]>([{ name: 'http', port: '', targetPort: '', protocol: 'TCP' }])
const portsError = ref<string | null>(null)

function addPort() { ports.value = [...ports.value, { name: '', port: '', targetPort: '', protocol: 'TCP' }] }
function removePort(i: number) { if (ports.value.length > 1) ports.value = ports.value.filter((_, idx) => idx !== i) }

// ─── Execution ────────────────────────────────────────────────────────────────

const commandText = ref('')
const argsText    = ref('')

// ─── Environment ──────────────────────────────────────────────────────────────

interface EnvRow { key: string; value: string }
const envRows = ref<EnvRow[]>([{ key: '', value: '' }])
function addEnvRow() { envRows.value = [...envRows.value, { key: '', value: '' }] }
function removeEnvRow(i: number) {
  const rows = envRows.value.filter((_, idx) => idx !== i)
  envRows.value = rows.length > 0 ? rows : [{ key: '', value: '' }]
}

// ─── Resources ────────────────────────────────────────────────────────────────

const cpuRequest = ref(''); const cpuLimit = ref('')
const memRequest = ref(''); const memLimit = ref('')

// ─── Deployment settings ──────────────────────────────────────────────────────

const replicas            = ref('')
const serviceType         = ref<'ClusterIP' | 'NodePort' | 'LoadBalancer'>('ClusterIP')
const serviceAccountName  = ref('')
const unhealthyDuration   = ref('')
const revisionHistoryLimit = ref('')

// ─── Volumes ──────────────────────────────────────────────────────────────────

interface VolumeRow { name: string; mountPath: string; type: 'secret' | 'configmap'; sourceName: string }
const volumes = ref<VolumeRow[]>([])
function addVolume() { volumes.value = [...volumes.value, { name: '', mountPath: '', type: 'secret', sourceName: '' }] }
function removeVolume(i: number) { volumes.value = volumes.value.filter((_, idx) => idx !== i) }

// ─── Probes ───────────────────────────────────────────────────────────────────

interface ProbeConfig {
  enabled: boolean
  type: 'http' | 'tcp' | 'exec'
  httpPath: string; httpPort: string; httpScheme: 'HTTP' | 'HTTPS'
  tcpPort: string
  execCommand: string
  initialDelaySeconds: string; periodSeconds: string
  timeoutSeconds: string; successThreshold: string; failureThreshold: string
}

function defaultProbe(): ProbeConfig {
  return { enabled: false, type: 'http', httpPath: '/', httpPort: '', httpScheme: 'HTTP',
           tcpPort: '', execCommand: '', initialDelaySeconds: '', periodSeconds: '',
           timeoutSeconds: '', successThreshold: '', failureThreshold: '' }
}

const livenessProbe  = ref<ProbeConfig>(defaultProbe())
const readinessProbe = ref<ProbeConfig>(defaultProbe())
const startupProbe   = ref<ProbeConfig>(defaultProbe())

function buildProbe(p: ProbeConfig): weaveApi.WeaveProbe | undefined {
  if (!p.enabled) return undefined
  const probe: weaveApi.WeaveProbe = {}
  if (p.type === 'http') {
    probe.httpGet = { path: p.httpPath || '/', port: p.httpPort || 80, scheme: p.httpScheme }
  } else if (p.type === 'tcp') {
    probe.tcpSocket = { port: p.tcpPort || 80 }
  } else {
    const cmd = p.execCommand.split('\n').map(s => s.trim()).filter(Boolean)
    if (cmd.length) probe.exec = { command: cmd }
  }
  const n = (s: string) => { const v = parseInt(s); return isNaN(v) ? undefined : v }
  if (n(p.initialDelaySeconds) !== undefined) probe.initialDelaySeconds = n(p.initialDelaySeconds)
  if (n(p.periodSeconds)       !== undefined) probe.periodSeconds       = n(p.periodSeconds)
  if (n(p.timeoutSeconds)      !== undefined) probe.timeoutSeconds      = n(p.timeoutSeconds)
  if (n(p.successThreshold)    !== undefined) probe.successThreshold    = n(p.successThreshold)
  if (n(p.failureThreshold)    !== undefined) probe.failureThreshold    = n(p.failureThreshold)
  return probe
}

// ─── Ingress ──────────────────────────────────────────────────────────────────

const ingressEnabled   = ref(false)
const ingressClassName = ref('')
const ingressTLSSecret = ref('')

interface IngressRuleRow { host: string; path: string; pathType: 'Exact' | 'Prefix' | 'ImplementationSpecific'; servicePort: string }
const ingressRules = ref<IngressRuleRow[]>([{ host: '', path: '/', pathType: 'Prefix', servicePort: '' }])
function addIngressRule() { ingressRules.value = [...ingressRules.value, { host: '', path: '/', pathType: 'Prefix', servicePort: '' }] }
function removeIngressRule(i: number) { if (ingressRules.value.length > 1) ingressRules.value = ingressRules.value.filter((_, idx) => idx !== i) }

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(): boolean {
  let ok = true
  const n = name.value.trim()
  if (!n) { nameError.value = 'Name is required'; ok = false }
  else if (!K8S_NAME_RE.test(n)) { nameError.value = 'Lowercase letters, digits and hyphens only; must start and end with alphanumeric'; ok = false }
  else if (n.length > 253) { nameError.value = 'Max 253 characters'; ok = false }
  else nameError.value = null

  if (!image.value.trim()) { imageError.value = 'Image is required'; ok = false }
  else imageError.value = null

  const validPorts = ports.value.filter(p => p.name.trim() && p.port.trim())
  if (validPorts.length === 0) { portsError.value = 'At least one port with name and port number is required'; ok = false }
  else portsError.value = null

  return ok
}

// ─── Build spec ───────────────────────────────────────────────────────────────

function buildSpec(): weaveApi.WeaveServiceTemplateSpec {
  const builtPorts: weaveApi.WeaveServicePort[] = ports.value
    .filter(p => p.name.trim() && p.port.trim())
    .map(p => {
      const portNum   = parseInt(p.port)
      const targetNum = parseInt(p.targetPort)
      return { name: p.name.trim(), port: portNum,
               ...(p.targetPort.trim() && !isNaN(targetNum) ? { targetPort: targetNum } : {}),
               protocol: p.protocol }
    })

  const spec: weaveApi.WeaveServiceTemplateSpec = { image: image.value.trim(), ports: builtPorts }

  const cmd = commandText.value.split('\n').map(s => s.trim()).filter(Boolean)
  if (cmd.length) spec.command = cmd

  const args = argsText.value.split('\n').map(s => s.trim()).filter(Boolean)
  if (args.length) spec.args = args

  const env = envRows.value.filter(r => r.key.trim()).map(r => ({ name: r.key.trim(), value: r.value }))
  if (env.length) spec.env = env

  const resources: weaveApi.ResourceRequirements = {}
  if (cpuRequest.value.trim() || memRequest.value.trim()) {
    resources.requests = {}
    if (cpuRequest.value.trim()) resources.requests.cpu    = cpuRequest.value.trim()
    if (memRequest.value.trim()) resources.requests.memory = memRequest.value.trim()
  }
  if (cpuLimit.value.trim() || memLimit.value.trim()) {
    resources.limits = {}
    if (cpuLimit.value.trim()) resources.limits.cpu    = cpuLimit.value.trim()
    if (memLimit.value.trim()) resources.limits.memory = memLimit.value.trim()
  }
  if (resources.requests || resources.limits) spec.resources = resources

  const rep = parseInt(replicas.value)
  if (!isNaN(rep) && rep >= 1) spec.replicas = rep
  spec.serviceType = serviceType.value
  if (serviceAccountName.value.trim())  spec.serviceAccountName  = serviceAccountName.value.trim()
  if (unhealthyDuration.value.trim())   spec.unhealthyDuration   = unhealthyDuration.value.trim()
  const rhl = parseInt(revisionHistoryLimit.value)
  if (!isNaN(rhl) && rhl >= 1) spec.revisionHistoryLimit = rhl

  const vols = volumes.value
    .filter(v => v.name.trim() && v.mountPath.trim() && v.sourceName.trim())
    .map(v => ({ name: v.name.trim(), mountPath: v.mountPath.trim(),
                 ...(v.type === 'secret' ? { secretName: v.sourceName.trim() } : { configMapName: v.sourceName.trim() }) }))
  if (vols.length) spec.volumes = vols

  const lp = buildProbe(livenessProbe.value);  if (lp) spec.livenessProbe  = lp
  const rp = buildProbe(readinessProbe.value); if (rp) spec.readinessProbe = rp
  const sp = buildProbe(startupProbe.value);   if (sp) spec.startupProbe   = sp

  if (ingressEnabled.value) {
    const rules: weaveApi.WeaveIngressRule[] = ingressRules.value
      .filter(r => r.host.trim() && r.servicePort.trim())
      .map(r => ({ host: r.host.trim(), path: r.path || '/', pathType: r.pathType, servicePort: r.servicePort.trim() }))
    if (rules.length) {
      spec.ingress = { rules }
      if (ingressClassName.value.trim()) spec.ingress.ingressClassName = ingressClassName.value.trim()
      if (ingressTLSSecret.value.trim()) spec.ingress.tlsSecretName    = ingressTLSSecret.value.trim()
    }
  }

  return spec
}

// ─── Submit ───────────────────────────────────────────────────────────────────

const submitting      = ref(false)
const submitError     = ref<string | null>(null)
const createdTemplate = ref<weaveApi.WeaveServiceTemplate | null>(null)

async function submit() {
  if (!validate()) return
  submitting.value  = true
  submitError.value = null
  try {
    createdTemplate.value = await weaveApi.createServiceTemplate({
      metadata: { name: name.value.trim() },
      spec:     buildSpec(),
    })
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Creation failed'
  } finally {
    submitting.value = false
  }
}

function createAnother() {
  name.value = ''; image.value = ''; nameError.value = null; imageError.value = null
  ports.value       = [{ name: 'http', port: '', targetPort: '', protocol: 'TCP' }]
  commandText.value = ''; argsText.value = ''
  envRows.value     = [{ key: '', value: '' }]
  cpuRequest.value = cpuLimit.value = memRequest.value = memLimit.value = ''
  replicas.value = ''; serviceType.value = 'ClusterIP'
  serviceAccountName.value = ''; unhealthyDuration.value = ''; revisionHistoryLimit.value = ''
  volumes.value        = []
  livenessProbe.value  = defaultProbe()
  readinessProbe.value = defaultProbe()
  startupProbe.value   = defaultProbe()
  ingressEnabled.value = false; ingressClassName.value = ''; ingressTLSSecret.value = ''
  ingressRules.value   = [{ host: '', path: '/', pathType: 'Prefix', servicePort: '' }]
  submitError.value    = null; createdTemplate.value = null
}
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/pipelines/weave/servicetemplates')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Service Templates
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">Expert Create</span>
    </div>

    <CanvasPanel title="Create Service Template — Expert" icon="mdi-server-network" :wide="true">

      <!-- ── Success state ── -->
      <div v-if="createdTemplate" class="success-body">
        <q-icon name="mdi-check-circle-outline" size="48px" class="success-icon" />
        <p class="success-title">Service template created</p>
        <p class="success-sub">
          <span class="fs-mono">{{ createdTemplate.metadata.name }}</span>
          was submitted — validation runs asynchronously.
        </p>
        <div class="success-actions">
          <button class="fs-btn fs-btn--ghost" @click="router.push('/pipelines/weave/servicetemplates')">
            <q-icon name="mdi-format-list-bulleted" size="14px" />
            View Templates
          </button>
          <button class="fs-btn fs-btn--primary" @click="createAnother">
            <q-icon name="mdi-plus" size="14px" />
            Create Another
          </button>
        </div>
      </div>

      <!-- ── Form ── -->
      <form v-else class="expert-form" @submit.prevent="submit">

        <!-- ── Identity ── -->
        <div class="section-header"><q-icon name="mdi-identifier" size="15px" class="section-icon" /> Identity</div>
        <div class="form-row">
          <label class="form-label">Name <span class="required">*</span></label>
          <div class="field-wrap">
            <input v-model="name" class="fs-input fs-mono" :class="{ 'fs-input--error': nameError }" placeholder="my-service-template" />
            <span v-if="nameError" class="field-error">{{ nameError }}</span>
            <span v-else class="field-hint">Kubernetes resource name: lowercase, alphanumeric and hyphens</span>
          </div>
        </div>
        <div class="form-row">
          <label class="form-label">Image <span class="required">*</span></label>
          <div class="field-wrap">
            <input v-model="image" class="fs-input fs-mono" :class="{ 'fs-input--error': imageError }" placeholder="nginx:latest" />
            <span v-if="imageError" class="field-error">{{ imageError }}</span>
          </div>
        </div>

        <!-- ── Ports ── -->
        <div class="section-header"><q-icon name="mdi-ethernet-cable" size="15px" class="section-icon" /> Ports <span class="required" style="font-size:11px">*</span></div>
        <div class="form-row form-row--top">
          <label class="form-label">Ports</label>
          <div class="field-wrap">
            <div class="port-table">
              <div class="port-header">
                <span>Name</span><span>Port</span><span>Target Port</span><span>Protocol</span><span></span>
              </div>
              <div v-for="(p, i) in ports" :key="i" class="port-row">
                <input v-model="p.name"       class="fs-input fs-mono port-input" placeholder="http" />
                <input v-model="p.port"       class="fs-input fs-mono port-input" type="number" min="1" max="65535" placeholder="8080" />
                <input v-model="p.targetPort" class="fs-input fs-mono port-input" type="number" min="1" max="65535" placeholder="same" />
                <select v-model="p.protocol" class="fs-input port-select">
                  <option>TCP</option><option>UDP</option><option>SCTP</option>
                </select>
                <button type="button" class="icon-btn icon-btn--danger" :disabled="ports.length <= 1" title="Remove" @click="removePort(i)">
                  <q-icon name="mdi-close" size="13px" />
                </button>
              </div>
            </div>
            <span v-if="portsError" class="field-error">{{ portsError }}</span>
            <button type="button" class="fs-btn fs-btn--ghost add-btn" @click="addPort">
              <q-icon name="mdi-plus" size="13px" /> Add port
            </button>
          </div>
        </div>

        <!-- ── Execution ── -->
        <div class="section-header"><q-icon name="mdi-play-circle-outline" size="15px" class="section-icon" /> Execution</div>
        <div class="form-row form-row--top">
          <label class="form-label">Command</label>
          <div class="field-wrap">
            <textarea v-model="commandText" class="fs-input fs-textarea fs-mono" rows="3" placeholder="One entry per line" />
            <span class="field-hint">Overrides the container entrypoint; one argument per line</span>
          </div>
        </div>
        <div class="form-row form-row--top">
          <label class="form-label">Args</label>
          <div class="field-wrap">
            <textarea v-model="argsText" class="fs-input fs-textarea fs-mono" rows="3" placeholder="One entry per line" />
            <span class="field-hint">Arguments passed to the command; one argument per line</span>
          </div>
        </div>

        <!-- ── Environment ── -->
        <div class="section-header"><q-icon name="mdi-variable" size="15px" class="section-icon" /> Environment Variables</div>
        <div class="form-row form-row--top">
          <label class="form-label">Env vars</label>
          <div class="field-wrap">
            <div class="env-table">
              <div class="env-header"><span class="env-col-label">Key</span><span class="env-col-label">Value</span></div>
              <div v-for="(row, i) in envRows" :key="i" class="env-row">
                <input v-model="row.key"   class="fs-input fs-mono env-input" placeholder="LOG_LEVEL" />
                <input v-model="row.value" class="fs-input fs-mono env-input" placeholder="info" />
                <button type="button" class="icon-btn icon-btn--danger" title="Remove" @click="removeEnvRow(i)">
                  <q-icon name="mdi-close" size="13px" />
                </button>
              </div>
            </div>
            <button type="button" class="fs-btn fs-btn--ghost add-btn" @click="addEnvRow">
              <q-icon name="mdi-plus" size="13px" /> Add variable
            </button>
          </div>
        </div>

        <!-- ── Resources ── -->
        <div class="section-header"><q-icon name="mdi-memory" size="15px" class="section-icon" /> Resources</div>
        <div class="form-row"><label class="form-label">CPU request</label>   <input v-model="cpuRequest" class="fs-input fs-mono field-narrow" placeholder="200m" /></div>
        <div class="form-row"><label class="form-label">CPU limit</label>     <input v-model="cpuLimit"   class="fs-input fs-mono field-narrow" placeholder="500m" /></div>
        <div class="form-row"><label class="form-label">Memory request</label><input v-model="memRequest" class="fs-input fs-mono field-narrow" placeholder="256Mi" /></div>
        <div class="form-row"><label class="form-label">Memory limit</label>  <input v-model="memLimit"   class="fs-input fs-mono field-narrow" placeholder="512Mi" /></div>

        <!-- ── Deployment Settings ── -->
        <div class="section-header"><q-icon name="mdi-cog-outline" size="15px" class="section-icon" /> Service Settings</div>
        <div class="form-row">
          <label class="form-label">Replicas</label>
          <div class="field-wrap">
            <input v-model="replicas" type="number" min="1" class="fs-input field-narrow" placeholder="1 (default)" />
            <span class="field-hint">Number of pod replicas</span>
          </div>
        </div>
        <div class="form-row">
          <label class="form-label">Service type</label>
          <select v-model="serviceType" class="fs-input field-narrow">
            <option>ClusterIP</option><option>NodePort</option><option>LoadBalancer</option>
          </select>
        </div>
        <div class="form-row">
          <label class="form-label">Service account</label>
          <input v-model="serviceAccountName" class="fs-input fs-mono field-narrow" placeholder="default" />
        </div>
        <div class="form-row">
          <label class="form-label">Unhealthy duration</label>
          <div class="field-wrap">
            <input v-model="unhealthyDuration" class="fs-input fs-mono field-narrow" placeholder="5m (default)" />
            <span class="field-hint">Go duration string — auto-rollback triggers after this unhealthy window</span>
          </div>
        </div>
        <div class="form-row">
          <label class="form-label">Revision history</label>
          <div class="field-wrap">
            <input v-model="revisionHistoryLimit" type="number" min="1" class="fs-input field-narrow" placeholder="5 (default)" />
            <span class="field-hint">Old ReplicaSets to retain for rollback</span>
          </div>
        </div>

        <!-- ── Volumes ── -->
        <div class="section-header"><q-icon name="mdi-harddisk" size="15px" class="section-icon" /> Volumes</div>
        <div class="form-row form-row--top">
          <label class="form-label">Mounts</label>
          <div class="field-wrap">
            <div v-if="volumes.length > 0" class="vol-table">
              <div class="vol-header">
                <span>Name</span><span>Mount Path</span><span>Type</span><span>Source Name</span><span></span>
              </div>
              <div v-for="(vol, i) in volumes" :key="i" class="vol-row">
                <input v-model="vol.name"       class="fs-input fs-mono vol-input" placeholder="creds" />
                <input v-model="vol.mountPath"  class="fs-input fs-mono vol-input" placeholder="/etc/creds" />
                <select v-model="vol.type" class="fs-input vol-select"><option value="secret">Secret</option><option value="configmap">ConfigMap</option></select>
                <input v-model="vol.sourceName" class="fs-input fs-mono vol-input" placeholder="my-secret" />
                <button type="button" class="icon-btn icon-btn--danger" title="Remove" @click="removeVolume(i)">
                  <q-icon name="mdi-close" size="13px" />
                </button>
              </div>
            </div>
            <button type="button" class="fs-btn fs-btn--ghost add-btn" @click="addVolume">
              <q-icon name="mdi-plus" size="13px" /> Add volume
            </button>
          </div>
        </div>

        <!-- ── Probes ── -->
        <div class="section-header"><q-icon name="mdi-stethoscope" size="15px" class="section-icon" /> Health Probes</div>

        <template v-for="(probe, label) in { 'Liveness': livenessProbe, 'Readiness': readinessProbe, 'Startup': startupProbe }" :key="label">
          <div class="probe-block">
            <div class="probe-header">
              <label class="toggle-wrap">
                <input v-model="probe.enabled" type="checkbox" class="toggle-input" />
                <span class="toggle-track"><span class="toggle-thumb" /></span>
              </label>
              <span class="probe-title">{{ label }} Probe</span>
              <span class="probe-status" :class="probe.enabled ? 'probe-status--on' : 'probe-status--off'">
                {{ probe.enabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
            <div v-if="probe.enabled" class="probe-body">
              <div class="probe-row">
                <label class="probe-label">Type</label>
                <select v-model="probe.type" class="fs-input field-narrow">
                  <option value="http">HTTP GET</option>
                  <option value="tcp">TCP Socket</option>
                  <option value="exec">Exec</option>
                </select>
              </div>
              <template v-if="probe.type === 'http'">
                <div class="probe-row">
                  <label class="probe-label">Path</label>
                  <input v-model="probe.httpPath" class="fs-input fs-mono field-narrow" placeholder="/" />
                </div>
                <div class="probe-row">
                  <label class="probe-label">Port</label>
                  <input v-model="probe.httpPort" class="fs-input fs-mono field-narrow" placeholder="8080" />
                </div>
                <div class="probe-row">
                  <label class="probe-label">Scheme</label>
                  <select v-model="probe.httpScheme" class="fs-input field-narrow">
                    <option>HTTP</option><option>HTTPS</option>
                  </select>
                </div>
              </template>
              <template v-else-if="probe.type === 'tcp'">
                <div class="probe-row">
                  <label class="probe-label">Port</label>
                  <input v-model="probe.tcpPort" class="fs-input fs-mono field-narrow" placeholder="8080" />
                </div>
              </template>
              <template v-else>
                <div class="probe-row probe-row--top">
                  <label class="probe-label">Command</label>
                  <textarea v-model="probe.execCommand" class="fs-input fs-textarea fs-mono" rows="2" placeholder="One entry per line" />
                </div>
              </template>
              <div class="probe-timing">
                <div class="timing-item">
                  <label class="timing-label">Initial delay (s)</label>
                  <input v-model="probe.initialDelaySeconds" type="number" min="0" class="fs-input timing-input" placeholder="0" />
                </div>
                <div class="timing-item">
                  <label class="timing-label">Period (s)</label>
                  <input v-model="probe.periodSeconds" type="number" min="1" class="fs-input timing-input" placeholder="10" />
                </div>
                <div class="timing-item">
                  <label class="timing-label">Timeout (s)</label>
                  <input v-model="probe.timeoutSeconds" type="number" min="1" class="fs-input timing-input" placeholder="1" />
                </div>
                <div class="timing-item">
                  <label class="timing-label">Success threshold</label>
                  <input v-model="probe.successThreshold" type="number" min="1" class="fs-input timing-input" placeholder="1" />
                </div>
                <div class="timing-item">
                  <label class="timing-label">Failure threshold</label>
                  <input v-model="probe.failureThreshold" type="number" min="1" class="fs-input timing-input" placeholder="3" />
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ── Ingress ── -->
        <div class="section-header"><q-icon name="mdi-web" size="15px" class="section-icon" /> Ingress</div>
        <div class="form-row">
          <label class="form-label">Enable ingress</label>
          <label class="toggle-wrap">
            <input v-model="ingressEnabled" type="checkbox" class="toggle-input" />
            <span class="toggle-track"><span class="toggle-thumb" /></span>
            <span class="toggle-label">{{ ingressEnabled ? 'Enabled' : 'Disabled' }}</span>
          </label>
        </div>
        <template v-if="ingressEnabled">
          <div class="form-row">
            <label class="form-label">Ingress class</label>
            <input v-model="ingressClassName" class="fs-input fs-mono field-narrow" placeholder="nginx" />
          </div>
          <div class="form-row">
            <label class="form-label">TLS secret</label>
            <input v-model="ingressTLSSecret" class="fs-input fs-mono field-narrow" placeholder="my-tls-secret" />
          </div>
          <div class="form-row form-row--top">
            <label class="form-label">Rules</label>
            <div class="field-wrap">
              <div class="ingress-table">
                <div class="ingress-header">
                  <span>Host</span><span>Path</span><span>Path Type</span><span>Service Port</span><span></span>
                </div>
                <div v-for="(rule, i) in ingressRules" :key="i" class="ingress-row">
                  <input v-model="rule.host"        class="fs-input fs-mono ingress-input" placeholder="app.example.com" />
                  <input v-model="rule.path"        class="fs-input fs-mono ingress-input" placeholder="/" />
                  <select v-model="rule.pathType" class="fs-input ingress-select">
                    <option>Prefix</option><option>Exact</option><option>ImplementationSpecific</option>
                  </select>
                  <input v-model="rule.servicePort" class="fs-input fs-mono ingress-input" placeholder="http" />
                  <button type="button" class="icon-btn icon-btn--danger" :disabled="ingressRules.length <= 1"
                          title="Remove" @click="removeIngressRule(i)">
                    <q-icon name="mdi-close" size="13px" />
                  </button>
                </div>
              </div>
              <button type="button" class="fs-btn fs-btn--ghost add-btn" @click="addIngressRule">
                <q-icon name="mdi-plus" size="13px" /> Add rule
              </button>
            </div>
          </div>
        </template>

        <!-- ── Submit ── -->
        <div v-if="submitError" class="inline-msg inline-msg--error">
          <q-icon name="mdi-alert-circle-outline" size="13px" />
          {{ submitError }}
        </div>
        <div class="form-actions">
          <button type="submit" class="fs-btn fs-btn--primary" :disabled="submitting">
            <q-spinner v-if="submitting" size="13px" color="white" />
            <q-icon v-else name="mdi-check-outline" size="14px" />
            {{ submitting ? 'Creating…' : 'Create Template' }}
          </button>
        </div>

      </form>
    </CanvasPanel>
  </div>
</template>

<style scoped>
.page-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; padding: 16px; align-content: start; }

.breadcrumb { grid-column: span 2; display: flex; align-items: center; gap: 6px; padding-bottom: 4px; }
.breadcrumb__back { display: flex; align-items: center; gap: 5px; background: none; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; color: var(--fs-text-muted); font-size: 12px; font-family: inherit; transition: color var(--fs-ease), background var(--fs-ease); }
.breadcrumb__back:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.breadcrumb__current { font-size: 12px; color: var(--fs-accent); font-weight: 500; }
.muted-icon { color: var(--fs-text-muted); }

.expert-form { display: flex; flex-direction: column; gap: 16px; padding: 4px 10px 10px; }

.section-header { display: flex; align-items: center; gap: 7px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fs-text-muted); padding: 8px 0 2px; border-bottom: 1px solid var(--fs-border); margin-bottom: 4px; }
.section-icon { color: var(--fs-accent); flex-shrink: 0; }

.form-row { display: grid; grid-template-columns: 160px 1fr; align-items: center; gap: 12px; }
.form-row--top { align-items: start; padding-top: 2px; }
.form-label { font-size: 11px; font-weight: 500; color: var(--fs-text-muted); }
.required { color: var(--fs-neg, #e57373); }
.field-wrap { display: flex; flex-direction: column; gap: 4px; }
.field-error { font-size: 11px; color: var(--fs-neg, #e57373); }
.field-hint  { font-size: 11px; color: var(--fs-text-muted); }
.field-narrow { max-width: 220px; }

.fs-input { width: 100%; background: var(--fs-bg-input, var(--fs-bg-hover)); border: 1px solid var(--fs-border); border-radius: 4px; padding: 7px 10px; font-size: 12.5px; font-family: inherit; color: var(--fs-text-primary); outline: none; transition: border-color var(--fs-ease); box-sizing: border-box; }
.fs-input:focus   { border-color: var(--fs-accent); }
.fs-input--error  { border-color: var(--fs-neg, #e57373); }
.fs-textarea      { resize: vertical; min-height: 60px; }
.fs-mono          { font-family: var(--fs-font-mono); }

.port-table  { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.port-header { display: grid; grid-template-columns: 1fr 80px 100px 80px 28px; gap: 6px; padding: 0 2px 2px; font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--fs-text-muted); }
.port-row    { display: grid; grid-template-columns: 1fr 80px 100px 80px 28px; gap: 6px; align-items: center; }
.port-input  { padding: 5px 8px; font-size: 12px; }
.port-select { padding: 5px 8px; font-size: 12px; appearance: auto; cursor: pointer; }

.env-table { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.env-header { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; padding: 0 2px 2px; }
.env-col-label { font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--fs-text-muted); }
.env-row   { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; align-items: center; }
.env-input { padding: 5px 8px; font-size: 12px; }

.vol-table  { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.vol-header { display: grid; grid-template-columns: 1fr 1.2fr 100px 1fr 28px; gap: 6px; padding: 0 2px 2px; font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--fs-text-muted); }
.vol-row    { display: grid; grid-template-columns: 1fr 1.2fr 100px 1fr 28px; gap: 6px; align-items: center; }
.vol-input  { padding: 5px 8px; font-size: 12px; }
.vol-select { padding: 5px 8px; font-size: 12px; appearance: auto; cursor: pointer; }

/* Probes */
.probe-block { border: 1px solid var(--fs-border); border-radius: 5px; overflow: hidden; }
.probe-header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--fs-bg-hover); }
.probe-title  { font-size: 12px; font-weight: 600; color: var(--fs-text-primary); flex: 1; }
.probe-status { font-size: 11px; font-weight: 500; }
.probe-status--on  { color: var(--fs-pos, #4caf50); }
.probe-status--off { color: var(--fs-text-muted); }
.probe-body   { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--fs-border); }
.probe-row    { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 12px; }
.probe-row--top { align-items: start; }
.probe-label  { font-size: 11px; color: var(--fs-text-muted); }
.probe-timing { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; padding-top: 4px; border-top: 1px solid var(--fs-border-dim, var(--fs-border)); margin-top: 4px; }
.timing-item  { display: flex; flex-direction: column; gap: 4px; }
.timing-label { font-size: 10px; color: var(--fs-text-muted); font-weight: 500; }
.timing-input { padding: 5px 8px; font-size: 12px; }

/* Toggle */
.toggle-wrap  { display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
.toggle-input { display: none; }
.toggle-track { position: relative; width: 34px; height: 18px; border-radius: 9px; background: var(--fs-border); border: 1px solid var(--fs-border); transition: background var(--fs-ease), border-color var(--fs-ease); flex-shrink: 0; }
.toggle-input:checked ~ .toggle-track { background: var(--fs-accent); border-color: var(--fs-accent); }
.toggle-thumb { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform var(--fs-ease); }
.toggle-input:checked ~ .toggle-track .toggle-thumb { transform: translateX(16px); }
.toggle-label { font-size: 12px; color: var(--fs-text-muted); }

/* Ingress */
.ingress-table  { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.ingress-header { display: grid; grid-template-columns: 1.5fr 1fr 140px 1fr 28px; gap: 6px; padding: 0 2px 2px; font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--fs-text-muted); }
.ingress-row    { display: grid; grid-template-columns: 1.5fr 1fr 140px 1fr 28px; gap: 6px; align-items: center; }
.ingress-input  { padding: 5px 8px; font-size: 12px; }
.ingress-select { padding: 5px 8px; font-size: 12px; appearance: auto; cursor: pointer; }

.add-btn { align-self: flex-start; padding: 4px 10px; font-size: 11.5px; margin-top: 2px; }

.icon-btn { background: none; border: none; cursor: pointer; padding: 4px 6px; border-radius: 3px; display: inline-flex; align-items: center; color: var(--fs-text-muted); transition: color var(--fs-ease), background var(--fs-ease); }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.icon-btn--danger:hover:not(:disabled) { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

.inline-msg { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 8px 10px; border-radius: 4px; }
.inline-msg--error { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

.form-actions { display: flex; justify-content: flex-end; padding-top: 8px; border-top: 1px solid var(--fs-border); margin-top: 4px; }

.fs-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 4px; font-size: 12.5px; font-family: inherit; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease), filter var(--fs-ease); }
.fs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fs-btn--primary { background: var(--fs-accent); color: #fff; border-color: var(--fs-accent); }
.fs-btn--primary:hover:not(:disabled) { filter: brightness(1.1); }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.fs-btn--ghost:hover:not(:disabled) { color: var(--fs-text-primary); background: var(--fs-bg-hover); border-color: var(--fs-border-bright, var(--fs-border)); }

.success-body { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 24px 40px; text-align: center; }
.success-icon  { color: var(--fs-pos, #4caf50); }
.success-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--fs-text-primary); }
.success-sub   { margin: 0; font-size: 12.5px; color: var(--fs-text-muted); }
.success-actions { margin-top: 8px; display: flex; gap: 8px; }
</style>
