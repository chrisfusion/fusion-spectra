<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import CanvasPanel from '@/components/CanvasPanel.vue'
import * as forgeApi from '@/api/forgeApi'

const route  = useRoute()
const router = useRouter()
const $q     = useQuasar()

const name = route.params.name as string

// ─── Load existing watcher ────────────────────────────────────────────────────

const loadError = ref<string | null>(null)
const loadingInitial = ref(true)

// ─── Form state ───────────────────────────────────────────────────────────────

type BuildType      = 'git' | 'app'
type MetadataSource = 'manual' | 'version' | 'full'

const buildType      = ref<BuildType>('git')
const repoUrl        = ref('')
const repoRef        = ref('')
const enabled        = ref(true)
const description    = ref('')
const metadataSource = ref<MetadataSource>('full')
const artifactName   = ref('')
const version        = ref('')
const pythonVersion  = ref<'3.12' | '3.10'>('3.12')
const entrypointFile = ref('')
const projectDir     = ref('')
const useTokenSecret    = ref(false)
const tokenSecretName   = ref('')
const tokenSecretKey    = ref('')

async function loadWatcher() {
  loadError.value = null
  try {
    const w = await forgeApi.getGitWatcher(name)
    const s = w.spec
    buildType.value      = s.buildType
    repoUrl.value        = s.repoURL
    repoRef.value        = s.repoRef ?? ''
    enabled.value        = s.enabled ?? true
    description.value    = s.description ?? ''
    metadataSource.value = (s.metadataSource as MetadataSource) ?? 'full'
    artifactName.value   = s.name ?? ''
    version.value        = s.version ?? ''
    pythonVersion.value  = (s.pythonVersion as '3.12' | '3.10') ?? '3.12'
    entrypointFile.value = s.entrypointFile ?? ''
    projectDir.value     = s.projectDir ?? ''
    if (s.tokenSecretRef) {
      useTokenSecret.value  = true
      tokenSecretName.value = s.tokenSecretRef.name
      tokenSecretKey.value  = s.tokenSecretRef.key
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load watcher'
  } finally {
    loadingInitial.value = false
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const repoUrlErr         = ref<string | null>(null)
const artifactNameErr    = ref<string | null>(null)
const versionErr         = ref<string | null>(null)
const projectDirErr      = ref<string | null>(null)
const tokenSecretNameErr = ref<string | null>(null)
const tokenSecretKeyErr  = ref<string | null>(null)

const URL_RE    = /^https?:\/\/.+/
const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/

function validate(): boolean {
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
      artifactNameErr.value = artifactName.value.trim() ? null : 'Artifact name is required'
      if (artifactNameErr.value) ok = false
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

  if (useTokenSecret.value) {
    tokenSecretNameErr.value = tokenSecretName.value.trim() ? null : 'Secret name is required'
    tokenSecretKeyErr.value  = tokenSecretKey.value.trim()  ? null : 'Secret key is required'
    if (tokenSecretNameErr.value || tokenSecretKeyErr.value) ok = false
  } else {
    tokenSecretNameErr.value = null
    tokenSecretKeyErr.value  = null
  }

  return ok
}

// ─── Submit ───────────────────────────────────────────────────────────────────

const submitting  = ref(false)
const submitError = ref<string | null>(null)

function buildPayload(): forgeApi.UpdateGitWatcherPayload {
  const p: forgeApi.UpdateGitWatcherPayload = {
    repo_url:   repoUrl.value.trim(),
    build_type: buildType.value,
    enabled:    enabled.value,
  }
  if (repoRef.value.trim())    p.repo_ref    = repoRef.value.trim()
  if (description.value.trim()) p.description = description.value.trim()
  if (projectDir.value.trim()) p.project_dir = projectDir.value.trim()

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
  if (!validate()) return
  submitting.value  = true
  submitError.value = null
  try {
    await forgeApi.updateGitWatcher(name, buildPayload())
    $q.notify({ type: 'positive', message: `Watcher ${name} updated.` })
    router.push(`/forge/gitwatchers/${encodeURIComponent(name)}`)
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Save failed'
  } finally {
    submitting.value = false
  }
}

const META_LABEL: Record<MetadataSource, string> = {
  manual:  'Manual (name + version provided)',
  version: 'From pyproject.toml (version only)',
  full:    'From pyproject.toml (name + version)',
}

onMounted(loadWatcher)
</script>

<template>
  <div class="page-grid">

    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <button class="breadcrumb__back" @click="router.push(`/forge/gitwatchers/${encodeURIComponent(name)}`)">
        <q-icon name="mdi-arrow-left" size="14px" />
        <span class="fs-mono">{{ name }}</span>
      </button>
      <q-icon name="mdi-chevron-right" size="14px" class="muted-icon" />
      <span class="breadcrumb__current">Edit</span>
    </div>

    <CanvasPanel
      title="Edit Watcher"
      icon="mdi-pencil-outline"
      :wide="true"
      :loading="loadingInitial"
      :error="loadError ?? undefined"
      @refresh="loadWatcher"
    >
      <div v-if="!loadingInitial && !loadError" class="form-body">

        <!-- Immutable name notice -->
        <div class="form-note">
          <q-icon name="mdi-lock-outline" size="13px" />
          <span>Name <span class="fs-mono">{{ name }}</span> is immutable in Kubernetes — delete and recreate to rename.</span>
        </div>

        <div class="form-section-title">Build Type</div>

        <div class="form-row form-row--top">
          <label class="form-label">Build Type <span class="required">*</span></label>
          <div class="field-wrap">
            <div class="kind-toggle">
              <button class="kind-btn" :class="{ 'kind-btn--active': buildType === 'git' }" @click="buildType = 'git'">
                <q-icon name="mdi-git" size="12px" /> Git Build
              </button>
              <button class="kind-btn" :class="{ 'kind-btn--active': buildType === 'app' }" @click="buildType = 'app'">
                <q-icon name="mdi-rocket-launch-outline" size="12px" /> App Build
              </button>
            </div>
          </div>
        </div>

        <div class="form-section-title">Repository</div>

        <div class="form-row">
          <label class="form-label">Repo URL <span class="required">*</span></label>
          <div class="field-wrap">
            <input v-model="repoUrl" class="fs-input fs-mono" :class="{ 'fs-input--error': repoUrlErr }" placeholder="https://github.com/org/repo" />
            <span v-if="repoUrlErr" class="field-error">{{ repoUrlErr }}</span>
            <span v-else class="field-hint">HTTPS git URL</span>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">Ref</label>
          <div class="field-wrap">
            <input v-model="repoRef" class="fs-input fs-mono" placeholder="main" />
            <span class="field-hint">Branch or tag (default: main)</span>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">Project Dir</label>
          <div class="field-wrap">
            <input v-model="projectDir" class="fs-input fs-mono" :class="{ 'fs-input--error': projectDirErr }" placeholder="services/myapp" />
            <span v-if="projectDirErr" class="field-error">{{ projectDirErr }}</span>
            <span v-else class="field-hint">Monorepo subdirectory — relative path, no ..</span>
          </div>
        </div>

        <template v-if="buildType === 'git'">
          <div class="form-section-title">Metadata</div>

          <div class="form-row form-row--top">
            <label class="form-label">Source <span class="required">*</span></label>
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
              <input v-model="artifactName" class="fs-input fs-mono" :class="{ 'fs-input--error': artifactNameErr }" placeholder="my-package" />
              <span v-if="artifactNameErr" class="field-error">{{ artifactNameErr }}</span>
            </div>
          </div>

          <div v-if="metadataSource === 'manual'" class="form-row">
            <label class="form-label">Version <span class="required">*</span></label>
            <div class="field-wrap">
              <input v-model="version" class="fs-input fs-mono" :class="{ 'fs-input--error': versionErr }" placeholder="1.0.0" />
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
              <input v-model="entrypointFile" class="fs-input fs-mono" placeholder="main.py" />
              <span class="field-hint">Optional Python entrypoint filename at project root</span>
            </div>
          </div>
        </template>

        <div class="form-section-title">Options</div>

        <div class="form-row form-row--top">
          <label class="form-label">Description</label>
          <textarea v-model="description" class="fs-input fs-textarea" placeholder="Optional description" rows="2" />
        </div>

        <div class="form-row">
          <label class="form-label">Enabled</label>
          <div class="field-wrap">
            <label class="toggle-label">
              <input type="checkbox" v-model="enabled" class="toggle-input" />
              <span class="toggle-track"><span class="toggle-knob" /></span>
              <span class="toggle-text">{{ enabled ? 'Active — will poll on save' : 'Disabled — will not poll' }}</span>
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
            <label class="form-label">Secret Name <span class="required">*</span></label>
            <div class="field-wrap">
              <input v-model="tokenSecretName" class="fs-input fs-mono" :class="{ 'fs-input--error': tokenSecretNameErr }" placeholder="my-repo-token" />
              <span v-if="tokenSecretNameErr" class="field-error">{{ tokenSecretNameErr }}</span>
              <span v-else class="field-hint">Name of an existing K8s Secret in the fusion namespace</span>
            </div>
          </div>
          <div class="form-row">
            <label class="form-label">Secret Key <span class="required">*</span></label>
            <div class="field-wrap">
              <input v-model="tokenSecretKey" class="fs-input fs-mono" :class="{ 'fs-input--error': tokenSecretKeyErr }" placeholder="token" />
              <span v-if="tokenSecretKeyErr" class="field-error">{{ tokenSecretKeyErr }}</span>
              <span v-else class="field-hint">Key within the secret that holds the git token</span>
            </div>
          </div>
        </template>

        <div v-if="submitError" class="inline-msg inline-msg--error">
          <q-icon name="mdi-alert-circle-outline" size="13px" />
          {{ submitError }}
        </div>

        <div class="form-actions">
          <button class="fs-btn fs-btn--ghost" :disabled="submitting" @click="router.push(`/forge/gitwatchers/${encodeURIComponent(name)}`)">
            Cancel
          </button>
          <button class="fs-btn fs-btn--primary" :disabled="submitting" @click="submit">
            <q-spinner v-if="submitting" size="13px" color="white" />
            <q-icon v-else name="mdi-content-save-outline" size="14px" />
            {{ submitting ? 'Saving…' : 'Save Changes' }}
          </button>
        </div>

      </div>
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
  display: flex; align-items: center; gap: 6px; padding-bottom: 4px;
}
.breadcrumb__back {
  display: flex; align-items: center; gap: 5px;
  background: none; border: none; padding: 4px 8px; border-radius: 4px;
  cursor: pointer; color: var(--fs-text-muted); font-size: 12px; font-family: inherit;
  transition: color var(--fs-ease), background var(--fs-ease);
}
.breadcrumb__back:hover { color: var(--fs-text-primary); background: var(--fs-bg-hover); }
.breadcrumb__current { font-size: 12px; color: var(--fs-accent); font-weight: 500; }
.muted-icon { color: var(--fs-text-muted); }
.fs-mono { font-family: var(--fs-font-mono); }

.form-body { display: flex; flex-direction: column; gap: 16px; padding: 0 10px 10px; }

.form-section-title {
  font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--fs-accent); padding-top: 8px; border-bottom: 1px solid var(--fs-border); padding-bottom: 4px;
}

.form-row { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 12px; }
.form-row--top { align-items: start; }
.form-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fs-text-muted); padding-top: 8px; }
.required { color: var(--fs-neg, #e57373); }

.field-wrap { display: flex; flex-direction: column; gap: 4px; }
.field-error { font-size: 11px; color: var(--fs-neg, #e57373); }
.field-hint  { font-size: 11px; color: var(--fs-text-muted); }

.fs-input {
  width: 100%; background: var(--fs-bg-input, var(--fs-bg-hover)); border: 1px solid var(--fs-border);
  border-radius: 4px; padding: 7px 10px; font-size: 12.5px; font-family: inherit;
  color: var(--fs-text-primary); outline: none; transition: border-color var(--fs-ease); box-sizing: border-box;
}
.fs-input:focus  { border-color: var(--fs-accent); }
.fs-input--error { border-color: var(--fs-neg, #e57373); }
.fs-textarea     { resize: vertical; min-height: 60px; }

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
</style>
