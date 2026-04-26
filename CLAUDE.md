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
- Activity rail (`src/components/ActivityRail.vue`) — contexts split into regular (top) and admin (bottom); admin section rendered only when `isAdmin` is true
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
4. Forge → `/forge` — async Python venv builder (fusion-forge backend)
5. Fusion Index → `/fusion-index` — live registry UI backed by fusion-index API
6. Admin → `/admin` (admin-only, amber accent, bottom of rail)

## Auth
- BFF owns all OIDC — frontend knows nothing about Keycloak or tokens
- Auth store (`src/stores/auth.ts`): `init()` calls `GET /bff/userinfo` with `credentials:'include'`; 401 → `window.location.href = bffUrl + '/bff/login'`
- `UserInfo` shape: `{ sub, email, name, roles: string[], permissions: string[] }` — populated from BFF session
- Router guard in `src/router/index.ts` calls `auth.init()` on every navigation; routes with `meta.adminOnly: true` redirect non-admins to `/data`
- BFF URL from `src/config/runtime.ts` → `window.FUSION_CONFIG.bffUrl` → `VITE_BFF_URL` → `http://bff.fusion.local`
- Runtime config file: `public/config.js` (overridden by ConfigMap mount in K8s)

## RBAC (permissions)
- `src/composables/usePermission.ts` — call `usePermission()` in any component that needs access control
  - `can(permission: string)` — true if `auth.user.permissions` contains the permission string
  - `hasRole(role: string)` — true if `auth.user.roles` contains the role
  - `isAdmin` — computed: `hasRole('admin')`
- Gate UI elements with `v-if="can('index:artifacts:delete')"` etc., NOT with role checks — roles are too coarse for UI gates
- Admin icon in ActivityRail is hidden via `v-if="isAdmin"` — no admin entry renders for non-admin users
- Admin routes (`/admin/*`) have `meta.adminOnly: true`; the router guard redirects to `/data` if user lacks `admin` role
- Permission strings mirror the BFF `rbac.yaml` (e.g. `index:artifacts:read`, `index:versions:delete`, `forge:builds:create`, `admin:roles:manage`)

## API clients
- `src/api/bffClient.ts` — base fetch with `credentials:'include'`; 401 auto-redirects to BFF login
  - FormData detection: skips `Content-Type: application/json` when `body instanceof FormData` (multipart uploads)
- `src/api/indexApi.ts` — typed methods for fusion-index via BFF proxy path `/api/index/api/v1/*`

## fusion-index API shape
- `listArtifacts(params?)` — params: `name`, `tag`, `type[]`, `page` (0-based), `pageSize`; returns `ArtifactsPage { items, total, page, pageSize }`
- `getArtifact(id)` — returns single `Artifact`
- `createArtifact(payload)` — `POST /artifacts`; payload: `{ fullName, description? }`
- `deleteArtifact(id)` — `DELETE /artifacts/:id`; cascades all versions
- `createVersion(artifactId, payload)` — `POST /artifacts/:id/versions`; payload: `{ version, config? }`
- `deleteVersion(artifactId, semver)` — `DELETE /artifacts/:id/versions/:semver`; backend does best-effort file storage cleanup before DB cascade — frontend does NOT need to delete files individually
- `uploadFile(artifactId, semver, file)` — `POST /artifacts/:id/versions/:semver/files`; multipart, field name `file`
- `listVersions(artifactId)` — returns bare `ArtifactVersion[]` (no wrapper), newest first
- `listFiles(artifactId, semver)` — returns bare `ArtifactFile[]`; each file has `sizeBytes`, `downloadUrl` (relative path), `contentType`, `status`
- `getFileDownloadUrl(artifactId, semver, fileId)` — constructs full BFF download URL
- `listTypes()` — returns `TypeResponse[]`
- `createType(payload)` — `POST /types`; payload: `{ name, description? }`; 409 on duplicate name
- `updateType(id, payload)` — `PUT /types/:id`; same payload shape
- `deleteType(id)` — `DELETE /types/:id`; 204 on success
- All fields camelCase; IDs are `number`
- `Artifact` has `types: TypeResponse[]` (may be empty; guard with `?? []`)
- `ArtifactVersion` has `major/minor/patch`, `tags: ArtifactTag[]` (may be missing; guard with `?? []`)

## Shared utilities
- `src/utils/format.ts` — `formatSize(bytes)`: human-readable file size (B / KB / MB / GB)

## Components
- `src/components/TagChipInput.vue` — v-model `string[]` chip input for tag lists
  - Props: `modelValue: string[]`, `placeholder?`, `disabled?`
  - Emits: `update:modelValue`
  - Enter or comma adds a chip; Backspace removes last; × removes specific chip
  - Validation: `/^[a-zA-Z0-9-]+$/`, max 64 chars; trailing commas stripped before validation
  - Used in: `ArtifactVersionCreatePage` step 1, `ArtifactCreatePage` step 2
