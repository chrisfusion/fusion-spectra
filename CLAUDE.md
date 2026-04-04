# fusion-spectra

Vue 3 + Quasar 2 + Vite + Module Federation host shell for the Fusion data lake platform.

## Commands

```bash
npm run dev           # dev server (bypass auth — no Keycloak needed)
npm run build         # type-check + vite build

# Shell image — pass plugin URLs as build-args so federation bakes the right remote entries
docker build \
  --build-arg VITE_INDEX_PLUGIN_URL=http://$(minikube ip):30083 \
  --build-arg VITE_FORGE_PLUGIN_URL=http://$(minikube ip):30084 \
  -t fusion-spectra:local .

# Plugin images
docker build -t fusion-index-plugin:local plugins/fusion-index-plugin/
docker build -t fusion-forge-plugin:local plugins/fusion-forge-plugin/

# Helm deploy (preferred — manages ConfigMap, plugin Deployment/Service)
helm upgrade --install fusion-spectra ./deployment \
  -f ./deployment/values-dev.yaml \
  --set plugins.indexPlugin.baseUrl=http://$(minikube ip):30083 \
  --set plugins.forgePlugin.baseUrl=http://$(minikube ip):30084 \
  --namespace fusion --create-namespace

# Verify running pod uses the image you just built (SHA must match)
docker inspect fusion-spectra:1.0.0 --format '{{.Id}}'   # expected
kubectl get pod -n fusion -l app=fusion-spectra \
  -o jsonpath='{.items[0].status.containerStatuses[0].imageID}'  # actual
# If they differ: kubectl rollout restart deployment/fusion-spectra -n fusion

# Same-tag rebuild: helm upgrade won't restart pods — always follow with:
kubectl rollout restart deployment/fusion-index-plugin deployment/fusion-forge-plugin deployment/fusion-spectra -n fusion

# Playwright headless validation (MCP plugin broken — chrome not at /opt/google/chrome/chrome)
# Write a validate.mjs and run: node validate.mjs
# Import: import { chromium } from '/home/c3po/sources/fusion-platform/fusion-spectra/node_modules/playwright/index.mjs'
# Launch: chromium.launch({ executablePath: '~/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome', args: ['--no-sandbox'] })
```

## Auth Modes

Set `VITE_AUTH_MODE` in env:
- `bypass` — synthetic dev user, no credentials (default in `.env.development`)
- `token` — inject a long-lived JWT via `VITE_DEV_TOKEN`
- `oidc` — full PKCE flow via `oidc-client-ts`

`VITE_AUTH_MODE` uses `|| 'oidc'` not `?? 'oidc'` — Vite injects `"undefined"` string when unset.

## Build Gotchas

- `values-dev.yaml` pins `ui.image.tag: 1.0.0` — build images with that exact tag or Helm silently runs the old image (`imagePullPolicy: Never` never re-pulls by digest)
- After a pod restart, do a hard refresh (`Ctrl+Shift+R`) — the shell's JS assets are cached `immutable` for 1 year in the browser
- `Dockerfile` must declare `ARG VITE_*` before `RUN npm run build` for each Vite build-time env var — without it Docker ignores the `--build-arg` and the fallback is used
- Shell `Dockerfile` uses `npm ci --legacy-peer-deps` — vite@^8 conflicts with `@vitejs/plugin-vue@5` peer dep; plain `npm ci` fails in Docker
- All `process.env['VITE_*']` reads in `vite.config.ts` AND all `import.meta.env.VITE_*` reads in plugin source must use `||` not `??` — Vite injects `"undefined"` string, not JS `undefined`; `??` passes the string through unchanged
- All URL construction goes through `indexClient` methods — never duplicate `apiBase()` in views (same `"undefined"` string risk)
- QTable virtual/action columns: use `field: () => ''` (function), not `field: 'actions'` (no such field on the row type)
- `sass-embedded` must be in `devDependencies` — Quasar SASS requires it
- `sassVariables` in `@quasar/vite-plugin` must be an **absolute path**: `resolve(__dirname, 'src/...')`
- `build.target: 'esnext'` required by `@originjs/vite-plugin-federation`
- `src/types/federation.d.ts` must have no top-level imports (turns file into a module, breaks ambient `declare module`)
- JWT `VITE_DEV_TOKEN`: base64url must be normalised (`-`→`+`, `_`→`/`, pad `=`) before `atob()` — handled in `src/auth/devBypass.ts`

## Plugin Expansion (Module Federation)

Plugins live in `plugins/<name>/` subfolder. Each is a standalone Vite app with its own Dockerfile + nginx that proxies `/api/v1/` to the backend via k8s DNS. NodePorts start at 30083.

To add a plugin remote:
1. Register in `vite.config.ts` under `federation.remotes` — use `||` not `??` for URL fallback
2. Add ambient `declare module` to `src/types/federation.d.ts` — use inline `import('vue').DefineComponent`, never `import type` inside the block
3. Add a route to `src/router/index.ts`
4. Add nav item to `src/stores/navigation.ts`
5. Add plugin section to `deployment/values.yaml` under `plugins`; enable in `values-dev.yaml`
6. Add `ARG VITE_<NAME>_PLUGIN_URL` to shell `Dockerfile` before `RUN npm run build`
7. Add `{{- if and .Values.plugins.<name>Plugin.enabled .Values.plugins.<name>Plugin.baseUrl }}` block to `deployment/templates/configmap.yaml`
8. Create `deployment/templates/plugin-<name>-deployment.yaml` and `plugin-<name>-service.yaml` (copy from index plugin templates)

Auth: plugin stores define the same store ID `'auth'` — shared Pinia returns the shell's instance at runtime.

## Platform Context

- `fusion-index` has no PersistentVolume for artifact storage (`/root/.fusion-index/artifacts/`) — files are lost on pod restart; known infra gap
- Namespace: `fusion` (minikube)
- NodePort: 30082, ingress: `spectra.fusion.local`
- Sibling services: `fusion-index` (job registry), `fusion-forge` (venv builder)
- Color palette: primary `#6c5ce7`, secondary `#00cec9`
