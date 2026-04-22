# fusion-spectra

Vue 3 + Quasar 2 + Vite micro-frontend shell (Module Federation host).
Dev server: `npm run dev` → http://dev.fusion.local:5174
- Requires `127.0.0.1 dev.fusion.local` in `/etc/hosts` (localhost breaks SameSite=Lax cookie sharing with bff.fusion.local)
- Vite config: `server.host:'0.0.0.0'`, `server.port:5174`, `server.allowedHosts:['dev.fusion.local']`
Type check: `npm run typecheck`

## Stack
- Vue 3, Quasar 2, Pinia, Vue Router 4, Vite 5
- Icons: `@quasar/extras` mdi-v7 (use `mdi-*` names)
- Fonts: DM Sans (UI), JetBrains Mono (data/mono) — loaded via Google Fonts in index.html
- CSS custom properties in `src/css/app.scss` (all `--fs-*`)
- Quasar theme vars in `src/css/quasar-variables.scss`

## Layout architecture
- `src/layouts/MainLayout.vue` — shell: topbar + activity rail + sidebar + canvas
- Activity rail (`src/components/ActivityRail.vue`) — 5 contexts; click active = toggle sidebar
- Sidebar (`src/components/AppSidebar.vue`) — IDE-style tree, 2-level (group → leaf)
- Canvas panels use `src/components/CanvasPanel.vue`
- Context/nav data: `src/data/navigation.ts` — single source of truth

## CanvasPanel component
Props: `title`, `icon`, `wide` (span 2 cols), `loading` (spinner overlay), `error` (error state + retry).
Emits: `refresh`. Slots: default body, `actions` (header right area).
No footer slot — add pagination below the table inside the default slot.

## Contexts (activity rail order)
1. Data → `/data`
2. Pipelines & Jobs → `/pipelines`
3. Monitoring → `/monitoring`
4. Fusion Index → `/fusion-index` — live registry UI backed by fusion-index API
5. Admin → `/admin` (admin-only, amber accent, bottom of rail)

## Auth
- BFF owns all OIDC — frontend knows nothing about Keycloak or tokens
- Auth store (`src/stores/auth.ts`): `init()` calls `GET /bff/userinfo` with `credentials:'include'`; 401 → `window.location.href = bffUrl + '/bff/login'`
- Router guard in `src/router/index.ts` calls `auth.init()` on every navigation
- BFF URL from `src/config/runtime.ts` → `window.FUSION_CONFIG.bffUrl` → `VITE_BFF_URL` → `http://bff.fusion.local`
- Runtime config file: `public/config.js` (overridden by ConfigMap mount in K8s)

## API clients
- `src/api/bffClient.ts` — base fetch with `credentials:'include'`; 401 auto-redirects to BFF login
- `src/api/indexApi.ts` — typed methods for fusion-index via BFF proxy path `/api/index/api/v1/*`

## fusion-index API shape
- `listArtifacts(params?)` — params: `name`, `tag`, `type[]`, `page` (0-based), `pageSize`; returns `ArtifactsPage { items, total, page, pageSize }`
- `getArtifact(id)` — returns single `Artifact`
- `listVersions(artifactId)` — returns bare `ArtifactVersion[]` (no wrapper), newest first
- `listFiles(artifactId, semver)` — returns bare `ArtifactFile[]`; each file has `sizeBytes`, `downloadUrl` (relative path), `contentType`, `status`
- `getFileDownloadUrl(artifactId, semver, fileId)` — constructs full BFF download URL
- All fields camelCase; IDs are `number`
- `Artifact` has `types: TypeResponse[]` (may be empty; guard with `?? []`)
- `ArtifactVersion` has `major/minor/patch`, `tags: ArtifactTag[]` (may be missing; guard with `?? []`)

## Fusion Index pages
- `src/pages/FusionIndexPage.vue` — dashboard: artifact table, recent versions, quick search (loads page 0, size 20)
- `src/pages/index/ArtifactListPage.vue` — paginated list (20/page), debounced name search, clickable rows → detail
- `src/pages/index/ArtifactDetailPage.vue` — metadata panel + versions table with size + download button per version
  - Single file: direct `<a>` download link
  - Multiple files: `q-btn-dropdown` listing each file with name, size, content-type

## Fusion Index navigation (navigation.ts)
Context `fusion-index` has two groups:
- **Registry**: Dashboard → `/fusion-index`, Artifact List → `/fusion-index/artifacts`
- **Monitoring**: Overview → `/fusion-index/monitoring` (placeholder)

## Router (router/index.ts)
All routes are flat children under the `/` MainLayout route.
Fusion Index uses explicit routes (not a wildcard):
- `/fusion-index` → `FusionIndexPage`
- `/fusion-index/artifacts` → `ArtifactListPage`
- `/fusion-index/artifacts/:id` → `ArtifactDetailPage`
- `/fusion-index/:pathMatch(.*)*` → `FusionIndexPage` (catch-all for unimplemented leaves)

## Themes
- `src/stores/theme.ts` — 5 themes: midnight, azure, matrix, light, synthwave; persisted to localStorage
- Applies `data-theme` on `<html>` + calls `Quasar.Dark.set()` — CSS vars alone don't affect Quasar portals (menus, tooltips)
- CSS variable overrides per theme in `src/css/app.scss` under `[data-theme="<name>"]` blocks

## Deployment
- Dockerfile: 3-stage (deps → build → nginx:alpine); `NPM_REGISTRY` build arg for private registry
- `nginx.conf`: SPA fallback, gzip, no-cache on `index.html`/`config.js`, immutable cache on hashed assets
- Helm chart: `deployment/` — `values.yaml` (prod) + `values-dev.yaml` (minikube, `pullPolicy:Never`, `image.repository:fusion-spectra`)
- Runtime config injected via ConfigMap → `/usr/share/nginx/html/config.js` (only `bffUrl` for now)
- `mock-registry/` — Verdaccio docker-compose for offline npm builds

## Quasar + Vite gotchas
- `sass-embedded` must be in `devDependencies` (not `dependencies`)
- `sassVariables` path in `@quasar/vite-plugin` must be absolute (`resolve(__dirname, ...)`)
- `build.target: 'esnext'` required when Module Federation is added
- Import mdi css before quasar css in `main.ts`
- Do NOT set `config: { dark: true }` in main.ts — let the theme store call `Dark.set()` instead; otherwise light theme still renders dark Quasar components
- API fields like `types[]` and `tags[]` may be absent from responses even when typed — always guard with `?? []`