- `src/components/JsonEditor.vue` — CodeMirror 6 JSON editor
  - Props: `modelValue: string`, `placeholder?`, `minHeight?`, `maxHeight?`
  - Emits: `update:modelValue`, `valid` (false when non-empty invalid JSON; empty = valid)
  - `{ } Format` button pretty-prints via `JSON.stringify(JSON.parse(...), null, 2)`
  - Theme uses `--fs-*` CSS vars; syntax highlight via `@lezer/highlight` tags
  - `defineExpose({ format })` for programmatic formatting

## Fusion Index pages
- `src/pages/FusionIndexPage.vue` — dashboard: artifact table, recent versions, quick search (loads page 0, size 20)
- `src/pages/index/ArtifactListPage.vue` — paginated list (20/page), debounced name search, clickable rows → detail
- `src/pages/index/ArtifactDetailPage.vue` — metadata panel + versions table with size + download button per version
  - Single file: direct `<a>` download link
  - Multiple files: `q-btn-dropdown` listing each file with name, size, content-type
  - "Add Version" button in Versions panel `actions` slot → navigates to `ArtifactVersionCreatePage`
  - **Delete Artifact** button in metadata panel `actions` slot — gated with `can('index:artifacts:delete')`; `$q.dialog` confirmation → `deleteArtifact()` → navigate to artifact list
  - **Delete version** trash icon per row — gated with `can('index:versions:delete')`; `$q.dialog` confirmation → `deleteVersion()`; if last version deleted, second dialog prompts to delete the artifact too
  - `deletingVersions: ref<Set<string>>` tracks in-flight semver strings; button disabled and shows spinner while in flight
- `src/pages/index/ArtifactCreatePage.vue` — 3-step wizard: Artifact → Version → Files
  - Step 1: `fullName` (required) + `description`; async name-availability check on Next (exact match via `listArtifacts`)
  - Step 2: semver `version` (required, validated) + optional `config` (JsonEditor)
  - Step 3: drag-and-drop multi-file upload; duplicate name warning; orphan recovery if upload fails after artifact/version created
  - Semver regex allows pre-release/build: `/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/`
- `src/pages/index/ArtifactVersionCreatePage.vue` — 2-step wizard: Version → Files
  - NaN guard: redirects to artifact list if `:id` param is not a valid number
  - Loads artifact name for 3-level breadcrumb
  - Step 1: semver `version` + optional `config` (JsonEditor)
  - Step 2: drag-and-drop multi-file upload; same orphan recovery pattern (`createdVersion` ref locks Back/Submit once version exists)

## Fusion Index navigation (navigation.ts)
Context `fusion-index` has two groups:
- **Registry**: Dashboard → `/fusion-index`, Artifact List → `/fusion-index/artifacts`, Create Artifact → `/fusion-index/artifacts/create`
- **Monitoring**: Overview → `/fusion-index/monitoring` (placeholder)

## Admin page
- `src/pages/AdminPage.vue` — two sections in a 2-column grid:
  - **Platform panels**: Users (placeholder), Platform Services (placeholder), System Config (placeholder)
  - **Global Settings** section header (spans both columns) followed by:
    - **Artifact Types** panel — live CRUD backed by `indexApi` types endpoints; inline create row, inline edit per row, delete with `$q.dialog` confirmation; requires `index:types:manage` permission on the BFF (enforced server-side); page itself requires `admin` role (router guard)
- The section-header divider pattern (`grid-column: span 2`, uppercase label + icon) is reusable for future Global Settings panels

## Router (router/index.ts)
All routes are flat children under the `/` MainLayout route.
Fusion Index uses explicit routes (not a wildcard):
- `/fusion-index` → `FusionIndexPage`
- `/fusion-index/artifacts` → `ArtifactListPage`
- `/fusion-index/artifacts/create` → `ArtifactCreatePage`
- `/fusion-index/artifacts/:id/versions/create` → `ArtifactVersionCreatePage`
- `/fusion-index/artifacts/:id` → `ArtifactDetailPage`
- `/fusion-index/:pathMatch(.*)*` → `FusionIndexPage` (catch-all for unimplemented leaves)
- Route ordering matters: `create` literals must appear before `/:id` dynamic segments
- Admin routes use `meta: { adminOnly: true }`; `beforeEach` guard redirects non-admin users to `/data`

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
- Always use semver image tags (never `latest`/`local`): `eval $(minikube docker-env) && docker build -t fusion-spectra:X.Y.Z .`
- Docker build MUST run inside minikube's daemon (`eval $(minikube docker-env)` first) — otherwise pod gets `ErrImageNeverPull`
- After building, update `image.tag` in `values-dev.yaml` and run `helm upgrade`; tag change triggers pod replacement automatically

