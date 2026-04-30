<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as weaveApi from '@/api/weaveApi'

const router = useRouter()

// ─── Wizard state ─────────────────────────────────────────────────────────────

const step = ref<1 | 2 | 3>(1)
const stepLabels = ['Identity & Ports', 'Command & Env', 'Service Config'] as const

// ─── Step 1: name + image + ports ─────────────────────────────────────────────

const name       = ref('')
const image      = ref('')
const nameError  = ref<string | null>(null)
const imageError = ref<string | null>(null)
const portsError = ref<string | null>(null)

const K8S_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/

interface PortRow {
  name:       string
  port:       string
  targetPort: string
  protocol:   'TCP' | 'UDP' | 'SCTP'
}
const ports = ref<PortRow[]>([{ name: 'http', port: '', targetPort: '', protocol: 'TCP' }])

function addPort() {
  ports.value = [...ports.value, { name: '', port: '', targetPort: '', protocol: 'TCP' }]
}
function removePort(i: number) {
  if (ports.value.length > 1) ports.value = ports.value.filter((_, idx) => idx !== i)
}

function validateStep1(): boolean {
  let ok = true
  const n = name.value.trim()
  if (!n) {
    nameError.value = 'Name is required'
    ok = false
  } else if (!K8S_NAME_RE.test(n)) {
    nameError.value = 'Lowercase letters, digits and hyphens only; must start and end with alphanumeric'
    ok = false
  } else if (n.length > 253) {
    nameError.value = 'Max 253 characters'
    ok = false
  } else {
    nameError.value = null
  }
  if (!image.value.trim()) {
    imageError.value = 'Image is required'
    ok = false
  } else {
    imageError.value = null
  }
  const validPorts = ports.value.filter(p => p.name.trim() && p.port.trim())
  if (validPorts.length === 0) {
    portsError.value = 'At least one port with name and port number is required'
    ok = false
  } else {
    portsError.value = null
  }
  return ok
}

function goToStep2() {
  if (validateStep1()) step.value = 2
}

// ─── Step 2: command, args, env ───────────────────────────────────────────────

const commandText = ref('')
const argsText    = ref('')

interface EnvRow { key: string; value: string }
const envRows = ref<EnvRow[]>([{ key: '', value: '' }])

function addEnvRow() { envRows.value = [...envRows.value, { key: '', value: '' }] }
function removeEnvRow(i: number) {
  const rows = envRows.value.filter((_, idx) => idx !== i)
  envRows.value = rows.length > 0 ? rows : [{ key: '', value: '' }]
}

// ─── Step 3: deployment config ────────────────────────────────────────────────

const replicas    = ref('')
const serviceType = ref<'ClusterIP' | 'NodePort' | 'LoadBalancer'>('ClusterIP')
const cpuRequest    = ref('')
const cpuLimit      = ref('')
const memoryRequest = ref('')
const memoryLimit   = ref('')

// ─── Submit ───────────────────────────────────────────────────────────────────

const submitting      = ref(false)
const submitError     = ref<string | null>(null)
const createdTemplate = ref<weaveApi.WeaveServiceTemplate | null>(null)

function buildSpec(): weaveApi.WeaveServiceTemplateSpec {
  const builtPorts: weaveApi.WeaveServicePort[] = ports.value
    .filter(p => p.name.trim() && p.port.trim())
    .map(p => {
      const portNum = parseInt(p.port)
      const targetNum = parseInt(p.targetPort)
      return {
        name:       p.name.trim(),
        port:       portNum,
        ...(p.targetPort.trim() && !isNaN(targetNum) ? { targetPort: targetNum } : {}),
        protocol:   p.protocol,
      }
    })

  const spec: weaveApi.WeaveServiceTemplateSpec = {
    image: image.value.trim(),
    ports: builtPorts,
  }

  const cmd = commandText.value.split('\n').map(s => s.trim()).filter(Boolean)
  if (cmd.length) spec.command = cmd

  const args = argsText.value.split('\n').map(s => s.trim()).filter(Boolean)
  if (args.length) spec.args = args

  const env = envRows.value.filter(r => r.key.trim()).map(r => ({ name: r.key.trim(), value: r.value }))
  if (env.length) spec.env = env

  const rep = parseInt(replicas.value)
  if (!isNaN(rep) && rep >= 1) spec.replicas = rep
  spec.serviceType = serviceType.value

  const resources: weaveApi.ResourceRequirements = {}
  if (cpuRequest.value.trim() || memoryRequest.value.trim()) {
    resources.requests = {}
    if (cpuRequest.value.trim())    resources.requests.cpu    = cpuRequest.value.trim()
    if (memoryRequest.value.trim()) resources.requests.memory = memoryRequest.value.trim()
  }
  if (cpuLimit.value.trim() || memoryLimit.value.trim()) {
    resources.limits = {}
    if (cpuLimit.value.trim())    resources.limits.cpu    = cpuLimit.value.trim()
    if (memoryLimit.value.trim()) resources.limits.memory = memoryLimit.value.trim()
  }
  if (resources.requests || resources.limits) spec.resources = resources

  return spec
}

