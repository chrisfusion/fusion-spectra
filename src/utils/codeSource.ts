import type { WeaveCodeSourceSpec } from '@/api/weaveApi'

export interface CodeSourceModel {
  enabled:                boolean
  artifactName:           string
  tag:                    string
  mountPath:              string
  indexURL:                string
  loaderImage:             string
  loaderImagePullPolicy:   '' | 'Always' | 'Never' | 'IfNotPresent'
}

export function defaultCodeSourceModel(): CodeSourceModel {
  return {
    enabled: false, artifactName: '', tag: '',
    mountPath: '', indexURL: '', loaderImage: '', loaderImagePullPolicy: '',
  }
}

// Required-field check shared by every page that embeds CodeSourceFields.vue —
// artifactName/tag are only required once codeSource is enabled.
export function validateCodeSource(m: CodeSourceModel): string | null {
  if (!m.enabled) return null
  if (!m.artifactName.trim() || !m.tag.trim()) {
    return 'Artifact name and tag are required when code source is enabled'
  }
  return null
}

// Builds the spec fragment to attach as WeaveJobTemplateSpec['codeSource'] /
// WeaveServiceTemplateSpec['codeSource']; returns undefined when disabled so
// callers can omit the key entirely rather than sending an empty object.
export function buildCodeSourceSpec(m: CodeSourceModel): WeaveCodeSourceSpec | undefined {
  if (!m.enabled) return undefined
  return {
    artifactName: m.artifactName.trim(),
    tag:          m.tag.trim(),
    ...(m.mountPath.trim()   ? { mountPath:   m.mountPath.trim() }   : {}),
    ...(m.indexURL.trim()    ? { indexURL:    m.indexURL.trim() }    : {}),
    ...(m.loaderImage.trim() ? { loaderImage: m.loaderImage.trim() } : {}),
    ...(m.loaderImagePullPolicy ? { loaderImagePullPolicy: m.loaderImagePullPolicy } : {}),
  }
}
