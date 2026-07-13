<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CanvasPanel from '@/components/CanvasPanel.vue'
import SecretNamePicker from '@/components/SecretNamePicker.vue'
import * as forgeApi from '@/api/forgeApi'

const router = useRouter()

// ─── Wizard state ──────────────────────────────────────────────────────────────

const step       = ref<1 | 2 | 3>(1)
const stepLabels = ['Build', 'GitOps Polling', 'Review & Submit'] as const

// ─── Step 1: Build config ──────────────────────────────────────────────────────

type BuildType      = 'git' | 'app'
type MetadataSource = 'manual' | 'version' | 'full'

const buildType      = ref<BuildType>('git')
const repoUrl        = ref('')
const repoRef        = ref('')
const projectDir     = ref('')

// Python Builder specific
const metadataSource = ref<MetadataSource>('full')
const artifactName   = ref('')
const version        = ref('')
const pythonVersion  = ref<'3.12' | '3.10'>('3.12')
const entrypointFile = ref('')

const repoUrlErr      = ref<string | null>(null)
const artifactNameErr = ref<string | null>(null)
const versionErr      = ref<string | null>(null)
const projectDirErr   = ref<string | null>(null)

const URL_RE    = /^https?:\/\/.+/
const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/

function validateStep1(): boolean {
  let ok = true

  if (!repoUrl.value.trim()) {
    repoUrlErr.value = 'Repository URL is required'
    ok = false
  } else if (!URL_RE.test(repoUrl.value.trim())) {
    repoUrlErr.value = 'Must be an HTTPS URL'
    ok = false
  } else {
    repoUrlErr.value = null
  }

  if (buildType.value === 'git') {
    if (metadataSource.value !== 'full') {
      if (!artifactName.value.trim()) {
        artifactNameErr.value = 'Artifact name is required'
        ok = false
      } else {
        artifactNameErr.value = null
      }
    } else {
      artifactNameErr.value = null
    }
    if (metadataSource.value === 'manual') {
      if (!version.value.trim()) {
        versionErr.value = 'Version is required'
        ok = false
      } else if (!SEMVER_RE.test(version.value.trim())) {
        versionErr.value = 'Must be semver: 1.0.0'
        ok = false
      } else {
        versionErr.value = null
      }
    } else {
      versionErr.value = null
    }
  } else {
    artifactNameErr.value = null
    versionErr.value      = null
  }

  if (projectDir.value.trim()) {
    if (projectDir.value.trim().startsWith('/') || projectDir.value.includes('..')) {
      projectDirErr.value = 'Must be a relative path without ..'
      ok = false
    } else {
      projectDirErr.value = null
    }
  } else {
    projectDirErr.value = null
  }

  return ok
}

// ─── Step 2: GitOps Polling ────────────────────────────────────────────────────

const gitopsPolling   = ref(false)
const watcherName     = ref('')
const watcherDesc     = ref('')
const watcherEnabled  = ref(true)
const useTokenSecret  = ref(false)
const tokenSecretName = ref('')
const tokenSecretKey  = ref('')

const DNS_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

const nameErr            = ref<string | null>(null)
const tokenSecretNameErr = ref<string | null>(null)
const tokenSecretKeyErr  = ref<string | null>(null)

function validateStep2(): boolean {
  if (!gitopsPolling.value) return true
  let ok = true

  if (!watcherName.value.trim()) {
    nameErr.value = 'Name is required'
    ok = false
  } else if (!DNS_NAME_RE.test(watcherName.value.trim())) {
    nameErr.value = 'Must be lowercase alphanumeric + hyphens, no leading/trailing hyphen'
    ok = false
  } else if (watcherName.value.trim().length > 253) {
    nameErr.value = 'Max 253 characters'
    ok = false
  } else {
    nameErr.value = null
  }

  if (useTokenSecret.value) {
    if (!tokenSecretName.value.trim()) {
      tokenSecretNameErr.value = 'Secret name is required'
      ok = false
    } else {
      tokenSecretNameErr.value = null
    }
    if (!tokenSecretKey.value.trim()) {
      tokenSecretKeyErr.value = 'Secret key is required'
      ok = false
    } else {
      tokenSecretKeyErr.value = null
    }
  } else {
    tokenSecretNameErr.value = null
    tokenSecretKeyErr.value  = null
  }

  return ok
}

function goToStep2() { if (validateStep1()) step.value = 2 }
function goToStep3() { if (validateStep2()) step.value = 3 }

