# fusion-spectra — Architecture

## System context

```
Browser
  │
  │  SameSite=Lax session cookie
  ▼
BFF (bff.fusion.local)          ← owns all OIDC / Keycloak interaction
  │  /bff/userinfo              ← auth check
  │  /bff/login                 ← login redirect
  │  /bff/logout
  │
  │  /api/index/*               ← reverse-proxy to fusion-index
  ▼
fusion-index backend            ← Go/Gin artifact registry API
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
│   ├── auth.ts                 Pinia: user info, init(), loginRedirect(), logout()
│   └── theme.ts                Pinia: 5 themes, persisted to localStorage
│
├── router/
│   └── index.ts                hash history; beforeEach guard calls auth.init()
│
├── data/
│   └── navigation.ts           single source of truth for all contexts/groups/leaves
│
├── layouts/
│   └── MainLayout.vue          shell: topbar + activity rail + sidebar + canvas
│
├── components/
│   ├── AppTopBar.vue           search bar, notifications, user menu
│   ├── ActivityRail.vue        vertical icon strip — 5 contexts; click active = toggle sidebar
│   ├── AppSidebar.vue          collapsible IDE-style tree (group → leaf)
│   ├── CanvasPanel.vue         card wrapper used by all pages
│   └── JsonEditor.vue          CodeMirror 6 JSON editor with lint + Format button
│
├── api/
│   ├── bffClient.ts            base fetch: credentials:'include', 401 redirect, FormData detection
│   └── indexApi.ts             typed methods for fusion-index via /api/index/api/v1/*
│
├── utils/
│   └── format.ts               formatSize(bytes) → human-readable string
│
└── pages/
    ├── DataPage.vue            placeholder
    ├── PipelinesPage.vue       placeholder
    ├── MonitoringPage.vue      placeholder
    ├── AdminPage.vue           placeholder
    ├── FusionIndexPage.vue     dashboard: artifact table + recent versions
    └── index/
        ├── ArtifactListPage.vue        paginated list, debounced search
        ├── ArtifactDetailPage.vue      metadata panel + versions table
        ├── ArtifactCreatePage.vue      3-step wizard
        └── ArtifactVersionCreatePage.vue  2-step wizard
```

---

## Shell layout

```
┌─────────────────────────────────────────────────────────┐
│  AppTopBar  (36px — search, notifications, user menu)   │
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

The **Activity Rail** switches contexts; clicking the active context icon toggles the sidebar. Context is synced from `route.meta.context` so direct URL navigation always highlights the correct rail icon and opens the right sidebar.

---

## Routing

All routes are flat children under the `/` `MainLayout` route. Vue Router 4 matches in declaration order, so literal segments must appear before dynamic ones:

```
/fusion-index/artifacts/create              ← must come before /:id
/fusion-index/artifacts/:id/versions/create ← must come before /:id
/fusion-index/artifacts/:id
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
      ├── 200 OK  ──► store user, return true
      │
      └── 401 / network error ──► loginRedirect()
                                      │
                                      ▼
                              window.location = /bff/login
                              (BFF → Keycloak OIDC flow)
```

---

## API layer

### bffClient.ts

Thin wrapper around `fetch`:
- Prepends `getBffUrl()` to all paths
- Sends `credentials: 'include'` on every request
- Detects `FormData` body and omits `Content-Type: application/json` (lets the browser set multipart boundary)
- 401 → immediate redirect to BFF login
- Non-2xx → throws `ApiError(status, message)`

### indexApi.ts

Typed methods over `bffClient`. BFF proxy path: `/api/index/api/v1/*`

| Method | HTTP | Endpoint |
|--------|------|----------|
| `listArtifacts(params?)` | GET | `/artifacts` |
| `getArtifact(id)` | GET | `/artifacts/:id` |
| `createArtifact(payload)` | POST | `/artifacts` |
| `listVersions(artifactId)` | GET | `/artifacts/:id/versions` |
| `createVersion(artifactId, payload)` | POST | `/artifacts/:id/versions` |
| `listFiles(artifactId, semver)` | GET | `/artifacts/:id/versions/:semver/files` |
| `uploadFile(artifactId, semver, file)` | POST | `/artifacts/:id/versions/:semver/files` |
| `getFileDownloadUrl(...)` | — | constructs BFF URL |

---

## Navigation data model

`src/data/navigation.ts` is the single source of truth for the entire navigation tree. Nothing is hardcoded in layout components.

```
Context[]
  └── NavGroup[]
        └── NavLeaf[]  { id, label, icon, route, badge? }
```

`MainLayout` reads this tree to drive the Activity Rail and Sidebar. Adding a new section means adding a leaf here and a route in `router/index.ts` — no layout changes needed.

---

## Theming

Five themes: `midnight` (default), `azure`, `matrix`, `light`, `synthwave`.

Each theme is a block of CSS custom property overrides in `src/css/app.scss` under `[data-theme="<name>"]`. The theme store applies `data-theme` to `<html>` **and** calls `Quasar.Dark.set()` — CSS vars alone don't reach Quasar portals (menus, tooltips, dropdowns) which are mounted outside the Vue root.

---

## Fusion Index — feature detail

### Pages and wizards

```
/fusion-index                        FusionIndexPage       dashboard
/fusion-index/artifacts              ArtifactListPage      paginated list + search
/fusion-index/artifacts/create       ArtifactCreatePage    3-step wizard
  Step 1: fullName* + description
    → async name-availability check (listArtifacts exact match)
  Step 2: version* (semver) + config (JsonEditor, optional)
  Step 3: drag-and-drop files (multi) + Create Artifact
    → createArtifact → createVersion → uploadFile×N → navigate to detail
    → orphan recovery: if artifact/version created before upload fails,
      shows "Go to artifact →" and disables resubmit

/fusion-index/artifacts/:id          ArtifactDetailPage    metadata + versions table
  Versions panel actions slot: [+ Add Version] button

/fusion-index/artifacts/:id/versions/create  ArtifactVersionCreatePage  2-step wizard
  Step 1: version* (semver) + config (JsonEditor, optional)
  Step 2: drag-and-drop files + Create Version
    → createVersion → uploadFile×N → navigate to detail
    → createdVersion ref locks Back/Submit once version exists (prevents duplicates)
```

### JsonEditor component

CodeMirror 6 embedded in a Vue component. Key design decisions:

- **Empty = valid**: the field is optional in both wizards; an empty editor emits `valid: true`
- **External sync**: a `watch` on `modelValue` dispatches changes into the editor (e.g. programmatic format)
- **`{ } Format` button**: `JSON.stringify(JSON.parse(text), null, 2)` — only runs on valid JSON
- **Theme**: all colours via `--fs-*` CSS custom properties so it respects the active theme

---

## Runtime configuration

```
public/config.js          ← loaded before main.js in index.html
  window.FUSION_CONFIG = { bffUrl: "..." }
```

In Kubernetes this file is replaced by a ConfigMap mount, so `bffUrl` can be changed without rebuilding the image. In local dev, `VITE_BFF_URL` env var is the fallback.
