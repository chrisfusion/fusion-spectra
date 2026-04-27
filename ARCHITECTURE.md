# fusion-spectra — Architecture

## System context

```
Browser
  │
  │  SameSite=Lax session cookie
  ▼
BFF (bff.fusion.local)          ← owns all OIDC / Keycloak interaction
  │  /bff/userinfo              ← auth check; returns sub, email, roles, permissions, resource_permissions
  │  /bff/login                 ← login redirect
  │  /bff/logout
  │  /bff/admin/*               ← admin API (group-roles, resource-permissions, rbac-config)
  │
  │  /api/index/*               ← reverse-proxy to fusion-index
  │  /api/forge/*               ← reverse-proxy to fusion-forge
  ▼
fusion-index backend            ← artifact registry API
fusion-forge backend            ← async Python venv builder API
  │
  └── PostgreSQL
```

The frontend holds **no tokens** and has no direct knowledge of Keycloak. All auth state lives in the BFF's session cookie. Every API call goes through the BFF proxy.

---

## Frontend architecture

```
src/
├── main.ts                     entry point — Quasar, Pinia, Router
├── App.vue                     root component (router-view only)
│
├── config/
│   └── runtime.ts              window.FUSION_CONFIG → VITE_BFF_URL fallback
│
├── stores/
│   ├── auth.ts                 Pinia: UserInfo (sub, email, name, roles, permissions, resource_permissions)
│   └── theme.ts                Pinia: 7 themes, persisted to localStorage
│
├── composables/
│   └── usePermission.ts        can(permission, resourceId?) / hasRole(role) / isAdmin
│
├── router/
│   └── index.ts                hash history; beforeEach guard: auth.init() + adminOnly redirect
│
├── data/
│   └── navigation.ts           single source of truth for all contexts/groups/leaves
│
├── layouts/
│   └── MainLayout.vue          shell: topbar + activity rail + sidebar + canvas
│
├── components/
│   ├── AppTopBar.vue           search bar, notifications, user menu
│   ├── ActivityRail.vue        icon strip — 6 contexts; admin section v-if="isAdmin"
│   ├── AppSidebar.vue          collapsible IDE-style tree (group → leaf)
│   ├── CanvasPanel.vue         card wrapper used by all pages
│   ├── JsonEditor.vue          CodeMirror 6 JSON editor with lint + Format button
│   └── TagChipInput.vue        v-model string[] chip input for tag lists
│
├── api/
│   ├── bffClient.ts            base fetch: credentials:'include', 401 redirect, FormData detection
│   ├── indexApi.ts             typed methods for fusion-index via /api/index/api/v1/*
│   ├── forgeApi.ts             typed methods for fusion-forge via /api/forge/api/v1/*
│   └── bffAdminApi.ts          typed admin API: group-roles, resource-permissions, rbac-config
│
├── utils/
│   └── format.ts               formatSize(bytes) → human-readable string
│
└── pages/
    ├── DataPage.vue            placeholder
    ├── PipelinesPage.vue       placeholder
    ├── MonitoringPage.vue      placeholder
    ├── FusionIndexPage.vue     dashboard: artifact table + recent versions
    ├── AdminPage.vue           navigation hub: 2-column card grid
    ├── index/
    │   ├── ArtifactListPage.vue        paginated list, debounced search
    │   ├── ArtifactDetailPage.vue      metadata panel + versions table + inline tags
    │   ├── ArtifactCreatePage.vue      3-step wizard
    │   └── ArtifactVersionCreatePage.vue  2-step wizard
    ├── forge/
    │   ├── ForgeIndexPage.vue          placeholder dashboard
    │   ├── VenvListPage.vue            paginated table, chip multi-status filter
    │   ├── VenvCreatePage.vue          2-step wizard
    │   └── VenvDetailPage.vue          metadata + live log panel, auto-polls while building
    └── admin/
        ├── RoleAssignmentsPage.vue     group → role CRUD backed by BFF DB
        ├── ResourcePermissionsPage.vue resource-scoped permission grants
        └── ArtifactTypesPage.vue       artifact type taxonomy CRUD
```

---

## Shell layout

```
┌─────────────────────────────────────────────────────────┐
│  AppTopBar  (52px — search, notifications, user menu)   │
├───┬────────────┬────────────────────────────────────────┤
│   │            │                                        │
│ A │  Sidebar   │           Canvas                       │
│ c │  (groups + │   (router-view, scrollable)            │
│ t │   leaves)  │                                        │
│ i │            │   ┌────────────────────────────┐       │
│ v │            │   │  CanvasPanel               │       │
│ i │            │   │  ┌──────────┬──── actions ─┤       │
│ t │            │   │  │  icon    │  title       │       │
│ y │            │   │  └──────────┴──────────────┤       │
│   │            │   │  default slot (body)        │       │
│ R │            │   └────────────────────────────┘       │
│ a │            │                                        │
│ i │            │                                        │
│ l │            │                                        │
└───┴────────────┴────────────────────────────────────────┘
```

Activity rail contexts (top → bottom): Data, Pipelines & Jobs, Monitoring, Forge, Fusion Index, Admin (admin-only, amber accent, bottom).

---

## Routing

All routes are flat children under the `/` `MainLayout` route. Literal segments must appear before dynamic ones:

```
/fusion-index/artifacts/create              ← before /:id
/fusion-index/artifacts/:id/versions/create ← before /:id
/fusion-index/artifacts/:id
/forge/venvs/create                         ← before /:id
/forge/venvs/:id
/admin/roles                                ← literal admin sub-pages
/admin/permissions
/admin/types
/admin/:pathMatch(.*)*                      ← hub catch-all
```

Hash history (`createWebHashHistory`) is used so the SPA works without server-side rewrite configuration behind nginx.