// ─── Submit ────────────────────────────────────────────────────────────────────

const submitting     = ref(false)
const submitError    = ref<string | null>(null)
const createdBuild   = ref<forgeApi.GitBuild | forgeApi.AppBuild | null>(null)
const createdWatcher = ref<forgeApi.GitWatcher | null>(null)

const META_LABEL: Record<MetadataSource, string> = {
  manual:  'Manual (name + version provided)',
  version: 'From pyproject.toml (version only)',
  full:    'From pyproject.toml (name + version)',
}

function buildGitPayload(): forgeApi.GitBuildPayload {
  const p: forgeApi.GitBuildPayload = {
    repo_url:        repoUrl.value.trim(),
    metadata_source: metadataSource.value,
  }
  if (metadataSource.value !== 'full')   p.name    = artifactName.value.trim()
  if (metadataSource.value === 'manual') p.version = version.value.trim()
  if (repoRef.value.trim())        p.repo_ref        = repoRef.value.trim()
  if (entrypointFile.value.trim()) p.entrypoint_file = entrypointFile.value.trim()
  if (projectDir.value.trim())     p.project_dir     = projectDir.value.trim()
  p.python_version = pythonVersion.value
  return p
}

function buildAppPayload(): forgeApi.AppBuildPayload {
  const p: forgeApi.AppBuildPayload = { repo_url: repoUrl.value.trim() }
  if (repoRef.value.trim())    p.repo_ref    = repoRef.value.trim()
  if (projectDir.value.trim()) p.project_dir = projectDir.value.trim()
  return p
}

function buildWatcherPayload(): forgeApi.CreateGitWatcherPayload {
  const p: forgeApi.CreateGitWatcherPayload = {
    name:       watcherName.value.trim(),
    repo_url:   repoUrl.value.trim(),
    build_type: buildType.value,
    enabled:    watcherEnabled.value,
  }
  if (repoRef.value.trim())     p.repo_ref    = repoRef.value.trim()
  if (watcherDesc.value.trim()) p.description = watcherDesc.value.trim()
  if (projectDir.value.trim())  p.project_dir = projectDir.value.trim()

  if (buildType.value === 'git') {
    p.metadata_source = metadataSource.value
    if (metadataSource.value !== 'full')   p.artifact_name   = artifactName.value.trim()
    if (metadataSource.value === 'manual') p.version         = version.value.trim()
    p.python_version = pythonVersion.value
    if (entrypointFile.value.trim()) p.entrypoint_file = entrypointFile.value.trim()
  }

  if (useTokenSecret.value && tokenSecretName.value.trim() && tokenSecretKey.value.trim()) {
    p.token_secret_ref = { name: tokenSecretName.value.trim(), key: tokenSecretKey.value.trim() }
  }
  return p
}

async function submit() {
  submitting.value  = true
  submitError.value = null
  try {
    if (gitopsPolling.value) {
      createdWatcher.value = await forgeApi.createGitWatcher(buildWatcherPayload())
    } else if (buildType.value === 'git') {
      createdBuild.value = await forgeApi.createGitBuild(buildGitPayload())
    } else {
      createdBuild.value = await forgeApi.createAppBuild(buildAppPayload())
    }
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Submission failed'
  } finally {
    submitting.value = false
  }
}

