{{/*
Standard Helm labels applied to every resource.
*/}}
{{- define "fusion-spectra.labels" -}}
app.kubernetes.io/name: fusion-spectra
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}