async function submit() {
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
  name.value        = ''
  image.value       = ''
  ports.value       = [{ name: 'http', port: '', targetPort: '', protocol: 'TCP' }]
  commandText.value = ''
  argsText.value    = ''
  envRows.value     = [{ key: '', value: '' }]
  replicas.value    = ''
  serviceType.value = 'ClusterIP'
  cpuRequest.value = cpuLimit.value = memoryRequest.value = memoryLimit.value = ''
  submitError.value    = null
  createdTemplate.value = null
  step.value           = 1
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
      <span class="breadcrumb__current">Create Service Template</span>
    </div>

    <CanvasPanel title="Create Service Template" icon="mdi-plus-circle-outline" :wide="true">

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

      <!-- ── Wizard ── -->
      <template v-else>

        <!-- Step indicator -->
        <div class="wizard-steps">
          <div
            v-for="(label, i) in stepLabels"
            :key="label"
            class="wizard-step"
            :class="{ 'wizard-step--active': step === i + 1, 'wizard-step--done': step > i + 1 }"
          >
            <div class="wizard-step__dot">
              <q-icon v-if="step > i + 1" name="mdi-check" size="11px" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="wizard-step__label">{{ label }}</span>
            <div v-if="i < stepLabels.length - 1" class="wizard-step__line" />
          </div>
        </div>

        <!-- ── Step 1: Identity & Ports ── -->
        <div v-if="step === 1" class="form-body">

          <div class="form-row">
            <label class="form-label">Name <span class="required">*</span></label>
            <div class="field-wrap">
              <input v-model="name" class="fs-input fs-mono" :class="{ 'fs-input--error': nameError }"
                     placeholder="my-service-template" />
              <span v-if="nameError" class="field-error">{{ nameError }}</span>
              <span v-else class="field-hint">Kubernetes resource name: lowercase, alphanumeric and hyphens</span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Image <span class="required">*</span></label>
            <div class="field-wrap">
              <input v-model="image" class="fs-input fs-mono" :class="{ 'fs-input--error': imageError }"
                     placeholder="nginx:latest" />
              <span v-if="imageError" class="field-error">{{ imageError }}</span>
            </div>
          </div>

          <!-- Ports -->
          <div class="form-row form-row--top">
            <label class="form-label">Ports <span class="required">*</span></label>
            <div class="field-wrap">
              <div class="port-table">
                <div class="port-header">
                  <span>Name</span>
                  <span>Port</span>
                  <span>Target Port</span>
                  <span>Protocol</span>
                  <span></span>
                </div>
                <div v-for="(p, i) in ports" :key="i" class="port-row">
                  <input v-model="p.name"       class="fs-input fs-mono port-input" placeholder="http" />
                  <input v-model="p.port"       class="fs-input fs-mono port-input" type="number" min="1" max="65535" placeholder="8080" />
                  <input v-model="p.targetPort" class="fs-input fs-mono port-input" type="number" min="1" max="65535" placeholder="same as port" />
                  <select v-model="p.protocol" class="fs-input port-select">
                    <option>TCP</option>
                    <option>UDP</option>
                    <option>SCTP</option>
                  </select>
                  <button type="button" class="icon-btn icon-btn--danger" :disabled="ports.length <= 1"
                          title="Remove" @click="removePort(i)">
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

          <div class="form-actions">
            <button class="fs-btn fs-btn--primary" @click="goToStep2">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>
        </div>

        <!-- ── Step 2: Command & Env ── -->
        <div v-else-if="step === 2" class="form-body">

          <div class="form-row form-row--top">
            <label class="form-label">Command</label>
            <div class="field-wrap">
              <textarea v-model="commandText" class="fs-input fs-textarea fs-mono" rows="3"
                        placeholder="One entry per line&#10;nginx&#10;-g" />
              <span class="field-hint">Overrides the container entrypoint; one argument per line</span>
            </div>
          </div>

          <div class="form-row form-row--top">
            <label class="form-label">Args</label>
            <div class="field-wrap">
              <textarea v-model="argsText" class="fs-input fs-textarea fs-mono" rows="3"
                        placeholder="One entry per line" />
              <span class="field-hint">Arguments passed to the command; one argument per line</span>
            </div>
          </div>

          <div class="form-row form-row--top">
            <label class="form-label">Env vars</label>
            <div class="field-wrap">
              <div class="env-table">
                <div class="env-header">
                  <span class="env-header__key">Key</span>
                  <span class="env-header__val">Value</span>
                </div>
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

          <div class="form-actions">
            <button class="fs-btn fs-btn--ghost" @click="step = 1">
              <q-icon name="mdi-arrow-left" size="14px" /> Back
            </button>
            <button class="fs-btn fs-btn--primary" @click="step = 3">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>
        </div>

        <!-- ── Step 3: Service Config ── -->
        <div v-else class="form-body">

          <div class="form-row">
            <label class="form-label">Replicas</label>
            <div class="field-wrap">
              <input v-model="replicas" type="number" min="1" class="fs-input field-narrow" placeholder="1 (default)" />
              <span class="field-hint">Number of pod replicas to run</span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Service type</label>
            <select v-model="serviceType" class="fs-input field-narrow">
              <option>ClusterIP</option>
              <option>NodePort</option>
              <option>LoadBalancer</option>
            </select>
          </div>

          <div class="resources-grid">
            <div class="res-group">
              <div class="res-group__label">CPU</div>
              <div class="res-row">
                <label class="res-label">Request</label>
                <input v-model="cpuRequest" class="fs-input fs-mono res-input" placeholder="200m" />
              </div>
              <div class="res-row">
                <label class="res-label">Limit</label>
                <input v-model="cpuLimit"   class="fs-input fs-mono res-input" placeholder="500m" />
              </div>
            </div>
            <div class="res-group">
              <div class="res-group__label">Memory</div>
              <div class="res-row">
                <label class="res-label">Request</label>
                <input v-model="memoryRequest" class="fs-input fs-mono res-input" placeholder="256Mi" />
              </div>
              <div class="res-row">
                <label class="res-label">Limit</label>
                <input v-model="memoryLimit"   class="fs-input fs-mono res-input" placeholder="512Mi" />
              </div>
            </div>
          </div>

          <!-- Defaults info -->
          <div class="defaults-box">
            <div class="defaults-box__title">
              <q-icon name="mdi-information-outline" size="13px" />
              Defaults applied for fields not set above
            </div>
            <ul class="defaults-list">
              <li><span class="def-key">serviceAccountName</span> <span class="def-val">default</span></li>
              <li><span class="def-key">unhealthyDuration</span>  <span class="def-val">5m</span></li>
              <li><span class="def-key">revisionHistoryLimit</span> <span class="def-val">5</span></li>
              <li><span class="def-key">livenessProbe</span>      <span class="def-val">none</span></li>
              <li><span class="def-key">readinessProbe</span>     <span class="def-val">none</span></li>
              <li><span class="def-key">startupProbe</span>       <span class="def-val">none</span></li>
              <li><span class="def-key">ingress</span>            <span class="def-val">disabled</span></li>
              <li><span class="def-key">volumes</span>            <span class="def-val">none</span></li>
            </ul>
          </div>

          <!-- Submit error -->
          <div v-if="submitError" class="inline-msg inline-msg--error">
            <q-icon name="mdi-alert-circle-outline" size="13px" />
            {{ submitError }}
          </div>

          <div class="form-actions">
            <button class="fs-btn fs-btn--ghost" :disabled="submitting" @click="step = 2">
              <q-icon name="mdi-arrow-left" size="14px" /> Back
            </button>
            <button class="fs-btn fs-btn--primary" :disabled="submitting" @click="submit">
              <q-spinner v-if="submitting" size="13px" color="white" />
              <q-icon v-else name="mdi-check-outline" size="14px" />
              {{ submitting ? 'Creating…' : 'Create Template' }}
            </button>
          </div>
        </div>

      </template>
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

.wizard-steps { display: flex; align-items: center; padding: 16px 10px 24px; }
.wizard-step { display: flex; align-items: center; gap: 8px; flex: 1; }
.wizard-step:last-child { flex: none; }
.wizard-step__dot { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; border: 1.5px solid var(--fs-border); color: var(--fs-text-muted); background: var(--fs-bg-panel); transition: border-color var(--fs-ease), background var(--fs-ease), color var(--fs-ease); }
.wizard-step--active .wizard-step__dot { border-color: var(--fs-accent); background: var(--fs-accent); color: #fff; }
.wizard-step--done   .wizard-step__dot { border-color: var(--fs-pos, #4caf50); background: var(--fs-pos, #4caf50); color: #fff; }
.wizard-step__label { font-size: 11.5px; font-weight: 500; color: var(--fs-text-muted); white-space: nowrap; transition: color var(--fs-ease); }
.wizard-step--active .wizard-step__label, .wizard-step--done .wizard-step__label { color: var(--fs-text-primary); }
.wizard-step__line { flex: 1; height: 1px; background: var(--fs-border); margin: 0 8px; }

.form-body { display: flex; flex-direction: column; gap: 20px; padding: 0 10px 10px; }
.form-row { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 12px; }
.form-row--top { align-items: start; padding-top: 4px; }
.form-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fs-text-muted); padding-top: 8px; }
.required { color: var(--fs-neg, #e57373); }
.field-wrap { display: flex; flex-direction: column; gap: 4px; }
.field-error { font-size: 11px; color: var(--fs-neg, #e57373); }
.field-hint  { font-size: 11px; color: var(--fs-text-muted); }
.field-narrow { max-width: 220px; }

.fs-input { width: 100%; background: var(--fs-bg-input, var(--fs-bg-hover)); border: 1px solid var(--fs-border); border-radius: 4px; padding: 7px 10px; font-size: 12.5px; font-family: inherit; color: var(--fs-text-primary); outline: none; transition: border-color var(--fs-ease); box-sizing: border-box; }
.fs-input:focus   { border-color: var(--fs-accent); }
.fs-input--error  { border-color: var(--fs-neg, #e57373); }
.fs-textarea      { resize: vertical; min-height: 72px; }
.fs-mono          { font-family: var(--fs-font-mono); }

.port-table { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.port-header { display: grid; grid-template-columns: 1fr 80px 100px 80px 28px; gap: 6px; padding: 0 2px 2px; font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--fs-text-muted); }
.port-row    { display: grid; grid-template-columns: 1fr 80px 100px 80px 28px; gap: 6px; align-items: center; }
.port-input  { padding: 5px 8px; font-size: 12px; }
.port-select { padding: 5px 8px; font-size: 12px; appearance: auto; cursor: pointer; }

.env-table { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.env-header { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; padding: 0 2px 2px; }
.env-header__key, .env-header__val { font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--fs-text-muted); }
.env-row    { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; align-items: center; }
.env-input  { padding: 5px 8px; font-size: 12px; }

.add-btn { align-self: flex-start; padding: 4px 10px; font-size: 11.5px; margin-top: 2px; }

.icon-btn { background: none; border: none; cursor: pointer; padding: 4px 6px; border-radius: 3px; display: inline-flex; align-items: center; color: var(--fs-text-muted); transition: color var(--fs-ease), background var(--fs-ease); }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.icon-btn--danger:hover:not(:disabled) { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

.resources-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.res-group { display: flex; flex-direction: column; gap: 8px; }
.res-group__label { font-size: 11px; font-weight: 600; color: var(--fs-text-primary); text-transform: uppercase; letter-spacing: 0.05em; }
.res-row { display: flex; align-items: center; gap: 10px; }
.res-label { font-size: 11px; color: var(--fs-text-muted); width: 54px; flex-shrink: 0; }
.res-input { flex: 1; padding: 5px 8px; font-size: 12px; }

.defaults-box { background: var(--fs-bg-hover); border: 1px solid var(--fs-border); border-radius: 5px; padding: 10px 14px; }
.defaults-box__title { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--fs-text-muted); margin-bottom: 8px; }
.defaults-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.defaults-list li { display: flex; align-items: baseline; gap: 8px; font-size: 11.5px; }
.def-key { font-family: var(--fs-font-mono); color: var(--fs-accent); min-width: 180px; font-size: 11px; }
.def-val { color: var(--fs-text-muted); }

.inline-msg { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 8px 10px; border-radius: 4px; }
.inline-msg--error { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

.form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

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
