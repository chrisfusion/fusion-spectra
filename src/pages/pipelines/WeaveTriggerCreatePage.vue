<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import CronPicker from '@/components/CronPicker.vue'
import { usePermission } from '@/composables/usePermission'
import * as weaveApi from '@/api/weaveApi'

const router = useRouter()
const { can } = usePermission()

// ─── Wizard state ─────────────────────────────────────────────────────────────

const step = ref<1 | 2 | 3>(1)
const stepLabels = ['Identity', 'Activation', 'Parameters'] as const

// ─── Step 1: trigger name + chain picker ──────────────────────────────────────

const triggerName      = ref('')
const triggerNameError = ref<string | null>(null)
const selectedChain    = ref('')
const chainError       = ref<string | null>(null)

const chains             = ref<weaveApi.WeaveChain[]>([])
const loadingChains      = ref(false)
const loadChainError     = ref<string | null>(null)

const K8S_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/

async function loadChains() {
  loadingChains.value  = true
  loadChainError.value = null
  try {
    const res = await weaveApi.listWeaveChains()
    chains.value = res.items ?? []
  } catch (e) {
    loadChainError.value = e instanceof Error ? e.message : 'Failed to load chains'
  } finally {
    loadingChains.value = false
  }
}

function validateStep1(): boolean {
  let ok = true
  const n = triggerName.value.trim()
  if (!n) {
    triggerNameError.value = 'Name is required'
    ok = false
  } else if (!K8S_NAME_RE.test(n)) {
    triggerNameError.value = 'Lowercase letters, digits and hyphens only; must start and end with alphanumeric'
    ok = false
  } else if (n.length > 253) {
    triggerNameError.value = 'Max 253 characters'
    ok = false
  } else {
    triggerNameError.value = null
  }
  if (!selectedChain.value) {
    chainError.value = 'Select a chain'
    ok = false
  } else {
    chainError.value = null
  }
  return ok
}

function goToStep2() {
  if (validateStep1()) step.value = 2
}

// ─── Step 2: trigger type + conditional fields ────────────────────────────────

const triggerType  = ref<'OnDemand' | 'Cron' | 'Webhook' | 'BatchCron' | 'Kafka'>('OnDemand')
const schedule     = ref('')
const scheduleError = ref<string | null>(null)
const webhookPath  = ref('/trigger/')
const webhookPathError = ref<string | null>(null)
const webhookSecret = ref('')

// BatchCron fields
const batchJobsYaml       = ref('')
const batchJobsYamlError  = ref<string | null>(null)
const batchValidating     = ref(false)
const batchValidateResult = ref<weaveApi.WeaveBatchValidateResponse | null>(null)
const batchJobCount = computed(() => (batchJobsYaml.value.match(/^\s*-\s*job\s*:/gm) ?? []).length)

async function runBatchValidation(): Promise<boolean> {
  batchValidating.value = true
  try {
    batchValidateResult.value = await weaveApi.validateBatchJobs(batchJobsYaml.value)
    return batchValidateResult.value.valid
  } catch (e) {
    batchValidateResult.value = {
      valid:  false,
      errors: [{ line: 1, message: e instanceof Error ? e.message : 'Validation request failed' }],
    }
    return false
  } finally {
    batchValidating.value = false
  }
}

// Kafka fields (comma-separated inputs for list values — broker/bucket names
// may contain dots and colons, which TagChipInput's tag regex disallows)
const kafkaBrokers          = ref('')
const kafkaBrokersError     = ref<string | null>(null)
const kafkaTopic            = ref('')
const kafkaTopicError       = ref<string | null>(null)
const kafkaConsumerGroup    = ref('')
const kafkaConsumerGroupError = ref<string | null>(null)
const kafkaSecretRef        = ref('')
const kafkaEventFilter      = ref<Set<'put' | 'delete' | 'get'>>(new Set())
const kafkaBucketFilter     = ref('')
const kafkaMaxConcurrentRuns = ref('')
const kafkaMaxConcurrentRunsError = ref<string | null>(null)

function toggleKafkaEvent(kind: 'put' | 'delete' | 'get') {
  const next = new Set(kafkaEventFilter.value)
  if (next.has(kind)) next.delete(kind)
  else next.add(kind)
  kafkaEventFilter.value = next
}