function reset() {
  step.value           = 1
  buildType.value      = 'git'
  repoUrl.value        = ''
  repoRef.value        = ''
  projectDir.value     = ''
  metadataSource.value = 'full'
  artifactName.value   = ''
  version.value        = ''
  pythonVersion.value  = '3.12'
  entrypointFile.value = ''
  gitopsPolling.value  = false
  watcherName.value    = ''
  watcherDesc.value    = ''
  watcherEnabled.value = true
  useTokenSecret.value = false
  tokenSecretName.value = ''
  tokenSecretKey.value  = ''
  submitError.value    = null
  createdBuild.value   = null
  createdWatcher.value = null
}
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push('/forge/venvs')">
        <q-icon name="mdi-arrow-left" size="14px" />
        Build Overview
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">GitOps Builder</span>
    </div>

    <CanvasPanel title="GitOps Builder" icon="mdi-source-branch-plus" :wide="true">

      <!-- ── Success: build created ── -->
      <div v-if="createdBuild" class="success-body">
        <q-icon name="mdi-check-circle-outline" size="48px" class="success-icon" />
        <p class="success-title">Build submitted</p>
        <p class="success-sub">
          Build #{{ createdBuild.id }} is queued.
        </p>
        <div class="success-actions">
          <button class="fs-btn fs-btn--ghost" @click="router.push('/forge/venvs')">
            <q-icon name="mdi-list-box-outline" size="14px" />
            View Builds
          </button>
          <button class="fs-btn fs-btn--primary" @click="reset">
            <q-icon name="mdi-plus" size="14px" />
            Build Another
          </button>
        </div>
      </div>

      <!-- ── Success: watcher created ── -->
      <div v-else-if="createdWatcher" class="success-body">
        <q-icon name="mdi-check-circle-outline" size="48px" class="success-icon" />
        <p class="success-title">GitOps Poller created</p>
        <p class="success-sub">
          <span class="fs-mono">{{ createdWatcher.name }}</span>
          is now polling <span class="fs-mono">{{ createdWatcher.spec.repoRef || 'main' }}</span>
          on <span class="fs-mono">{{ createdWatcher.spec.repoURL }}</span>.
        </p>
        <div class="success-actions">
          <button class="fs-btn fs-btn--ghost" @click="router.push(`/forge/gitwatchers/${encodeURIComponent(createdWatcher.name)}`)">
            <q-icon name="mdi-eye-outline" size="14px" />
            View Poller
          </button>
          <button class="fs-btn fs-btn--primary" @click="reset">
            <q-icon name="mdi-plus" size="14px" />
            Build Another
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

        <!-- ══ Step 1: Build ══ -->
        <div v-if="step === 1" class="form-body">

          <div class="form-section-title">Builder Type</div>

          <div class="form-row form-row--top">
            <label class="form-label">Type <span class="required">*</span></label>
            <div class="field-wrap">
              <div class="kind-toggle">
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': buildType === 'git' }"
                  @click="buildType = 'git'"
                >
                  <q-icon name="mdi-language-python" size="12px" /> Python Builder
                </button>
                <button
                  class="kind-btn"
                  :class="{ 'kind-btn--active': buildType === 'app' }"
                  @click="buildType = 'app'"
                >
                  <q-icon name="mdi-rocket-launch-outline" size="12px" /> Generic Builder
                </button>
              </div>
              <span class="field-hint">
                <template v-if="buildType === 'git'">Builds a Python venv from a git repository using pyproject.toml</template>
                <template v-else>Builds a packaged app from a repository containing metadata.yaml</template>
              </span>
            </div>
          </div>

          <div class="form-section-title">Repository</div>

          <div class="form-row">
            <label class="form-label">Repo URL <span class="required">*</span></label>
            <div class="field-wrap">
              <input
                v-model="repoUrl"
                class="fs-input fs-mono"
                :class="{ 'fs-input--error': repoUrlErr }"
                placeholder="https://github.com/org/repo"
              />
              <span v-if="repoUrlErr" class="field-error">{{ repoUrlErr }}</span>
              <span v-else class="field-hint">HTTPS git URL</span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Ref</label>
            <div class="field-wrap">
              <input
                v-model="repoRef"
                class="fs-input fs-mono"
                placeholder="main"
              />
              <span class="field-hint">Branch or tag (default: main)</span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Project Dir</label>
            <div class="field-wrap">
              <input
                v-model="projectDir"
                class="fs-input fs-mono"
                :class="{ 'fs-input--error': projectDirErr }"
                placeholder="services/myapp"
              />
              <span v-if="projectDirErr" class="field-error">{{ projectDirErr }}</span>
              <span v-else class="field-hint">Monorepo subdirectory — relative path, no .. (optional)</span>
            </div>
          </div>

          <!-- Python Builder specific -->
          <template v-if="buildType === 'git'">

            <div class="form-section-title">Python Build</div>

            <div class="form-row form-row--top">
              <label class="form-label">Metadata <span class="required">*</span></label>
              <div class="field-wrap">
                <div class="kind-toggle">
                  <button class="kind-btn" :class="{ 'kind-btn--active': metadataSource === 'full' }"    @click="metadataSource = 'full'">From pyproject (full)</button>
                  <button class="kind-btn" :class="{ 'kind-btn--active': metadataSource === 'version' }" @click="metadataSource = 'version'">From pyproject (version)</button>
                  <button class="kind-btn" :class="{ 'kind-btn--active': metadataSource === 'manual' }"  @click="metadataSource = 'manual'">Manual</button>
                </div>
                <span class="field-hint">{{ META_LABEL[metadataSource] }}</span>
              </div>
            </div>

            <div v-if="metadataSource !== 'full'" class="form-row">
              <label class="form-label">Artifact Name <span class="required">*</span></label>
              <div class="field-wrap">
                <input
                  v-model="artifactName"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': artifactNameErr }"
                  placeholder="my-package"
                />
                <span v-if="artifactNameErr" class="field-error">{{ artifactNameErr }}</span>
              </div>
            </div>

            <div v-if="metadataSource === 'manual'" class="form-row">
              <label class="form-label">Version <span class="required">*</span></label>
              <div class="field-wrap">
                <input
                  v-model="version"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': versionErr }"
                  placeholder="1.0.0"
                />
                <span v-if="versionErr" class="field-error">{{ versionErr }}</span>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Python</label>
              <div class="py-toggle">
                <button class="py-toggle__btn" :class="{ 'py-toggle__btn--active': pythonVersion === '3.12' }" @click="pythonVersion = '3.12'">3.12</button>
                <button class="py-toggle__btn" :class="{ 'py-toggle__btn--active': pythonVersion === '3.10' }" @click="pythonVersion = '3.10'">3.10</button>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Entrypoint</label>
              <div class="field-wrap">
                <input
                  v-model="entrypointFile"
                  class="fs-input fs-mono"
                  placeholder="main.py"
                />
                <span class="field-hint">Optional Python entrypoint filename at project root</span>
              </div>
            </div>

          </template>

          <!-- Generic Builder note -->
          <div v-else class="form-note">
            <q-icon name="mdi-information-outline" size="13px" />
            Name, version, runner, and builder image are resolved from <span class="fs-mono">metadata.yaml</span> in the repository.
          </div>

          <div class="form-actions">
            <button class="fs-btn fs-btn--primary" @click="goToStep2">
              Next <q-icon name="mdi-arrow-right" size="14px" />
            </button>
          </div>

        </div>

        <!-- ══ Step 2: GitOps Polling ══ -->
        <div v-else-if="step === 2" class="form-body">

          <div class="form-section-title">GitOps Polling</div>

          <div class="form-row">
            <label class="form-label">Enable Polling</label>
            <div class="field-wrap">
              <label class="toggle-label">
                <input type="checkbox" v-model="gitopsPolling" class="toggle-input" />
                <span class="toggle-track"><span class="toggle-knob" /></span>
                <span class="toggle-text">
                  {{ gitopsPolling ? 'Enabled — repository will be polled for changes' : 'Disabled — one-off build only' }}
                </span>
              </label>
            </div>
          </div>

          <template v-if="gitopsPolling">

            <div class="form-section-title">Poller Configuration</div>

            <div class="form-row">
              <label class="form-label">Name <span class="required">*</span></label>
              <div class="field-wrap">
                <input
                  v-model="watcherName"
                  class="fs-input fs-mono"
                  :class="{ 'fs-input--error': nameErr }"
                  placeholder="my-lib-poller"
                />
                <span v-if="nameErr" class="field-error">{{ nameErr }}</span>
                <span v-else class="field-hint">Kubernetes resource name — lowercase, hyphens allowed</span>
              </div>
            </div>

            <div class="form-row form-row--top">
              <label class="form-label">Description</label>
              <textarea
                v-model="watcherDesc"
                class="fs-input fs-textarea"
                placeholder="Optional description"
                rows="2"
              />
            </div>

            <div class="form-row">
              <label class="form-label">Active</label>
              <div class="field-wrap">
                <label class="toggle-label">
                  <input type="checkbox" v-model="watcherEnabled" class="toggle-input" />
                  <span class="toggle-track"><span class="toggle-knob" /></span>
                  <span class="toggle-text">{{ watcherEnabled ? 'Active — will poll on save' : 'Disabled — will not poll' }}</span>
                </label>
              </div>
            </div>

            <div class="form-section-title">Private Repository (optional)</div>

            <div class="form-row">
              <label class="form-label">Token Secret</label>
              <div class="field-wrap">
                <label class="toggle-label">
                  <input type="checkbox" v-model="useTokenSecret" class="toggle-input" />
                  <span class="toggle-track"><span class="toggle-knob" /></span>
                  <span class="toggle-text">Use a Kubernetes Secret for authentication</span>
                </label>
              </div>
            </div>

            <template v-if="useTokenSecret">
              <div class="form-row">
                <label class="form-label">Secret <span class="required">*</span></label>
                <div class="field-wrap">
                  <SecretNamePicker
                    v-model:secret-name="tokenSecretName"
                    v-model:secret-key="tokenSecretKey"
                    show-key
                    name-placeholder="my-repo-token"
                    key-placeholder="token"
                  />
                  <span v-if="tokenSecretNameErr" class="field-error">{{ tokenSecretNameErr }}</span>
                  <span v-else-if="tokenSecretKeyErr" class="field-error">{{ tokenSecretKeyErr }}</span>
                  <span v-else class="field-hint">Name of an existing K8s Secret in the fusion namespace, and the key within it that holds the git token</span>
                </div>
              </div>
            </template>

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

        <!-- ══ Step 3: Review & Submit ══ -->
        <div v-else class="form-body">

          <div class="form-section-title">Build</div>
          <div class="review-table">
            <div class="review-row">
              <span class="review-key">Type</span>
              <span class="review-val">{{ buildType === 'git' ? 'Python Builder' : 'Generic Builder' }}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Repo URL</span>
              <span class="review-val fs-mono">{{ repoUrl }}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Ref</span>
              <span class="review-val fs-mono">{{ repoRef || 'main' }}</span>
            </div>
            <div v-if="projectDir" class="review-row">
              <span class="review-key">Project Dir</span>
              <span class="review-val fs-mono">{{ projectDir }}</span>
            </div>
            <template v-if="buildType === 'git'">
              <div class="review-row">
                <span class="review-key">Metadata</span>
                <span class="review-val">{{ META_LABEL[metadataSource] }}</span>
              </div>
              <div v-if="metadataSource !== 'full'" class="review-row">
                <span class="review-key">Artifact Name</span>
                <span class="review-val fs-mono">{{ artifactName }}</span>
              </div>
              <div v-if="metadataSource === 'manual'" class="review-row">
                <span class="review-key">Version</span>
                <span class="review-val fs-mono">{{ version }}</span>
              </div>
              <div class="review-row">
                <span class="review-key">Python</span>
                <span class="review-val fs-mono">{{ pythonVersion }}</span>
              </div>
              <div v-if="entrypointFile" class="review-row">
                <span class="review-key">Entrypoint</span>
                <span class="review-val fs-mono">{{ entrypointFile }}</span>
              </div>
            </template>
            <div v-else class="review-row">
              <span class="review-key">Metadata</span>
              <span class="review-val" style="color: var(--fs-text-muted); font-style: italic;">from metadata.yaml in repository</span>
            </div>
          </div>

          <div class="form-section-title">GitOps Polling</div>
          <div class="review-table">
            <div class="review-row">
              <span class="review-key">Polling</span>
              <span class="review-val">{{ gitopsPolling ? 'Enabled' : 'Disabled — one-off build' }}</span>
            </div>
            <template v-if="gitopsPolling">
              <div class="review-row">
                <span class="review-key">Poller Name</span>
                <span class="review-val fs-mono">{{ watcherName }}</span>
              </div>
              <div v-if="watcherDesc" class="review-row">
                <span class="review-key">Description</span>
                <span class="review-val">{{ watcherDesc }}</span>
              </div>
              <div class="review-row">
                <span class="review-key">Active</span>
                <span class="review-val">{{ watcherEnabled ? 'Yes' : 'No (disabled)' }}</span>
              </div>
              <div v-if="useTokenSecret" class="review-row">
                <span class="review-key">Token Secret</span>
                <span class="review-val fs-mono">{{ tokenSecretName }} / {{ tokenSecretKey }}</span>
              </div>
            </template>
          </div>

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
              <q-icon v-else name="mdi-send-outline" size="14px" />
              {{ submitting ? 'Submitting…' : (gitopsPolling ? 'Create Poller' : 'Submit Build') }}
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

