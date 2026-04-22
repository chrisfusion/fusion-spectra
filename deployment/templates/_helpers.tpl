{{/*
App name.
*/}}
{{- define "fusion-spectra.name" -}}
fusion-spectra
{{- end }}

{{/*
Standard Helm labels applied to every resource.
*/}}
{{- define "fusion-spectra.labels" -}}
app.kubernetes.io/name: {{ include "fusion-spectra.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}

{{/*
Selector labels — used by Service and Deployment.matchLabels.
*/}}
{{- define "fusion-spectra.selectorLabels" -}}
app.kubernetes.io/name: {{ include "fusion-spectra.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Resolved image tag — falls back to Chart.AppVersion when tag is empty.
*/}}
{{- define "fusion-spectra.imageTag" -}}
{{- .Values.image.tag | default .Chart.AppVersion }}
{{- end }}