// Minimal cron expression format check (5 or 6 fields)
const CRON_RE = /^(\S+\s+){4}\S+(\s+\S+)?$/

watch(triggerType, () => {
  scheduleError.value             = null
  webhookPathError.value          = null
  kafkaBrokersError.value         = null
  kafkaTopicError.value           = null
  kafkaConsumerGroupError.value   = null
  kafkaMaxConcurrentRunsError.value = null
  batchJobsYamlError.value        = null
  batchValidateResult.value       = null
})

function validateStep2(): boolean {
  let ok = true
  if (triggerType.value === 'Cron') {
    const s = schedule.value.trim()
    if (!s) {
      scheduleError.value = 'Schedule is required'
      ok = false
    } else if (!CRON_RE.test(s)) {
      scheduleError.value = 'Must be a valid cron expression, e.g. "*/5 * * * *"'
      ok = false
    } else {
      scheduleError.value = null
    }
  }
  if (triggerType.value === 'Webhook') {
    const p = webhookPath.value.trim()
    if (!p || !p.startsWith('/')) {
      webhookPathError.value = 'Path must start with /'
      ok = false
    } else if (p.length < 2) {
      webhookPathError.value = 'Path must be at least 2 characters'
      ok = false
    } else {
      webhookPathError.value = null
    }
  }
  if (triggerType.value === 'Kafka') {
    if (parseCsv(kafkaBrokers.value).length === 0) {
      kafkaBrokersError.value = 'At least one broker is required'
      ok = false
    } else {
      kafkaBrokersError.value = null
    }
    if (!kafkaTopic.value.trim()) {
      kafkaTopicError.value = 'Topic is required'
      ok = false
    } else {
      kafkaTopicError.value = null
    }
    if (!kafkaConsumerGroup.value.trim()) {
      kafkaConsumerGroupError.value = 'Consumer group is required'
      ok = false
    } else {
      kafkaConsumerGroupError.value = null
    }
    const rawMax = kafkaMaxConcurrentRuns.value.trim()
    if (rawMax && (!/^\d+$/.test(rawMax) || Number(rawMax) < 0)) {
      kafkaMaxConcurrentRunsError.value = 'Must be a non-negative integer'
      ok = false
    } else {
      kafkaMaxConcurrentRunsError.value = null
    }
  }
  if (triggerType.value === 'BatchCron') {
    if (!batchJobsYaml.value.trim()) {
      batchJobsYamlError.value = 'Jobs YAML is required'
      ok = false
    } else {
      batchJobsYamlError.value = null
    }
  }
  return ok
}