/* Wizard step indicator */
.wizard-steps { display: flex; align-items: center; padding: 16px 10px 24px; }
.wizard-step  { display: flex; align-items: center; gap: 8px; flex: 1; }
.wizard-step:last-child { flex: none; }
.wizard-step__dot {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; flex-shrink: 0;
  border: 1.5px solid var(--fs-border);
  color: var(--fs-text-muted);
  background: var(--fs-bg-elevated);
  transition: border-color var(--fs-ease), background var(--fs-ease), color var(--fs-ease);
}
.wizard-step--active .wizard-step__dot { border-color: var(--fs-accent); background: var(--fs-accent); color: #fff; }
.wizard-step--done   .wizard-step__dot { border-color: var(--fs-pos, #4caf50); background: var(--fs-pos, #4caf50); color: #fff; }
.wizard-step__label { font-size: 11.5px; font-weight: 500; color: var(--fs-text-muted); white-space: nowrap; transition: color var(--fs-ease); }
.wizard-step--active .wizard-step__label,
.wizard-step--done   .wizard-step__label { color: var(--fs-text-primary); }
.wizard-step__line { flex: 1; height: 1px; background: var(--fs-border); margin: 0 8px; }

/* Form layout */
.form-body { display: flex; flex-direction: column; gap: 16px; padding: 0 10px 10px; }

.form-section-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fs-accent);
  padding-top: 8px;
  border-bottom: 1px solid var(--fs-border);
  padding-bottom: 4px;
}

.form-row { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 12px; }
.form-row--top { align-items: start; }
.form-label {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fs-text-muted); padding-top: 8px;
}
.required { color: var(--fs-neg, #e57373); }

.field-wrap { display: flex; flex-direction: column; gap: 4px; }
.field-error { font-size: 11px; color: var(--fs-neg, #e57373); }
.field-hint  { font-size: 11px; color: var(--fs-text-muted); }

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
.fs-textarea     { resize: vertical; min-height: 60px; }
.fs-mono         { font-family: var(--fs-font-mono); }

.kind-toggle { display: flex; border: 1px solid var(--fs-border); border-radius: 4px; overflow: hidden; width: fit-content; }
.kind-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px; font-size: 12px; font-family: inherit; font-weight: 500;
  cursor: pointer; background: var(--fs-bg-hover); border: none;
  border-right: 1px solid var(--fs-border); color: var(--fs-text-muted);
  transition: background var(--fs-ease), color var(--fs-ease);
}
.kind-btn:last-child { border-right: none; }
.kind-btn:hover { color: var(--fs-text-primary); }
.kind-btn--active { background: var(--fs-accent); color: #fff; }

.py-toggle { display: inline-flex; border: 1px solid var(--fs-border); border-radius: 4px; overflow: hidden; }
.py-toggle__btn { padding: 6px 14px; font-size: 12.5px; font-family: var(--fs-font-mono); font-weight: 500; background: none; border: none; cursor: pointer; color: var(--fs-text-muted); transition: background var(--fs-ease), color var(--fs-ease); }
.py-toggle__btn + .py-toggle__btn { border-left: 1px solid var(--fs-border); }
.py-toggle__btn--active { background: var(--fs-accent); color: #fff; }
.py-toggle__btn:not(.py-toggle__btn--active):hover { background: var(--fs-bg-hover); color: var(--fs-text-primary); }

.toggle-label { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
.toggle-input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-track { position: relative; width: 34px; height: 18px; border-radius: 9px; background: var(--fs-border); transition: background var(--fs-ease); flex-shrink: 0; }
.toggle-input:checked + .toggle-track { background: var(--fs-accent); }
.toggle-knob { position: absolute; top: 3px; left: 3px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform var(--fs-ease); }
.toggle-input:checked + .toggle-track .toggle-knob { transform: translateX(16px); }
.toggle-text { font-size: 12.5px; color: var(--fs-text-primary); }

.form-note {
  display: flex; align-items: flex-start; gap: 6px;
  font-size: 11.5px; color: var(--fs-text-muted);
  background: var(--fs-bg-hover); border: 1px solid var(--fs-border);
  border-radius: 4px; padding: 8px 12px; line-height: 1.5;
}

.review-table { border: 1px solid var(--fs-border); border-radius: 5px; overflow: hidden; margin-bottom: 4px; }
.review-row { display: grid; grid-template-columns: 140px 1fr; gap: 12px; padding: 8px 14px; border-bottom: 1px solid var(--fs-border); font-size: 12.5px; }
.review-row:last-child { border-bottom: none; }
.review-key { font-size: 10.5px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--fs-text-muted); padding-top: 1px; }
.review-val { color: var(--fs-text-primary); word-break: break-all; }

.inline-msg { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 8px 10px; border-radius: 4px; }
.inline-msg--error { color: var(--fs-neg, #e57373); background: color-mix(in srgb, var(--fs-neg, #e57373) 10%, transparent); }

.form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

.fs-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px;
  border-radius: 4px; font-size: 12.5px; font-family: inherit; font-weight: 500;
  cursor: pointer; border: 1px solid transparent;
  transition: background var(--fs-ease), border-color var(--fs-ease), color var(--fs-ease), filter var(--fs-ease);
}
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
