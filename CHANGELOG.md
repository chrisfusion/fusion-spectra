# Changelog

All notable changes to fusion-spectra are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [0.9.5] — 2026-05-13

<!-- 2026-05-13 -->
### Added
- Changelog page (`/changelog`) displaying platform-wide release notes fetched from fusion-content via BFF `/api/content/api/v1/changelog`; paginated timeline grouped by date with Added/Changed/Fixed/Removed sections per project entry
- Changelog button in the activity rail (bottom utility section, above Admin for admins, bottommost for regular users); navigates directly without opening the sidebar

<!-- 2026-05-12 -->
### Changed
- Nginx no longer runs as root: container switched to `USER nginx` (uid 101), listening on port 8080
- Dockerfile fixes ownership of `/var/cache/nginx`, `/var/log/nginx`, and `/var/run/nginx.pid` for the nginx user
- Helm deployment enforces `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, and drops all Linux capabilities
- Three `emptyDir` volumes (`/var/cache/nginx`, `/var/run`, `/tmp`) mounted to satisfy nginx write needs under a read-only root filesystem
- `fsGroup: 101` in pod security context ensures emptyDir mounts are writable by the nginx user

---

## [0.9.3] — 2026-05-11

### Added
- Restart button on Deploy step rows in WeaveRunDetailPage: triggers a rolling restart via the `fusion-platform.io/restart-step` annotation PATCH; gated by `weave:steps:restart` permission; in-flight spinner + confirmation dialog
- `StepPhase` type now includes `'Deployed'`; added `phase-badge--deployed` style (green)

---

## [0.9.2] — 2026-05-11

### Fixed
- SPA navigation blank-canvas after deployment: `router.onError` now catches stale-chunk errors and auto-reloads to the target route, eliminating the need for manual Ctrl+R after a redeploy

---

## [0.9.1] — 2026-05-11

### Fixed
- Clean redeploy to clear browser-cached stale JS chunks that caused blank canvas on context switch

---

## [0.9.0] — 2026-05-11

### Added
- Job & service template detail dialog: click any row to see full metadata + spec as formatted JSON
- Job & service template inline edit: "Edit" button switches dialog to `JsonEditor` mode; `PUT /:name` with `resourceVersion` for safe concurrency
- Confirm dialog when changing container image in edit mode (`spec.image` diff check before save)
- Template name shown as read-only with lock icon + tooltip (K8s names are immutable)
- Run delete button on all run list pages (overview, running, failed) — confirmed via `$q.dialog`, optimistic removal
- Run info panel expanded: Namespace, UID, Steps, Created, Duration, Shared PVC, Params, Message
- Step info dialog: click any step row to see all `RunStepStatus` fields (phase, kind, job/deployment ref, timings, retries, output captured, message)
- Step log dialog: dedicated log button on every step row opens a wide dialog with pod name in header; shows "EOF — No LOG available at moment or yet" when no output is captured

### Changed
- Replaced inline log expansion (table row toggle) with a separate log dialog
- Log button now appears on all step rows regardless of `jobRef`/`deploymentRef`

---

## [0.8.2] — 2026-05-08

### Added
- Forge Git Build Wizard: 2-step wizard (Repository → Review & Submit) at `/forge/gitbuilds/create`
- `metadata_source` toggle: `full` / `version` / `manual` — controls which fields are sent to the API
- Python version selector in Venv Create Wizard

### Changed
- Venv list page unified: ALL / requirements / git build-type chips; ALL mode merges both endpoints by `createdAt`

---

## [0.8.0] — 2026-05-07

### Added
- Service health status overrides page (`/admin/health`) — admin can set `Healthy / Unhealthy / Offline / Maintenance` per service
- BFF admin API methods: `listServiceStatusOverrides`, `upsertServiceStatusOverride`, `deleteServiceStatusOverride`

---

## [0.7.0] — 2026-05-05

### Added
- Advanced Chain Builder (`/pipelines/weave/chains/advanced`): 3-step wizard with live DAG preview
- Split-panel step 2: dynamic step list (left) + sticky `ChainDagView` preview (right)
- Cycle detection (DFS) blocks Next when a circular dependency is introduced
- Step rename propagation: renaming a step updates `dependsOn` and `consumesOutputFrom` across all other steps
- `producesOutput` / `consumesOutputFrom` wiring between steps
- Per-step env overrides, `runOnSuccess` / `runOnFailure` flags

---

## [0.6.0] — 2026-05-04

### Added
- Weave run monitoring: Overview (`/pipelines/runs`), Running, Failed list pages with 10 s auto-polling
- Run detail page (`/pipelines/runs/:name`): info panel, steps table, events table
- `useRunsPolling` composable for list pages
- `weaveMonitorApi.ts`: typed client for `/api/weave/monitor/v1/`

---

## [0.5.0] — 2026-04-30

### Added
- Weave Trigger List page with fire-on-demand button
- Weave Chain list with delete
- Simple Deploy Wizard (`/pipelines/weave/chains/simple-deploy`): service + optional smoketest job in one form
- OnDemand / Cron / Webhook trigger wizard

### Fixed
- POST `/chains` returned 403 — RBAC config updated to include `weave:resources:write`

---

## [0.4.0] — 2026-04-28

### Added
- Job Template list, create (simple + expert), and delete pages
- Service Template list, create (simple + expert), and delete pages
- Expert create forms: ports, probes (liveness/readiness/startup), ingress, volumes, resources, env
- Ext-BFF copy-URL buttons per file in artifact versions (copy download URL + copy public API URL)
- Runtime config: `extBffDownloadPattern`, `extBffPublicPattern`, `extBffPublicTag`

---

## [0.3.0] — 2026-04-26

### Added
- RBAC Stage 3: resource-scoped permissions; `ResourcePermissionsPage` (`/admin/permissions`)
- `can(permission, resourceId?)` in `usePermission` composable checks global + resource-scoped grants
- `ResourcePermission` shape in `UserInfo`; `permission_implies` in BFF RBAC config
- Admin hub page (`/admin`): 2-column card grid linking to all admin sub-pages
- Artifact Types CRUD page (`/admin/types`)
- Role Assignments page (`/admin/roles`)
- Upload progress bars for multi-file artifact uploads

### Changed
- RBAC Stage 1 + 2: static config-driven roles → DB-backed group→role assignments

---

## [0.2.0] — 2026-04-25

### Added
- Forge Venv Builder: Create Venv wizard (2-step: packages → requirements.txt upload + validation)
- Venv list page with status chips and polling
- Venv detail page: metadata + live log panel, auto-polls while PENDING/BUILDING
- 5 UI themes: midnight, azure, matrix, light, synthwave — persisted to `localStorage`
- `JsonEditor` component (CodeMirror 6, `--fs-*` themed)
- `TagChipInput` component

---

## [0.1.0] — 2026-04-22

### Added
- Project scaffold: Vue 3 + Quasar 2 + Vite 5 + Pinia + Vue Router 4
- `MainLayout`: topbar + activity rail + sidebar + canvas grid
- 6 contexts: Data, Pipelines & Jobs, Monitoring, Forge, Fusion Index, Admin
- Auth via BFF OIDC (`/bff/userinfo`, auto-redirect on 401)
- Fusion Index: artifact list, detail, create wizard (3-step), version create wizard
- `ArtifactDetailPage`: versions table, per-file download, delete artifact + delete version
- `CanvasPanel` component with loading/error/refresh/actions slot
- Helm chart + Dockerfile (3-stage) + `values-dev.yaml` for minikube
- Runtime config via `public/config.js` / ConfigMap (`bffUrl`)
- `nginx.conf`: SPA fallback, gzip, immutable asset cache
