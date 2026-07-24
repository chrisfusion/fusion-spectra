# fusion-spectra

The Fusion Platform web UI — a Vue 3 micro-frontend shell that brings together data cataloguing, pipeline management, monitoring, artifact registry, and Python environment builds in a single IDE-style interface.

---

## Features

| Context | Status | Description |
|---------|--------|-------------|
| **Data** | Placeholder | Catalog, storage, access control |
| **Weave** (Pipelines) | Live | Run monitoring, GitOps runs, triggers, run/step blueprints |
| **Monitoring** | Placeholder | System health, metrics, alerts |
| **Forge** | Live | Async Python venv builder — venvs, git-sourced builds, GitOps watchers |
| **Fusion Index** | Live | Artifact registry — list, create, version, tags, download, delete |
| **Admin** | Partially live | Role assignments, resource permissions, artifact types, cleanup jobs, service status overrides |
| **Changelog / Help** | Live | Cross-project changelog feed; searchable help articles and videos |

### Weave (implemented)

- **Run overview** — dashboard + running/failed run lists with inline step logs, auto-polling
- **GitOps runs** — list/create/detail/stop for GitOps-controlled service instances
- **Triggers** — event-based run triggers, list/create/edit
- **Run blueprints** — single-step, webservice, ETL, and advanced chain-builder wizards
- **Step blueprints** — job and service blueprints, including expert (raw YAML) create flows

### Forge (implemented)

- **Venv list** — paginated table with multi-status chip filter and debounced name search
- **Create Venv wizard** — 2-step: package info → requirements.txt upload with live server-side validation
- **Venv detail** — metadata + live build log panel; auto-polls every 5 s while PENDING/BUILDING
- **Git-sourced builds** — build venvs directly from a git repo, with GitOps watchers for auto-rebuild on push

### Fusion Index (implemented)

- **Artifact list** — searchable, paginated registry of all artifacts
- **Artifact detail** — metadata + version history with per-file download links; inline tag management
- **Create Artifact wizard** — 3-step: name/description → semver + JSON config → multi-file upload
- **Add Version wizard** — 2-step: semver + JSON config → multi-file upload
- **Delete artifact / version** — with confirmation dialogs; last-version removal prompts artifact cleanup
- **Tags** — artifact-level named pointers to a semver (like a git tag); inline add/move/delete per version row
- **JSON config editor** — CodeMirror 6 with syntax highlighting, lint validation, and Format button

### Admin (partially implemented)

- **Role Assignments** (`/admin/roles`) — manage group → role mappings backed by BFF DB
- **Resource Permissions** (`/admin/permissions`) — grant per-resource permissions to users/groups/roles
- **Artifact Types** (`/admin/types`) — CRUD for artifact type taxonomy
- **Index Cleanup** / **Forge Cleanup** — orphaned-resource cleanup tools
- **Service Status Overrides** (`/admin/health`) — manual overrides for platform service health

### RBAC

- Permission gates via `usePermission()` composable: `can('index:artifacts:delete')` / `can('perm', resourceId)`
- Resource-scoped grants: a user can hold a permission on a specific artifact/venv without a global grant
- Admin-only UI elements and routes hidden from non-admin users at the router and component level

---

## Quick start

```bash
npm install
npm run dev
# → http://dev.fusion.local:5174
```

Requires `127.0.0.1 dev.fusion.local` in `/etc/hosts` (see [CLAUDE.md](CLAUDE.md) for why `localhost` doesn't work).

---

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design, component tree, API layer, auth flow
- [CHANGELOG.md](CHANGELOG.md) — Release history
- [CLAUDE.md](CLAUDE.md) — Dev conventions, deployment runbook, gotchas

---

## Stack

- **Vue 3** + Composition API (`<script setup>`)
- **Quasar 2** — UI components and icon set (mdi-v7)
- **Pinia** — auth and theme stores
- **Vue Router 4** — hash history, context-based routing
- **Vite 5** — build tooling (Module Federation host)
- **CodeMirror 6** — JSON editor with linting
- **@vue-flow/core** + **@dagrejs/dagre** — advanced chain-builder graph view
- **marked** — Markdown rendering for help articles
- **TypeScript** throughout
- **5 themes** — Lumen (default), Azure, Carbon, Matrix, Synthwave
