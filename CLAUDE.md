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

## Contexts (activity rail order)
1. Data → `/data`
2. Pipelines & Jobs → `/pipelines`
3. Monitoring → `/monitoring`
4. Fusion Index → `/fusion-index` (mock registry)
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

## Themes
- `src/stores/theme.ts` — 5 themes: midnight, azure, matrix, light, synthwave; persisted to localStorage
- Applies `data-theme` on `<html>` + calls `Quasar.Dark.set()` — CSS vars alone don't affect Quasar portals (menus, tooltips)
- CSS variable overrides per theme in `src/css/app.scss` under `[data-theme="<name>"]` blocks

## fusion-index API shape
- `listArtifacts` returns `{ items: Artifact[], total, page }` — unwrap `.items`; fields are camelCase (`fullName`, `createdAt`, `updatedAt`); IDs are `number`
- `listVersions` returns a plain array (no wrapper); same camelCase convention

## Quasar + Vite gotchas
- `sass-embedded` must be in `devDependencies` (not `dependencies`)
- `sassVariables` path in `@quasar/vite-plugin` must be absolute (`resolve(__dirname, ...)`)
- `build.target: 'esnext'` required when Module Federation is added
- Import mdi css before quasar css in `main.ts`
- Do NOT set `config: { dark: true }` in main.ts — let the theme store call `Dark.set()` instead; otherwise light theme still renders dark Quasar components