function parseCsv(raw: string): string[] {
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

async function goToStep3() {
  if (!validateStep2()) return
  if (triggerType.value === 'BatchCron') {
    const ok = await runBatchValidation()
    if (!ok) return
  }
  step.value = 3
}

// ─── Step 3: parameter overrides ─────────────────────────────────────────────

interface EnvRow { key: string; value: string }
const paramRows = ref<EnvRow[]>([{ key: '', value: '' }])
const authSecretRefOverride = ref('')

function addParamRow() {
  paramRows.value = [...paramRows.value, { key: '', value: '' }]
}
function removeParamRow(i: number) {
  const rows = paramRows.value.filter((_, idx) => idx !== i)
  paramRows.value = rows.length > 0 ? rows : [{ key: '', value: '' }]
}

// ─── Submit ───────────────────────────────────────────────────────────────────

const submitting      = ref(false)
const submitError     = ref<string | null>(null)
const createdTrigger  = ref<weaveApi.WeaveTrigger | null>(null)

function buildSpec(): weaveApi.WeaveTriggerSpec {
  const spec: weaveApi.WeaveTriggerSpec = {
    chainRef: { name: selectedChain.value },
    type:     triggerType.value,
  }

  if (triggerType.value === 'Cron') {
    spec.schedule = schedule.value.trim()
  }

  if (triggerType.value === 'Webhook') {
    spec.webhook = { path: webhookPath.value.trim() }
    if (webhookSecret.value.trim()) {
      spec.webhook.secretRef = { name: webhookSecret.value.trim() }
    }
  }

  if (triggerType.value === 'Kafka') {
    spec.kafka = buildKafkaConfig()
  }

  const overrides = paramRows.value
    .filter(r => r.key.trim())
    .map(r => ({ name: r.key.trim(), value: r.value }))
  if (overrides.length) spec.parameterOverrides = overrides

  if (authSecretRefOverride.value.trim()) {
    spec.authSecretRefOverride = { name: authSecretRefOverride.value.trim() }
  }

  return spec
}

function buildKafkaConfig(): weaveApi.WeaveKafkaConfig {
  const kafka: weaveApi.WeaveKafkaConfig = {
    brokers:       parseCsv(kafkaBrokers.value),
    topic:         kafkaTopic.value.trim(),
    consumerGroup: kafkaConsumerGroup.value.trim(),
  }
  if (kafkaSecretRef.value.trim()) kafka.secretRef = { name: kafkaSecretRef.value.trim() }
  if (kafkaEventFilter.value.size) kafka.eventFilter = [...kafkaEventFilter.value]
  const buckets = parseCsv(kafkaBucketFilter.value)
  if (buckets.length) kafka.bucketFilter = buckets
  const rawMax = kafkaMaxConcurrentRuns.value.trim()
  if (rawMax) kafka.maxConcurrentRuns = Number(rawMax)
  return kafka
}

async function submit() {
  submitting.value  = true
  submitError.value = null
  try {
    if (triggerType.value === 'Kafka') {
      createdTrigger.value = await weaveApi.createKafkaTrigger({
        name:     triggerName.value.trim(),
        chainRef: { name: selectedChain.value },
        kafka:    buildKafkaConfig(),
      })
    } else if (triggerType.value === 'BatchCron') {
      createdTrigger.value = await weaveApi.createBatchTrigger({
        name:     triggerName.value.trim(),
        chainRef: { name: selectedChain.value },
        jobs:     batchJobsYaml.value,
      })
    } else {
      createdTrigger.value = await weaveApi.createWeaveTrigger({
        metadata: { name: triggerName.value.trim() },
        spec:     buildSpec(),
      })
    }
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Creation failed'
  } finally {
    submitting.value = false
  }
}

function createAnother() {
  triggerName.value      = ''
  triggerNameError.value = null
  selectedChain.value    = ''
  chainError.value       = null
  triggerType.value      = 'OnDemand'
  schedule.value         = ''
  scheduleError.value    = null
  webhookPath.value      = '/trigger/'
  webhookPathError.value = null
  webhookSecret.value    = ''
  kafkaBrokers.value              = ''
  kafkaBrokersError.value         = null
  kafkaTopic.value                = ''
  kafkaTopicError.value           = null
  kafkaConsumerGroup.value        = ''
  kafkaConsumerGroupError.value   = null
  kafkaSecretRef.value            = ''
  kafkaEventFilter.value          = new Set()
  kafkaBucketFilter.value         = ''
  kafkaMaxConcurrentRuns.value    = ''
  kafkaMaxConcurrentRunsError.value = null
  batchJobsYaml.value        = ''
  batchJobsYamlError.value   = null
  batchValidateResult.value  = null
  paramRows.value        = [{ key: '', value: '' }]
  authSecretRefOverride.value = ''
  submitError.value      = null
  createdTrigger.value   = null
  step.value             = 1
}

// Load chains on mount
loadChains()
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/pipelines/weave/triggers')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Weave Triggers
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">Create Trigger</span>
    </div>

    <CanvasPanel title="Create Weave Trigger" icon="mdi-plus-circle-outline" :wide="true">

      <!-- ── Success state ── -->
      <div v-if="createdTrigger" class="success-body">
        <q-icon name="mdi-check-circle-outline" size="48px" class="success-icon" />
        <p class="success-title">Trigger created</p>
        <p class="success-sub">
          <span class="fs-mono">{{ createdTrigger.metadata.name }}</span>
          is now registered and will activate chain
          <span class="fs-mono">{{ createdTrigger.spec.chainRef.name }}</span>.
        </p>
        <div class="success-actions">
          <button class="fs-btn fs-btn--ghost" @click="router.push('/pipelines/weave/triggers')">
            <q-icon name="mdi-format-list-bulleted" size="14px" />
            View Triggers
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
            :class="{
              'wizard-step--active': step === i + 1,
              'wizard-step--done':   step > i + 1,
            }"
          >
            <div class="wizard-step__dot">
              <q-icon v-if="step > i + 1" name="mdi-check" size="11px" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="wizard-step__label">{{ label }}</span>
            <div v-if="i < stepLabels.length - 1" class="wizard-step__line" />
          </div>
        </div>

        <!-- ── Step 1: Identity ── -->
        <div v-if="step === 1" class="form-body">

          <div class="form-row">
            <label class="form-label">Trigger name <span class="required">*</span></label>
            <div class="field-wrap">
              <input
                v-model="triggerName"
                class="fs-input fs-mono"
                :class="{ 'fs-input--error': triggerNameError }"
                placeholder="my-trigger"
                @keydown.enter.prevent="goToStep2"
              />
              <span v-if="triggerNameError" class="field-error">{{ triggerNameError }}</span>
              <span v-else class="field-hint">Lowercase, alphanumeric and hyphens; used as the Kubernetes resource name</span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Chain <span class="required">*</span></label>
            <div class="field-wrap">
              <div v-if="loadingChains" class="picker-loading">
                <q-spinner size="14px" /> Loading chains…
              </div>
              <div v-else-if="loadChainError" class="picker-error">
                <q-icon name="mdi-alert-circle-outline" size="13px" />
                {{ loadChainError }}
                <button class="retry-link" @click="loadChains">Retry</button>
              </div>
              <template v-else>
                <select
                  v-model="selectedChain"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': chainError }"
                >
                  <option value="" disabled>— select a chain —</option>
                  <option v-for="c in chains" :key="c.metadata.name" :value="c.metadata.name">
                    {{ c.metadata.name }}
                  </option>
                </select>
                <span v-if="chainError" class="field-error">{{ chainError }}</span>
                <span v-else-if="chains.length === 0" class="field-hint warn-hint">
                  <q-icon name="mdi-alert-outline" size="11px" />
                  No chains found — create one first
                </span>
                <span v-else class="field-hint">{{ chains.length }} chain{{ chains.length !== 1 ? 's' : '' }} available</span>
              </template>
            </div>
          </div>

          <div class="form-actions">
            <button class="fs-btn fs-btn--primary" :disabled="loadingChains" @click="goToStep2">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>

        </div>

        <!-- ── Step 2: Activation ── -->
        <div v-else-if="step === 2" class="form-body">

          <div class="form-row">
            <label class="form-label">Type <span class="required">*</span></label>
            <div class="field-wrap">
              <div class="kind-toggle">
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': triggerType === 'OnDemand' }"
                  @click="triggerType = 'OnDemand'"
                >
                  <q-icon name="mdi-hand-back-right-outline" size="14px" />
                  OnDemand
                </button>
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': triggerType === 'Cron' }"
                  @click="triggerType = 'Cron'"
                >
                  <q-icon name="mdi-clock-outline" size="14px" />
                  Cron
                </button>
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': triggerType === 'Webhook' }"
                  @click="triggerType = 'Webhook'"
                >
                  <q-icon name="mdi-webhook" size="14px" />
                  Webhook
                </button>
                <button
                  v-if="can('weave:batchtriggers:write')"
                  class="kind-btn"
                  :class="{ 'kind-btn--active': triggerType === 'BatchCron' }"
                  @click="triggerType = 'BatchCron'"
                >
                  <q-icon name="mdi-calendar-multiple" size="14px" />
                  BatchCron
                </button>
                <button
                  v-if="can('weave:kafkatriggers:write')"
                  class="kind-btn"
                  :class="{ 'kind-btn--active': triggerType === 'Kafka' }"
                  @click="triggerType = 'Kafka'"
                >
                  <q-icon name="mdi-apache-kafka" size="14px" />
                  Kafka
                </button>
              </div>
              <span class="field-hint">
                <template v-if="triggerType === 'OnDemand'">Fired manually via annotation or API</template>
                <template v-else-if="triggerType === 'Cron'">Fires on a cron schedule</template>
                <template v-else-if="triggerType === 'Webhook'">Fires on an incoming HTTP POST</template>
                <template v-else-if="triggerType === 'BatchCron'">Fires individual jobs from a YAML job list, each on its own cron schedule</template>
                <template v-else>Fires on messages consumed from a Kafka topic</template>
              </span>
            </div>
          </div>

          <!-- Cron: schedule -->
          <div v-if="triggerType === 'Cron'" class="form-row form-row--top">
            <label class="form-label">Schedule <span class="required">*</span></label>
            <div class="field-wrap">
              <CronPicker v-model="schedule" :error="scheduleError" />
            </div>
          </div>

          <!-- Webhook: path + optional secret -->
          <template v-if="triggerType === 'Webhook'">
            <div class="form-row">
              <label class="form-label">Path <span class="required">*</span></label>
              <div class="field-wrap">
                <input
                  v-model="webhookPath"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': webhookPathError }"
                  placeholder="/trigger/my-chain"
                />
                <span v-if="webhookPathError" class="field-error">{{ webhookPathError }}</span>
                <span v-else class="field-hint">URL path the webhook server listens on; must start with /</span>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Secret ref</label>
              <div class="field-wrap">
                <input
                  v-model="webhookSecret"
                  class="fs-input fs-mono"
                  placeholder="my-webhook-secret"
                />
                <span class="field-hint">Name of a Kubernetes Secret with a "token" key for bearer auth; leave blank for unauthenticated</span>
              </div>
            </div>
          </template>

          <!-- BatchCron: jobs YAML + validation -->
          <template v-if="triggerType === 'BatchCron'">
            <div class="form-row form-row--top">
              <label class="form-label">Jobs YAML <span class="required">*</span></label>
              <div class="field-wrap">
                <textarea
                  v-model="batchJobsYaml"
                  class="fs-input fs-textarea fs-mono"
                  :class="{ 'fs-input--error': batchJobsYamlError }"
                  rows="10"
                  placeholder="- job:
    id: daily-report
    name: Daily Report
    schedule: &quot;0 9 * * *&quot;
    topic: reports
    maintainer: alice@example.com
    startdate: &quot;2026-07-15&quot;
    metadata:
      region: eu-west"
                ></textarea>
                <span v-if="batchJobsYamlError" class="field-error">{{ batchJobsYamlError }}</span>
                <span v-else class="field-hint">
                  YAML list of job entries; each needs <code>id</code> and <code>schedule</code> (standard cron
                  expression). Optional: <code>name</code>, <code>topic</code>, <code>maintainer</code>,
                  <code>startdate</code> (YYYY-MM-DD), <code>starttime</code> (HH:MM), <code>metadata</code> —
                  all injected as JOB_* env vars into the run
                </span>
                <button
                  class="fs-btn fs-btn--ghost add-env-btn"
                  type="button"
                  :disabled="batchValidating || !batchJobsYaml.trim()"
                  @click="runBatchValidation"
                >
                  <q-spinner v-if="batchValidating" size="13px" />
                  <q-icon v-else name="mdi-check-decagram-outline" size="13px" />
                  Validate
                </button>
                <div v-if="batchValidateResult?.valid" class="inline-msg inline-msg--ok">
                  <q-icon name="mdi-check-circle-outline" size="13px" />
                  {{ batchJobCount }} job entr{{ batchJobCount === 1 ? 'y' : 'ies' }} valid
                </div>
                <div v-else-if="batchValidateResult && !batchValidateResult.valid" class="batch-validate-error">
                  <div class="batch-validate-error__title">
                    <q-icon name="mdi-alert-circle-outline" size="13px" />
                    Invalid jobs YAML:
                  </div>
                  <ul class="batch-error-list">
                    <li v-for="(err, i) in batchValidateResult.errors ?? []" :key="i">
                      line {{ err.line }}: {{ err.message }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </template>

          <!-- Kafka: connection + optional filters -->
          <template v-if="triggerType === 'Kafka'">
            <div class="form-row">
              <label class="form-label">Brokers <span class="required">*</span></label>
              <div class="field-wrap">
                <input
                  v-model="kafkaBrokers"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': kafkaBrokersError }"
                  placeholder="broker1:9092,broker2:9092"
                />
                <span v-if="kafkaBrokersError" class="field-error">{{ kafkaBrokersError }}</span>
                <span v-else class="field-hint">Comma-separated Kafka bootstrap broker addresses</span>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Topic <span class="required">*</span></label>
              <div class="field-wrap">
                <input
                  v-model="kafkaTopic"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': kafkaTopicError }"
                  placeholder="my-topic"
                />
                <span v-if="kafkaTopicError" class="field-error">{{ kafkaTopicError }}</span>
                <span v-else class="field-hint">Kafka topic to consume from</span>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Consumer group <span class="required">*</span></label>
              <div class="field-wrap">
                <input
                  v-model="kafkaConsumerGroup"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': kafkaConsumerGroupError }"
                  placeholder="my-trigger-group"
                />
                <span v-if="kafkaConsumerGroupError" class="field-error">{{ kafkaConsumerGroupError }}</span>
                <span v-else class="field-hint">Kafka consumer group ID</span>
              </div>
            </div>

            <div class="section-title">Advanced (optional)</div>

            <div class="form-row">
              <label class="form-label">Secret ref</label>
              <div class="field-wrap">
                <input
                  v-model="kafkaSecretRef"
                  class="fs-input fs-mono"
                  placeholder="my-kafka-sasl-secret"
                />
                <span class="field-hint">Name of a Kubernetes Secret with "username"/"password" (and optional "mechanism") keys for SASL auth; leave blank for no auth</span>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Event filter</label>
              <div class="field-wrap">
                <div class="kind-toggle">
                  <button
                    class="kind-btn"
                    :class="{ 'kind-btn--active': kafkaEventFilter.has('put') }"
                    @click="toggleKafkaEvent('put')"
                  >put</button>
                  <button
                    class="kind-btn"
                    :class="{ 'kind-btn--active': kafkaEventFilter.has('delete') }"
                    @click="toggleKafkaEvent('delete')"
                  >delete</button>
                  <button
                    class="kind-btn"
                    :class="{ 'kind-btn--active': kafkaEventFilter.has('get') }"
                    @click="toggleKafkaEvent('get')"
                  >get</button>
                </div>
                <span class="field-hint">S3 event types that trigger a run; none selected = accept all events</span>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Bucket filter</label>
              <div class="field-wrap">
                <input
                  v-model="kafkaBucketFilter"
                  class="fs-input fs-mono"
                  placeholder="bucket-one,bucket-two"
                />
                <span class="field-hint">Comma-separated S3 bucket names; leave blank to accept all buckets</span>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Max concurrent runs</label>
              <div class="field-wrap">
                <input
                  v-model="kafkaMaxConcurrentRuns"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': kafkaMaxConcurrentRunsError }"
                  placeholder="0"
                />
                <span v-if="kafkaMaxConcurrentRunsError" class="field-error">{{ kafkaMaxConcurrentRunsError }}</span>
                <span v-else class="field-hint">Caps active WeaveRuns for this trigger; 0 or blank = unlimited</span>
              </div>
            </div>
          </template>

          <div class="form-actions">
            <button class="fs-btn fs-btn--ghost" @click="step = 1">
              <q-icon name="mdi-arrow-left" size="14px" /> Back
            </button>
            <button class="fs-btn fs-btn--primary" @click="goToStep3">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>

        </div>

        <!-- ── Step 3: Parameters ── -->
        <div v-else class="form-body">

          <div class="section-title">Parameter overrides</div>

          <div class="form-row form-row--top">
            <label class="form-label">Overrides</label>
            <div class="field-wrap">
              <div class="env-table">
                <div class="env-header">
                  <span class="env-header__key">Key</span>
                  <span class="env-header__val">Value</span>
                </div>
                <div
                  v-for="(row, i) in paramRows"
                  :key="i"
                  class="env-row"
                >
                  <input
                    v-model="row.key"
                    class="fs-input fs-mono env-input"
                    placeholder="MY_PARAM"
                  />
                  <input
                    v-model="row.value"
                    class="fs-input fs-mono env-input"
                    placeholder="value"
                  />
                  <button class="icon-btn icon-btn--danger" title="Remove" @click="removeParamRow(i)">
                    <q-icon name="mdi-close" size="13px" />
                  </button>
                </div>
              </div>
              <button class="fs-btn fs-btn--ghost add-env-btn" @click="addParamRow">
                <q-icon name="mdi-plus" size="13px" />
                Add parameter
              </button>
              <span class="field-hint">Injected into every WeaveRun created by this trigger, on top of per-step env vars</span>
            </div>
          </div>

          <div v-if="triggerType !== 'Kafka' && triggerType !== 'BatchCron'" class="form-row">
            <label class="form-label">Auth secret override</label>
            <div class="field-wrap">
              <input v-model="authSecretRefOverride" class="fs-input fs-mono" placeholder="(chain default)" />
              <span class="field-hint">
                Overrides the chain's authSecretRef for every run created by this trigger; leave blank to
                inherit the chain default
              </span>
            </div>
          </div>

          <!-- Summary box -->
          <div class="summary-box">
            <div class="summary-box__title">
              <q-icon name="mdi-information-outline" size="13px" />
              Trigger summary
            </div>
            <ul class="summary-list">
              <li><span class="sum-key">trigger name</span> <span class="sum-val fs-mono">{{ triggerName }}</span></li>
              <li><span class="sum-key">chain</span>        <span class="sum-val fs-mono">{{ selectedChain }}</span></li>
              <li><span class="sum-key">type</span>         <span class="sum-val fs-mono">{{ triggerType }}</span></li>
              <li v-if="triggerType === 'Cron'"><span class="sum-key">schedule</span> <span class="sum-val fs-mono">{{ schedule }}</span></li>
              <li v-if="triggerType === 'Webhook'"><span class="sum-key">path</span>  <span class="sum-val fs-mono">{{ webhookPath }}</span></li>
              <template v-if="triggerType === 'Kafka'">
                <li><span class="sum-key">brokers</span>        <span class="sum-val fs-mono">{{ kafkaBrokers }}</span></li>
                <li><span class="sum-key">topic</span>          <span class="sum-val fs-mono">{{ kafkaTopic }}</span></li>
                <li><span class="sum-key">consumer group</span> <span class="sum-val fs-mono">{{ kafkaConsumerGroup }}</span></li>
              </template>
              <li v-if="triggerType === 'BatchCron'">
                <span class="sum-key">batch jobs</span> <span class="sum-val fs-mono">{{ batchJobCount }} entr{{ batchJobCount === 1 ? 'y' : 'ies' }}</span>
              </li>
              <li v-if="triggerType !== 'Kafka' && triggerType !== 'BatchCron' && authSecretRefOverride">
                <span class="sum-key">auth secret</span> <span class="sum-val fs-mono">{{ authSecretRefOverride }}</span>
              </li>
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
              {{ submitting ? 'Creating…' : 'Create Trigger' }}
            </button>
          </div>

        </div>

      </template>
    </CanvasPanel>
  </div>
</template>

<style scoped>
.page-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 16px;
  align-content: start;
}

