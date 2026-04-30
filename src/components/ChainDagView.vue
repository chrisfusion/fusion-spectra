<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueFlow, type Node, type Edge, MarkerType, Position } from '@vue-flow/core'
import dagre from '@dagrejs/dagre'
import type { WeaveChainStep, WeaveJobTemplate, WeaveServiceTemplate } from '@/api/weaveApi'
import { getJobTemplate, getServiceTemplate } from '@/api/weaveApi'

import '@vue-flow/core/dist/style.css'

const props = defineProps<{ steps: WeaveChainStep[] }>()

const NODE_W = 200
const NODE_H = 72

// ─── Graph layout ─────────────────────────────────────────────────────────────

function buildGraph(steps: WeaveChainStep[]): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 60, nodesep: 50 })

  steps.forEach(s => dagreGraph.setNode(s.name, { width: NODE_W, height: NODE_H }))

  steps.forEach(s => {
    if (s.dependsOn?.length) {
      s.dependsOn.forEach(dep => dagreGraph.setEdge(dep, s.name))
    }
  })

  // For fully disconnected chains (no dependsOn at all), wire steps in declaration order
  // so the diagram isn't a floating cloud. Strip these synthetic edges before rendering.
  const hasAnyDeps = steps.some(s => s.dependsOn?.length)
  if (!hasAnyDeps && steps.length > 1) {
    for (let i = 1; i < steps.length; i++) {
      dagreGraph.setEdge(steps[i - 1].name, steps[i].name)
    }
  }

  dagre.layout(dagreGraph)

  const nodes: Node[] = steps.flatMap(s => {
    const pos = dagreGraph.node(s.name)
    if (!pos) return []
    return [{
      id: s.name,
      type: 'chain-step',
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: {
        name: s.name,
        stepKind: s.stepKind ?? 'Job',
        templateRef: s.jobTemplateRef?.name ?? s.serviceTemplateRef?.name ?? null,
        conditionLabel: (s.runOnSuccess && !s.runOnFailure) ? 'Runs on success only'
                      : (!s.runOnSuccess && s.runOnFailure) ? 'Runs on failure only'
                      : null,
        step: s,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }]
  })

  const edges: Edge[] = []
  dagreGraph.edges().forEach(({ v, w }) => {
    edges.push({
      id: `${v}→${w}`,
      source: v,
      target: w,
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--fs-border)' },
      style: { stroke: 'var(--fs-border)' },
    })
  })

  if (!hasAnyDeps && steps.length > 1) {
    return { nodes, edges: [] }
  }

  return { nodes, edges }
}

const graph = computed(() => buildGraph(props.steps))

// ─── Node selection + dialog ──────────────────────────────────────────────────

const selectedStep    = ref<WeaveChainStep | null>(null)
const selectedNodeId  = ref<string | null>(null)
const dialogOpen      = ref(false)

const jobTemplate     = ref<WeaveJobTemplate | null>(null)
const serviceTemplate = ref<WeaveServiceTemplate | null>(null)
const tplLoading      = ref(false)
const tplError        = ref<string | null>(null)

async function openStep(nodeData: { step: WeaveChainStep; name: string }) {
  selectedStep.value   = nodeData.step
  selectedNodeId.value = nodeData.name
  dialogOpen.value     = true

  // Reset template state and fetch fresh for this step
  jobTemplate.value     = null
  serviceTemplate.value = null
  tplError.value        = null

  const step = nodeData.step
  const refName = step.jobTemplateRef?.name ?? step.serviceTemplateRef?.name
  if (!refName) return

  tplLoading.value = true
  try {
    if (step.jobTemplateRef?.name) {
      jobTemplate.value = await getJobTemplate(step.jobTemplateRef.name)
    } else if (step.serviceTemplateRef?.name) {
      serviceTemplate.value = await getServiceTemplate(step.serviceTemplateRef.name)
    }
  } catch (e) {
    tplError.value = e instanceof Error ? e.message : 'Failed to load template'
  } finally {
    tplLoading.value = false
  }
}

function displayKind(kind?: string): string {
  return kind === 'Deploy' ? 'Service' : (kind ?? 'Job')
}