## Tag model (fusion-index)
- A tag (e.g. `stable`, `latest`) is an **artifact-level named pointer** to one semver at a time — like a git tag
- `putTag(artifactId, tagName, semver)` upserts: if the tag already exists on another version it **moves** (old version silently loses it)
- `deleteTag(artifactId, tagName)` removes the tag globally — no version has it afterwards
- Inline tag editing on `ArtifactDetailPage`: `tagMutating: ref<Set<number>>` tracks in-flight version IDs; `tagAddingFor: ref<number|null>` is the row in add mode
- `ArtifactTag` shape: `{ id, artifactId, tag, versionId, createdAt, updatedAt }`

## Quasar + Vite gotchas
- `sass-embedded` must be in `devDependencies` (not `dependencies`)
- `sassVariables` path in `@quasar/vite-plugin` must be absolute (`resolve(__dirname, ...)`)
- `build.target: 'esnext'` required when Module Federation is added
- Import mdi css before quasar css in `main.ts`
- Do NOT set `config: { dark: true }` in main.ts — let the theme store call `Dark.set()` instead; otherwise light theme still renders dark Quasar components
- API fields like `types[]` and `tags[]` may be absent from responses even when typed — always guard with `?? []`
- Vue 3: `ref` inside `v-for` resolves to an **array** — declare as `ref<El[]>([])` and access `[0]`; a `ref<El|null>(null)` silently becomes an array and `.focus()` fails
- Vue 3: `Set.add()` / `Set.delete()` are NOT reactive — replace the whole ref: `s.value = new Set([...s.value, x])`

## Screenshots
`screenshots/` — UI screenshots named `YYYY-MM-DD_<description>.png`

## Adding a new page / feature
1. Add leaf to `src/data/navigation.ts` under the correct group
2. Add route to `src/router/index.ts` — literal paths (`/create`) before dynamic (`/:id`)
3. Create page component under `src/pages/` (or `src/pages/<context>/`)
Both navigation.ts and router must be updated together — neither works without the other.

## Multi-step wizard pattern
Used in `ArtifactCreatePage` and `ArtifactVersionCreatePage`:
- `step` ref (number), `v-if="step === N"` per section inside one CanvasPanel
- Validate on Next click; only advance if valid
- Track partially-created resources in a ref (e.g. `createdId`) — prevents duplicate creation on retry and enables orphan recovery UI

## UI testing (Playwright)
- Test against minikube at `http://spectra.fusion.local`, not the dev server
- Use `browser_snapshot` (not screenshot) to get element `ref` values for clicks/fills
- Use `browser_take_screenshot` with `fullPage: true` to save to `screenshots/`
- After pod restart, browser may serve cached JS — hard-reload or open a new tab

## Fusion Forge pages
- `src/api/forgeApi.ts` — typed forge API via BFF proxy path `/api/forge/api/v1/*`
- `src/pages/forge/ForgeIndexPage.vue` — placeholder dashboard
- `src/pages/forge/VenvCreatePage.vue` — 2-step wizard: package info → requirements.txt upload + live validation
- `src/pages/forge/VenvListPage.vue` — paginated table, chip-based multi-status filter, debounced name search
- `src/pages/forge/VenvDetailPage.vue` — two-panel: metadata (left) + logs (right); auto-polls every 5s while PENDING/BUILDING; stops on terminal status or unmount; auto-scrolls logs to bottom

## fusion-forge API quirks
- Backend returns `SUCCESS` not `SUCCEEDED` — `normalizeStatus()` in `forgeApi.ts` normalizes on read; `denormalizeStatus()` converts back for filter query params
- `validateVenv` uses raw `fetch` (not `bffFetch`) — forge returns meaningful `ValidationResult` JSON on 422, but `bffFetch` throws and consumes the body
- Multi-value query params: use `q.append('status', s)` per value, not `q.set()`

## Forge navigation (navigation.ts)
Context `forge` has one group:
- **Venv Builder**: Overview → `/forge`, Venv Builds → `/forge/venvs`, Create Venv → `/forge/venvs/create`

Forge routes (`router/index.ts`): `/forge` → `ForgeIndexPage`, `/forge/venvs` → `VenvListPage`, `/forge/venvs/create` → `VenvCreatePage`, `/forge/venvs/:id` → `VenvDetailPage`, `/forge/:pathMatch(.*)*` → `ForgeIndexPage`

## CodeMirror 6 gotchas
- `@codemirror/lint` is a separate npm package (not bundled with `@codemirror/language`) — install explicitly
- `lintGutter` lives in `@codemirror/lint`, not `@codemirror/language`