---

## Auth flow

```
Router beforeEach
      │
      ▼
auth.init()  ──► already initialised? ──► return cached result
      │ no
      ▼
GET /bff/userinfo (credentials:'include')
      │
      ├── 200 OK  ──► store UserInfo { sub, email, name, roles, permissions, resource_permissions }
      │               return true
      │
      └── 401 / network error ──► loginRedirect()
                                      │
                                      ▼
                              window.location = /bff/login
                              (BFF → Keycloak OIDC flow)

After auth.init():
  route.meta.adminOnly && !hasRole('admin')  ──► redirect /data
```

---

## RBAC

`usePermission()` composable (`src/composables/usePermission.ts`) exposes three helpers:

| Helper | Returns true when… |
|---|---|
| `can(permission)` | user has the permission globally |
| `can(permission, resourceId)` | user has it globally **or** has a resource-scoped grant for that ID |
| `hasRole(role)` | user's `roles` array contains the role |
| `isAdmin` | computed: `hasRole('admin')` |

Global permissions come from `auth.user.permissions` (flat string array). Resource-scoped permissions come from `auth.user.resource_permissions` (array of `{ permission, resource_type, resource_id }`). Both are loaded once at login via `/bff/userinfo` — no extra API calls in components.

Gate UI elements with `can()` not `hasRole()` — roles are too coarse for UI gates.

---

## API layer

### bffClient.ts

Thin wrapper around `fetch`:
- Prepends `getBffUrl()` to all paths
- Sends `credentials: 'include'` on every request
- Detects `FormData` body and omits `Content-Type: application/json`
- 401 → immediate redirect to BFF login
- Non-2xx → throws `ApiError(status, message)`

### indexApi.ts

Typed methods over `bffClient`. BFF proxy path: `/api/index/api/v1/*`

| Method | HTTP | Endpoint |
|--------|------|----------|
| `listArtifacts(params?)` | GET | `/artifacts` |
| `getArtifact(id)` | GET | `/artifacts/:id` |
| `createArtifact(payload)` | POST | `/artifacts` |
| `deleteArtifact(id)` | DELETE | `/artifacts/:id` |
| `listVersions(artifactId)` | GET | `/artifacts/:id/versions` |
| `createVersion(artifactId, payload)` | POST | `/artifacts/:id/versions` |
| `deleteVersion(artifactId, semver)` | DELETE | `/artifacts/:id/versions/:semver` |
| `listFiles(artifactId, semver)` | GET | `/artifacts/:id/versions/:semver/files` |
| `uploadFile(artifactId, semver, file)` | POST | `/artifacts/:id/versions/:semver/files` |
| `getFileDownloadUrl(...)` | — | constructs BFF URL |
| `putTag(artifactId, tagName, semver)` | PUT | `/artifacts/:id/tags/:tag` |
| `deleteTag(artifactId, tagName)` | DELETE | `/artifacts/:id/tags/:tag` |
| `listTypes()` | GET | `/types` |
| `createType(payload)` | POST | `/types` |
| `updateType(id, payload)` | PUT | `/types/:id` |
| `deleteType(id)` | DELETE | `/types/:id` |

### forgeApi.ts

BFF proxy path: `/api/forge/api/v1/*`

| Method | HTTP | Endpoint |
|--------|------|----------|
| `listVenvs(params?)` | GET | `/venvs` |
| `createVenv(payload)` | POST | `/venvs` |
| `getVenv(id)` | GET | `/venvs/:id` |
| `validateVenv(payload)` | POST | `/venvs/validate` |

`validateVenv` uses raw `fetch` (not `bffFetch`) — forge returns a `ValidationResult` JSON body on 422, which `bffFetch` would throw and consume.

### bffAdminApi.ts

Admin endpoints directly on the BFF. Requires `admin:roles:manage` permission.

| Method | HTTP | Endpoint |
|--------|------|----------|
| `listGroupRoles()` | GET | `/bff/admin/group-roles` |
| `createGroupRole(group, role)` | POST | `/bff/admin/group-roles` |
| `deleteGroupRole(id)` | DELETE | `/bff/admin/group-roles/:id` |
| `listResourcePermissions()` | GET | `/bff/admin/resource-permissions` |
| `createResourcePermission(payload)` | POST | `/bff/admin/resource-permissions` |
| `deleteResourcePermission(id)` | DELETE | `/bff/admin/resource-permissions/:id` |
| `getRBACConfig()` | GET | `/bff/admin/rbac-config` |

---

## Navigation data model

`src/data/navigation.ts` is the single source of truth for the entire navigation tree.

```
Context[]
  └── NavGroup[]
        └── NavLeaf[]  { id, label, icon, route, badge? }
```

`MainLayout` reads this tree to drive the Activity Rail and Sidebar. Adding a new section means adding a leaf here and a route in `router/index.ts` — no layout changes needed.

---

## Theming

Seven themes: `midnight` (default), `azure`, `carbon`, `matrix`, `synthwave`, `light`, `lumen`.

Each theme is a block of CSS custom property overrides in `src/css/app.scss` under `[data-theme="<name>"]`. The theme store applies `data-theme` to `<html>` **and** calls `Quasar.Dark.set()` — CSS vars alone don't reach Quasar portals (menus, tooltips, dropdowns) mounted outside the Vue root.

`light` and `lumen` are treated as light themes (`Dark.set(false)`). All other themes use dark mode.

---

## Runtime configuration

```
public/config.js          ← loaded before main.js in index.html
  window.FUSION_CONFIG = { bffUrl: "..." }
```

In Kubernetes this file is replaced by a ConfigMap mount, so `bffUrl` can be changed without rebuilding the image. In local dev, `VITE_BFF_URL` env var is the fallback.