watch(dialogOpen, open => {
  if (!open) {
    selectedNodeId.value  = null
    jobTemplate.value     = null
    serviceTemplate.value = null
    tplError.value        = null
  }
})


</script>

<template>
  <div class="dag-wrap">
    <VueFlow
      :nodes="graph.nodes"
      :edges="graph.edges"
      :fit-view-on-init="true"
      :nodes-connectable="false"
      :nodes-draggable="false"
      :zoom-on-scroll="true"
      :pan-on-drag="true"
      :min-zoom="0.3"
      :max-zoom="2"
      class="dag-flow"
      @node-click="({ node }) => openStep(node.data)"
    >
      <template #node-chain-step="{ data, id }">
        <div
          class="step-node"
          :class="[
            `step-node--${(data.stepKind ?? 'job').toLowerCase()}`,
            { 'step-node--selected': id === selectedNodeId }
          ]"
        >
          <div class="step-node__header">
            <q-icon
              :name="data.stepKind === 'Deploy' ? 'mdi-server-outline' : 'mdi-briefcase-outline'"
              size="13px"
              class="step-node__icon"
            />
            <span class="step-node__kind">{{ displayKind(data.stepKind) }}</span>
          </div>
          <div class="step-node__name fs-mono">{{ data.name }}</div>
          <div v-if="data.templateRef" class="step-node__ref">{{ data.templateRef }}</div>

          <!-- Hover tooltip -->
          <q-tooltip
            anchor="top middle"
            self="bottom middle"
            :offset="[0, 8]"
            :delay="300"
            class="step-tooltip"
          >
            <div class="tip-row">
              <span class="tip-label">Depends on</span>
              <span class="tip-value fs-mono">
                {{ data.step.dependsOn?.length ? data.step.dependsOn.join(', ') : 'none' }}
              </span>
            </div>
            <div v-if="data.conditionLabel" class="tip-row tip-row--flag">
              <q-icon name="mdi-alert-circle-outline" size="12px" />
              {{ data.conditionLabel }}
            </div>
            <div v-if="data.step.producesOutput" class="tip-row tip-row--flag">
              <q-icon name="mdi-database-export-outline" size="12px" />
              Produces output
            </div>
            <div class="tip-hint">Click to see full details</div>
          </q-tooltip>
        </div>
      </template>
    </VueFlow>

    <!-- Step detail dialog -->
    <q-dialog v-model="dialogOpen" :maximized="false">
      <div v-if="selectedStep" class="step-dialog">

        <!-- Header -->
        <div class="step-dialog__header">
          <div class="step-dialog__title-row">
            <q-icon
              :name="selectedStep.stepKind === 'Deploy' ? 'mdi-server-outline' : 'mdi-briefcase-outline'"
              size="16px"
              class="step-dialog__kind-icon"
              :class="`step-dialog__kind-icon--${(selectedStep.stepKind ?? 'job').toLowerCase()}`"
            />
            <span class="step-dialog__name fs-mono">{{ selectedStep.name }}</span>
          </div>
          <button class="step-dialog__close" @click="dialogOpen = false">
            <q-icon name="mdi-close" size="16px" />
          </button>
        </div>

        <!-- Identity -->
        <div class="step-dialog__section">
          <div class="step-dialog__section-title">Identity</div>
          <div class="step-dialog__row">
            <span class="step-dialog__label">Kind</span>
            <span class="step-dialog__value">{{ displayKind(selectedStep.stepKind) }}</span>
          </div>
          <div class="step-dialog__row">
            <span class="step-dialog__label">Template</span>
            <span class="step-dialog__value fs-mono">
              {{ selectedStep.jobTemplateRef?.name ?? selectedStep.serviceTemplateRef?.name ?? '—' }}
            </span>
          </div>
        </div>

        <!-- Dependencies -->
        <div class="step-dialog__section">
          <div class="step-dialog__section-title">Dependencies</div>
          <div class="step-dialog__row">
            <span class="step-dialog__label">Depends on</span>
            <span class="step-dialog__value fs-mono">
              {{ selectedStep.dependsOn?.length ? selectedStep.dependsOn.join(', ') : 'none' }}
            </span>
          </div>
          <div class="step-dialog__row">
            <span class="step-dialog__label">Run on success</span>
            <span class="step-dialog__value">{{ selectedStep.runOnSuccess ? 'yes' : 'no' }}</span>
          </div>
          <div class="step-dialog__row">
            <span class="step-dialog__label">Run on failure</span>
            <span class="step-dialog__value">{{ selectedStep.runOnFailure ? 'yes' : 'no' }}</span>
          </div>
          <div v-if="selectedStep.consumesOutputFrom?.length" class="step-dialog__row">
            <span class="step-dialog__label">Consumes from</span>
            <span class="step-dialog__value fs-mono">{{ selectedStep.consumesOutputFrom.join(', ') }}</span>
          </div>
        </div>

        <!-- I/O -->
        <div class="step-dialog__section">
          <div class="step-dialog__section-title">I/O</div>
          <div class="step-dialog__row">
            <span class="step-dialog__label">Produces output</span>
            <span class="step-dialog__value">{{ selectedStep.producesOutput ? 'yes' : 'no' }}</span>
          </div>
        </div>

        <!-- Env overrides -->
        <div v-if="selectedStep.envOverrides?.length" class="step-dialog__section">
          <div class="step-dialog__section-title">Env Overrides</div>
          <table class="step-dialog__env-table">
            <thead>
              <tr><th>Key</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr v-for="env in selectedStep.envOverrides" :key="env.name">
                <td class="fs-mono">{{ env.name }}</td>
                <td class="fs-mono">{{ env.value ?? '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ── Template details bar ────────────────────────────────── -->
        <template v-if="selectedStep.jobTemplateRef?.name || selectedStep.serviceTemplateRef?.name">

          <!-- Bar header -->
          <div class="step-dialog__tpl-bar">
            <q-icon
              :name="selectedStep.stepKind === 'Deploy' ? 'mdi-server-outline' : 'mdi-briefcase-outline'"
              size="14px"
              class="step-dialog__tpl-bar-icon"
              :class="selectedStep.stepKind === 'Deploy' ? 'tpl-icon--deploy' : 'tpl-icon--job'"
            />
            <span class="step-dialog__tpl-bar-label">
              {{ selectedStep.stepKind === 'Deploy' ? 'Service' : 'Job' }} Template
            </span>
            <span class="step-dialog__tpl-bar-name fs-mono">
              {{ selectedStep.jobTemplateRef?.name ?? selectedStep.serviceTemplateRef?.name }}
            </span>
          </div>

          <!-- Loading -->
          <div v-if="tplLoading" class="step-dialog__tpl-loading">
            <q-spinner size="16px" color="primary" />
            Loading template…
          </div>

          <!-- Error -->
          <div v-else-if="tplError" class="step-dialog__tpl-error">
            <q-icon name="mdi-alert-circle-outline" size="13px" />
            {{ tplError }}
          </div>

          <!-- Job template spec -->
          <template v-else-if="jobTemplate">
            <div class="step-dialog__section">
              <div class="step-dialog__section-title">Container</div>
              <div class="step-dialog__row">
                <span class="step-dialog__label">Image</span>
                <span class="step-dialog__value fs-mono">{{ jobTemplate.spec.image }}</span>
              </div>
              <div v-if="jobTemplate.spec.command?.length" class="step-dialog__row">
                <span class="step-dialog__label">Command</span>
                <span class="step-dialog__value fs-mono">{{ jobTemplate.spec.command.join(' ') }}</span>
              </div>
              <div v-if="jobTemplate.spec.args?.length" class="step-dialog__row">
                <span class="step-dialog__label">Args</span>
                <span class="step-dialog__value fs-mono">{{ jobTemplate.spec.args.join(' ') }}</span>
              </div>
              <div v-if="jobTemplate.spec.serviceAccountName" class="step-dialog__row">
                <span class="step-dialog__label">Service Account</span>
                <span class="step-dialog__value fs-mono">{{ jobTemplate.spec.serviceAccountName }}</span>
              </div>
            </div>

            <div class="step-dialog__section">
              <div class="step-dialog__section-title">Execution</div>
              <div v-if="jobTemplate.spec.parallelism != null" class="step-dialog__row">
                <span class="step-dialog__label">Parallelism</span>
                <span class="step-dialog__value">{{ jobTemplate.spec.parallelism }}</span>
              </div>
              <div v-if="jobTemplate.spec.completions != null" class="step-dialog__row">
                <span class="step-dialog__label">Completions</span>
                <span class="step-dialog__value">{{ jobTemplate.spec.completions }}</span>
              </div>
              <div v-if="jobTemplate.spec.activeDeadlineSeconds != null" class="step-dialog__row">
                <span class="step-dialog__label">Deadline</span>
                <span class="step-dialog__value">{{ jobTemplate.spec.activeDeadlineSeconds }}s</span>
              </div>
              <div v-if="jobTemplate.spec.retryPolicy" class="step-dialog__row">
                <span class="step-dialog__label">Retry</span>
                <span class="step-dialog__value">
                  {{ jobTemplate.spec.retryPolicy.maxRetries }}× every {{ jobTemplate.spec.retryPolicy.backoffSeconds }}s
                </span>
              </div>
            </div>

            <div v-if="jobTemplate.spec.resources" class="step-dialog__section">
              <div class="step-dialog__section-title">Resources</div>
              <div v-if="jobTemplate.spec.resources.requests?.cpu || jobTemplate.spec.resources.requests?.memory" class="step-dialog__row">
                <span class="step-dialog__label">Requests</span>
                <span class="step-dialog__value fs-mono">
                  {{ [jobTemplate.spec.resources.requests?.cpu && `cpu: ${jobTemplate.spec.resources.requests.cpu}`, jobTemplate.spec.resources.requests?.memory && `mem: ${jobTemplate.spec.resources.requests.memory}`].filter(Boolean).join('  ') }}
                </span>
              </div>
              <div v-if="jobTemplate.spec.resources.limits?.cpu || jobTemplate.spec.resources.limits?.memory" class="step-dialog__row">
                <span class="step-dialog__label">Limits</span>
                <span class="step-dialog__value fs-mono">
                  {{ [jobTemplate.spec.resources.limits?.cpu && `cpu: ${jobTemplate.spec.resources.limits.cpu}`, jobTemplate.spec.resources.limits?.memory && `mem: ${jobTemplate.spec.resources.limits.memory}`].filter(Boolean).join('  ') }}
                </span>
              </div>
            </div>

            <div v-if="jobTemplate.spec.env?.length" class="step-dialog__section">
              <div class="step-dialog__section-title">Template Env</div>
              <table class="step-dialog__env-table">
                <thead><tr><th>Key</th><th>Value</th></tr></thead>
                <tbody>
                  <tr v-for="env in jobTemplate.spec.env" :key="env.name">
                    <td class="fs-mono">{{ env.name }}</td>
                    <td class="fs-mono">{{ env.value ?? '' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <!-- Service template spec -->
          <template v-else-if="serviceTemplate">
            <div class="step-dialog__section">
              <div class="step-dialog__section-title">Container</div>
              <div class="step-dialog__row">
                <span class="step-dialog__label">Image</span>
                <span class="step-dialog__value fs-mono">{{ serviceTemplate.spec.image }}</span>
              </div>
              <div v-if="serviceTemplate.spec.command?.length" class="step-dialog__row">
                <span class="step-dialog__label">Command</span>
                <span class="step-dialog__value fs-mono">{{ serviceTemplate.spec.command.join(' ') }}</span>
              </div>
              <div v-if="serviceTemplate.spec.args?.length" class="step-dialog__row">
                <span class="step-dialog__label">Args</span>
                <span class="step-dialog__value fs-mono">{{ serviceTemplate.spec.args.join(' ') }}</span>
              </div>
              <div v-if="serviceTemplate.spec.serviceAccountName" class="step-dialog__row">
                <span class="step-dialog__label">Service Account</span>
                <span class="step-dialog__value fs-mono">{{ serviceTemplate.spec.serviceAccountName }}</span>
              </div>
            </div>

            <div class="step-dialog__section">
              <div class="step-dialog__section-title">Service</div>
              <div v-if="serviceTemplate.spec.replicas != null" class="step-dialog__row">
                <span class="step-dialog__label">Replicas</span>
                <span class="step-dialog__value">{{ serviceTemplate.spec.replicas }}</span>
              </div>
              <div v-if="serviceTemplate.spec.serviceType" class="step-dialog__row">
                <span class="step-dialog__label">Service type</span>
                <span class="step-dialog__value fs-mono">{{ serviceTemplate.spec.serviceType }}</span>
              </div>
            </div>

            <div v-if="serviceTemplate.spec.ports?.length" class="step-dialog__section">
              <div class="step-dialog__section-title">Ports</div>
              <table class="step-dialog__env-table">
                <thead><tr><th>Name</th><th>Port</th><th>Protocol</th></tr></thead>
                <tbody>
                  <tr v-for="p in serviceTemplate.spec.ports" :key="p.name">
                    <td class="fs-mono">{{ p.name }}</td>
                    <td class="fs-mono">{{ p.port }}{{ p.targetPort != null ? ` → ${p.targetPort}` : '' }}</td>
                    <td class="fs-mono">{{ p.protocol ?? 'TCP' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="serviceTemplate.spec.resources" class="step-dialog__section">
              <div class="step-dialog__section-title">Resources</div>
              <div v-if="serviceTemplate.spec.resources.requests?.cpu || serviceTemplate.spec.resources.requests?.memory" class="step-dialog__row">
                <span class="step-dialog__label">Requests</span>
                <span class="step-dialog__value fs-mono">
                  {{ [serviceTemplate.spec.resources.requests?.cpu && `cpu: ${serviceTemplate.spec.resources.requests.cpu}`, serviceTemplate.spec.resources.requests?.memory && `mem: ${serviceTemplate.spec.resources.requests.memory}`].filter(Boolean).join('  ') }}
                </span>
              </div>
              <div v-if="serviceTemplate.spec.resources.limits?.cpu || serviceTemplate.spec.resources.limits?.memory" class="step-dialog__row">
                <span class="step-dialog__label">Limits</span>
                <span class="step-dialog__value fs-mono">
                  {{ [serviceTemplate.spec.resources.limits?.cpu && `cpu: ${serviceTemplate.spec.resources.limits.cpu}`, serviceTemplate.spec.resources.limits?.memory && `mem: ${serviceTemplate.spec.resources.limits.memory}`].filter(Boolean).join('  ') }}
                </span>
              </div>
            </div>

            <div v-if="serviceTemplate.spec.env?.length" class="step-dialog__section">
              <div class="step-dialog__section-title">Template Env</div>
              <table class="step-dialog__env-table">
                <thead><tr><th>Key</th><th>Value</th></tr></thead>
                <tbody>
                  <tr v-for="env in serviceTemplate.spec.env" :key="env.name">
                    <td class="fs-mono">{{ env.name }}</td>
                    <td class="fs-mono">{{ env.value ?? '' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

        </template>

      </div>
    </q-dialog>
  </div>
</template>

<style scoped>
.dag-wrap {
  width: 100%;
  height: 420px;
  background: var(--fs-bg-input, var(--fs-bg-hover));
  border-radius: 4px;
  overflow: hidden;
}

.dag-flow {
  width: 100%;
  height: 100%;
  --vf-node-bg: transparent;
}

/* Custom node */
.step-node {
  width: v-bind('NODE_W + "px"');
  min-height: v-bind('NODE_H + "px"');
  background: var(--fs-bg-elevated);
  border: 1.5px solid var(--fs-border);
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.step-node:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.step-node--job    { border-left: 3px solid var(--fs-accent); }
.step-node--deploy { border-left: 3px solid var(--fs-pos, #4caf50); }

.step-node--selected {
  box-shadow: 0 0 0 2px var(--fs-accent), 0 2px 8px rgba(0,0,0,0.2);
  border-color: var(--fs-accent);
}

.step-node__header {
  display: flex;
  align-items: center;
  gap: 5px;
}
.step-node__icon { opacity: 0.8; }

.step-node--job    .step-node__icon { color: var(--fs-accent); }
.step-node--deploy .step-node__icon { color: var(--fs-pos, #4caf50); }

.step-node__kind {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.step-node--job    .step-node__kind { color: var(--fs-accent); }
.step-node--deploy .step-node__kind { color: var(--fs-pos, #4caf50); }

.step-node__name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fs-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-node__ref {
  font-size: 11px;
  color: var(--fs-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fs-mono { font-family: var(--fs-font-mono); }
</style>

<!-- vue-flow internals + q-tooltip + q-dialog are portals — unscoped required -->
<style>
.dag-flow .vue-flow__background { display: none; }
.dag-flow .vue-flow__edge-path  { stroke-width: 1.5; }
.dag-flow .vue-flow__arrowhead path { fill: var(--fs-border); }
.dag-flow .vue-flow__handle { display: none; }

/* Tooltip */
.step-tooltip {
  background: var(--fs-bg-elevated) !important;
  border: 1px solid var(--fs-border) !important;
  border-radius: 6px !important;
  padding: 10px 13px !important;
  font-size: 12px !important;
  color: var(--fs-text-primary) !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18) !important;
  min-width: 180px;
}
.step-tooltip .tip-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 0;
  border-bottom: 1px solid var(--fs-border);
}
.step-tooltip .tip-row:last-of-type { border-bottom: none; }
.step-tooltip .tip-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 72px;
}
.step-tooltip .tip-value {
  font-size: 11.5px;
  color: var(--fs-text-primary);
}
.step-tooltip .tip-row--flag {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--fs-warn, #ff9800);
  border-bottom: none;
  padding-top: 5px;
}
.step-tooltip .tip-hint {
  font-size: 10px;
  color: var(--fs-text-muted);
  margin-top: 6px;
  text-align: center;
  opacity: 0.7;
}

/* Step detail dialog */
.step-dialog {
  background: var(--fs-bg-elevated);
  border: 1px solid var(--fs-border);
  border-radius: 8px;
  min-width: 400px;
  max-width: 560px;
  width: 100%;
  max-height: 82vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.28);
}

.step-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--fs-border);
}
.step-dialog__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-dialog__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--fs-text-primary);
}
.step-dialog__kind-icon--job    { color: var(--fs-accent); }
.step-dialog__kind-icon--deploy { color: var(--fs-pos, #4caf50); }

.step-dialog__close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fs-text-muted);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s, background 0.15s;
}
.step-dialog__close:hover {
  color: var(--fs-text-primary);
  background: var(--fs-bg-hover);
}

.step-dialog__section {
  padding: 10px 16px 4px;
  border-bottom: 1px solid var(--fs-border);
}
.step-dialog__section:last-child { border-bottom: none; }

.step-dialog__section-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  margin-bottom: 6px;
}

.step-dialog__row {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: baseline;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid var(--fs-border);
}
.step-dialog__row:last-child { border-bottom: none; }

.step-dialog__label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
}
.step-dialog__value {
  font-size: 12.5px;
  color: var(--fs-text-primary);
  word-break: break-all;
}

/* Env overrides table */
.step-dialog__env-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-bottom: 6px;
}
.step-dialog__env-table th {
  text-align: left;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
  border-bottom: 1px solid var(--fs-border);
}
.step-dialog__env-table td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--fs-border);
  color: var(--fs-text-primary);
  vertical-align: middle;
}
.step-dialog__env-table tbody tr:last-child td { border-bottom: none; }
.step-dialog__env-table tbody tr:hover td { background: var(--fs-bg-hover); }

/* Template bar */
.step-dialog__tpl-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--fs-bg-surface);
  border-top: 2px solid var(--fs-border-bright);
  border-bottom: 1px solid var(--fs-border);
  position: sticky;
  top: 0;
  z-index: 1;
}
.step-dialog__tpl-bar-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fs-text-muted);
}
.step-dialog__tpl-bar-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--fs-text-primary);
  margin-left: 2px;
}
.tpl-icon--job    { color: var(--fs-accent); }
.tpl-icon--deploy { color: var(--fs-pos, #4caf50); }

.step-dialog__tpl-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  font-size: 12px;
  color: var(--fs-text-muted);
}
.step-dialog__tpl-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  font-size: 12px;
  color: var(--fs-neg, #e57373);
}
</style>