.breadcrumb {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 4px;
}
.breadcrumb__back {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--fs-text-muted);
  font-size: 12px;
  font-family: inherit;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.breadcrumb__back:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.breadcrumb__current { font-size: 12px; color: var(--fs-accent); font-weight: 500; }
.muted-icon { color: var(--fs-text-muted); }

.wizard-steps { display: flex; align-items: center; padding: 16px 10px 24px; }
.wizard-step { display: flex; align-items: center; gap: 8px; flex: 1; }
.wizard-step:last-child { flex: none; }
.wizard-step__dot {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; flex-shrink: 0;
  border: 1.5px solid var(--fs-border);
  color: var(--fs-text-muted); background: var(--fs-bg-panel);
  transition: border-color var(--fs-ease), background var(--fs-ease), color var(--fs-ease);
}
.wizard-step--active .wizard-step__dot { border-color: var(--fs-accent); background: var(--fs-accent); color: #fff; }
.wizard-step--done   .wizard-step__dot { border-color: var(--fs-pos, #4caf50); background: var(--fs-pos, #4caf50); color: #fff; }
.wizard-step__label { font-size: 11.5px; font-weight: 500; color: var(--fs-text-muted); white-space: nowrap; transition: color var(--fs-ease); }
.wizard-step--active .wizard-step__label,
.wizard-step--done   .wizard-step__label { color: var(--fs-text-primary); }
.wizard-step__line { flex: 1; height: 1px; background: var(--fs-border); margin: 0 8px; }

.form-body { display: flex; flex-direction: column; gap: 20px; padding: 0 10px 10px; }
.form-row { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 12px; }
.form-row--top { align-items: start; padding-top: 4px; }
.form-label {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted); padding-top: 8px;
}
.required { color: var(--fs-neg, #e57373); }
.field-wrap { display: flex; flex-direction: column; gap: 4px; }
.field-error { font-size: 11px; color: var(--fs-neg, #e57373); }
.field-hint  { font-size: 11px; color: var(--fs-text-muted); }
.warn-hint   { color: var(--fs-warn, #ff9800); display: flex; align-items: center; gap: 4px; }

.fs-input {
  width: 100%;
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border: 1px solid var(--fs-border);
  border-radius: 4px;
  padding: 7px 10px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--fs-text-primary);
  outline: none;
  transition: border-color var(--fs-ease);
  box-sizing: border-box;
}
.fs-input:focus  { border-color: var(--fs-accent); }
.fs-input--error { border-color: var(--fs-neg, #e57373); }
.fs-mono { font-family: var(--fs-font-mono); }
.fs-textarea { resize: vertical; min-height: 140px; }

.kind-toggle { display: flex; gap: 6px; }
.kind-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 4px; font-size: 12px;
  font-family: inherit; font-weight: 500; cursor: pointer;
  border: 1px solid var(--fs-border); background: transparent;
  color: var(--fs-text-muted);
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease);
}
.kind-btn:hover { background: var(--fs-bg-hover); color: var(--fs-text-primary); }
.kind-btn--active {
  border-color: var(--fs-accent);
  background: color-mix(in srgb, var(--fs-accent) 12%, transparent);
  color: var(--fs-accent);
}

.picker-loading,
.picker-error {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--fs-text-muted); padding: 8px 0;
}
.picker-error { color: var(--fs-neg, #e57373); }
.retry-link {
  background: none; border: none; cursor: pointer;
  color: var(--fs-accent); font-size: 12px; padding: 0; text-decoration: underline;
}

.section-title {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted);
  padding: 0 2px 4px; border-bottom: 1px solid var(--fs-border);
}

.env-table { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.env-header { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; padding: 0 2px 2px; }
.env-header__key,
.env-header__val {
  font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--fs-text-muted);
}
.env-row { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; align-items: center; }
.env-input { padding: 5px 8px; font-size: 12px; }
.add-env-btn { align-self: flex-start; padding: 4px 10px; font-size: 11.5px; margin-top: 2px; }

.summary-box {
  background: var(--fs-bg-hover); border: 1px solid var(--fs-border);
  border-radius: 5px; padding: 10px 14px;
}
.summary-box__title {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; color: var(--fs-text-muted); margin-bottom: 8px;
}
.summary-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.summary-list li { display: flex; align-items: baseline; gap: 8px; font-size: 11.5px; }
.sum-key { font-family: var(--fs-font-mono); color: var(--fs-accent); min-width: 100px; font-size: 11px; }
.sum-val { color: var(--fs-text-muted); }

.inline-msg {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; padding: 8px 10px; border-radius: 4px;
}
.inline-msg--error {
  color: var(--fs-neg, #e57373);
  background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent);
}
.inline-msg--ok {
  color: var(--fs-pos, #4caf50);
  background: color-mix(in srgb, var(--fs-pos, #4caf50) 10%, transparent);
}

.batch-validate-error {
  color: var(--fs-neg, #e57373);
  background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent);
  border-radius: 4px;
  padding: 8px 10px;
  font-size: 12px;
}
.batch-validate-error__title { display: flex; align-items: center; gap: 6px; }
.batch-error-list { margin: 4px 0 0; padding-left: 20px; font-family: var(--fs-font-mono); font-size: 11.5px; }
.batch-error-list li { padding: 1px 0; }

.form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

.fs-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 16px; border-radius: 4px; font-size: 12.5px;
  font-family: inherit; font-weight: 500; cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease), filter var(--fs-ease);
}
.fs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fs-btn--primary { background: var(--fs-accent); color: #fff; border-color: var(--fs-accent); }
.fs-btn--primary:hover:not(:disabled) { filter: brightness(1.1); }
.fs-btn--ghost { background: transparent; color: var(--fs-text-muted); border-color: var(--fs-border); }
.fs-btn--ghost:hover:not(:disabled) {
  color: var(--fs-text-primary); background: var(--fs-bg-hover);
  border-color: var(--fs-border-bright, var(--fs-border));
}

.icon-btn {
  background: none; border: none; cursor: pointer; padding: 4px 6px;
  border-radius: 3px; display: inline-flex; align-items: center;
  color: var(--fs-text-muted); transition: color var(--fs-ease), background var(--fs-ease);
}
.icon-btn--danger:hover { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

.success-body {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 48px 24px 40px; text-align: center;
}
.success-icon  { color: var(--fs-pos, #4caf50); }
.success-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--fs-text-primary); }
.success-sub   { margin: 0; font-size: 12.5px; color: var(--fs-text-muted); }
.success-actions { margin-top: 8px; display: flex; gap: 8px; }
</style>
