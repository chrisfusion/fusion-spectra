# fusion-spectra — Installation Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 | Dev server only |
| Docker | 24+ | Image build |
| Helm | 3.12+ | Chart deployment |
| kubectl | 1.28+ | Cluster access |
| minikube | 1.32+ | Local dev only |

---

## Development (minikube)

### 1. Start minikube and enable ingress

```bash
minikube start
minikube addons enable ingress
```

### 2. Add /etc/hosts entries

Two sets of entries are required:

```bash
# minikube-hosted services (frontend + BFF ingress)
echo "$(minikube ip)  spectra.fusion.local bff.fusion.local" | sudo tee -a /etc/hosts

# local dev server (must use a named host — localhost breaks SameSite=Lax cookies)
echo "127.0.0.1  dev.fusion.local" | sudo tee -a /etc/hosts
```

| Host | Purpose |
|------|---------|
| `spectra.fusion.local` | Deployed frontend (minikube ingress) |
| `bff.fusion.local` | BFF session cookie domain (minikube ingress) |
| `dev.fusion.local` | Vite dev server — must NOT be `localhost` |

### 3. Run the dev server (hot reload)

```bash
npm install
npm run dev
# → http://dev.fusion.local:5174
```

The BFF is accessed via `http://bff.fusion.local` (minikube). The dev server proxies nothing — API calls go directly from the browser to the BFF, which is why the `bff.fusion.local` cookie domain must resolve.

### 4. Build and load image into minikube

```bash
eval $(minikube docker-env)
docker build -t fusion-spectra:latest .
```

> The build has three stages. Only **stage 1** (`npm ci`) needs network access.
> Stages 2 (Vite build) and 3 (nginx) run without internet.

### 5. Deploy

```bash
helm upgrade --install fusion-spectra ./deployment \
  -f ./deployment/values-dev.yaml \
  --namespace fusion --create-namespace
```

### 6. Force pod restart after rebuild

When the image tag stays `latest`, Kubernetes will not restart pods automatically after `helm upgrade`. Force a rollout:

```bash
kubectl rollout restart deployment/fusion-spectra -n fusion
kubectl rollout status  deployment/fusion-spectra -n fusion
```

### 7. Open

```
http://spectra.fusion.local
```

### Updating runtime config without rebuilding

```bash
helm upgrade fusion-spectra ./deployment \
  -f ./deployment/values-dev.yaml \
  --set config.bffUrl=http://my-bff.local
```

The pod restarts automatically — the `checksum/config` annotation detects the ConfigMap change.

### Type checking

```bash
npm run typecheck
```

---

## Production

### 1. Set up a private npm registry

Production builds must not reach the internet. All npm packages are pulled from an internal registry (Nexus, Artifactory, Verdaccio, etc.).

**Test with the bundled mock registry:**

```bash
# Start Verdaccio on :4873 (proxies npmjs.org and caches locally)
docker compose -f mock-registry/docker-compose.yml up -d
```

Packages are cached on first pull. Once seeded, the mock registry can serve builds without internet access.

### 2. Build the image

```bash
# Against mock registry (testing):
docker build \
  --build-arg NPM_REGISTRY=http://host.docker.internal:4873 \
  -t registry.fusion.local/fusion-platform/fusion-spectra:1.0.0 .

# Against real internal registry (CI/CD):
docker build \
  --build-arg NPM_REGISTRY=https://npm.registry.internal \
  -t registry.fusion.local/fusion-platform/fusion-spectra:1.0.0 .
```

### 3. Push to registry

```bash
docker push registry.fusion.local/fusion-platform/fusion-spectra:1.0.0
```

### 4. Configure values

Create a `values-prod.yaml` (do **not** commit secrets):

```yaml
image:
  repository: registry.fusion.local/fusion-platform/fusion-spectra
  tag: "1.0.0"

imagePullSecrets:
  - name: registry-credentials

config:
  bffUrl: "https://bff.example.com"

ingress:
  host: spectra.example.com
  tls:
    enabled: true
    secretName: fusion-spectra-tls
```

### 5. Create the TLS secret

```bash
kubectl create secret tls fusion-spectra-tls \
  --cert=tls.crt \
  --key=tls.key \
  -n fusion
```

Or use cert-manager and let it provision the secret automatically — set the annotation in `values-prod.yaml`:

```yaml
ingress:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
```

### 6. Deploy

```bash
helm upgrade --install fusion-spectra ./deployment \
  -f values-prod.yaml \
  --namespace fusion --create-namespace
```

### 7. Verify

```bash
# Pod is running
kubectl get pods -n fusion -l app.kubernetes.io/name=fusion-spectra

# Runtime config is injected
curl https://spectra.example.com/config.js
```

### Updating runtime config without rebuilding

```bash
helm upgrade fusion-spectra ./deployment \
  -f values-prod.yaml \
  --set config.bffUrl=https://new-bff.example.com
```

### Scaling

```yaml
# values-prod.yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 6
  targetCPUUtilizationPercentage: 70
```

---

## Helm reference

| Parameter | Default | Description |
|-----------|---------|-------------|
| `image.repository` | `registry.fusion.local/fusion-platform/fusion-spectra` | Image repository |
| `image.tag` | *(Chart.AppVersion)* | Image tag |
| `image.pullPolicy` | `IfNotPresent` | Pull policy |
| `replicaCount` | `1` | Pod replicas (ignored when autoscaling enabled) |
| `config.bffUrl` | `http://bff.fusion.local` | BFF URL injected into `window.FUSION_CONFIG` |
| `ingress.enabled` | `true` | Create Ingress resource |
| `ingress.className` | `nginx` | Ingress class |
| `ingress.host` | `spectra.fusion.local` | Ingress hostname |
| `ingress.tls.enabled` | `true` | Enable TLS on ingress |
| `ingress.tls.secretName` | `fusion-spectra-tls` | TLS secret name |
| `createNamespace` | `false` | Create the `fusion` namespace |
| `autoscaling.enabled` | `false` | Enable HPA |
