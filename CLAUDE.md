# fusion-spectra

Vue 3 + Quasar 2 + Vite + Module Federation host shell for the Fusion data lake platform.

## Commands

```bash
npm run dev           # dev server (bypass auth — no Keycloak needed)
npm run build         # type-check + vite build
docker build -t fusion-spectra:local .

# Minikube deploy
eval $(minikube docker-env)
kubectl apply -f deploy/k8s/
kubectl set image deployment/fusion-spectra spectra=fusion-spectra:local -n fusion
kubectl patch deployment fusion-spectra -n fusion --type=json \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"Never"}]'
```

## Auth Modes

Set `VITE_AUTH_MODE` in env:
- `bypass` — synthetic dev user, no credentials (default in `.env.development`)
- `token` — inject a long-lived JWT via `VITE_DEV_TOKEN`
- `oidc` — full PKCE flow via `oidc-client-ts`

`VITE_AUTH_MODE` uses `|| 'oidc'` not `?? 'oidc'` — Vite injects `"undefined"` string when unset.

## Build Gotchas

- `sass-embedded` must be in `devDependencies` — Quasar SASS requires it
- `sassVariables` in `@quasar/vite-plugin` must be an **absolute path**: `resolve(__dirname, 'src/...')`
- `build.target: 'esnext'` required by `@originjs/vite-plugin-federation`
- `src/types/federation.d.ts` must have no top-level imports (turns file into a module, breaks ambient `declare module`)
- JWT `VITE_DEV_TOKEN`: base64url must be normalised (`-`→`+`, `_`→`/`, pad `=`) before `atob()` — handled in `src/auth/devBypass.ts`

## Plugin Expansion (Module Federation)

To add a plugin remote:
1. Register in `vite.config.ts` under `federation.remotes`
2. Add ambient `declare module` to `src/types/federation.d.ts`
3. Add a route to `src/router/index.ts`

## Platform Context

- Namespace: `fusion` (minikube)
- NodePort: 30082, ingress: `spectra.fusion.local`
- Sibling services: `fusion-index` (job registry), `fusion-forge` (venv builder)
- Color palette: primary `#6c5ce7`, secondary `#00cec9`
