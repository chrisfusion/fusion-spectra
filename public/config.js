// Runtime configuration — overridden by ConfigMap mount in Kubernetes
window.FUSION_CONFIG = {
  bffUrl: 'http://bff.fusion.local',
  extBffDownloadPattern: 'http://ext-bff.fusion.local/api/index/api/v1/artifacts/{artifactId}/versions/{semver}/files/{fileId}/download',
  extBffPublicPattern:   'http://ext-bff.fusion.local/api/public/index/api/v1/artifacts/{artifactId}/versions/{semver}/files/{fileId}/download',
  extBffPublicTag:       'public',
}
