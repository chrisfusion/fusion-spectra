# Changelog

All notable changes to fusion-spectra are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

<!-- 2026-06-02 -->
### Changed
- Themes: removed `midnight` and `light` themes; `lumen` is now the default; stale localStorage values are coerced to `lumen` on first load
- Chunk reload guard: replaced boolean sessionStorage flag with a timestamp-based 8-second cooldown — fixes permanent stuck state when Ctrl+Shift+R was not recovering a blank page; added `vite:preloadError` listener to catch Vite preload failures not surfaced by `unhandledrejection`

### Added
- Admin: Forge Cleanup page extended with Zombie Build Cleanup panel — removes stuck PENDING/BUILDING builds whose Kubernetes CIBuild CR no longer exists; filter by build type and age threshold; orphaned index artifact versions cleaned up best-effort; backed by `POST /api/forge/api/v1/builds/zombie-cleanup` (`forge:admin:manage`)
- `zombieCleanupBuilds()` in `forgeApi.ts` — typed wrapper for `POST /api/v1/builds/zombie-cleanup` with `ZombieCleanupRequest` type (reuses `BulkDeleteBuildsResult`)

## [0.10.26] — 2026-05-27

<!-- 2026-05-27 -->
### Added
- Admin: Forge Cleanup page (`/admin/forge-cleanup`) — bulk-delete old FAILED and/or SUCCEEDED builds by type (requirements / Python Builder / Generic Builder) and age threshold; backed by `DELETE /api/forge/api/v1/builds` (`forge:builds:delete`)
- `bulkDeleteBuilds()` in `forgeApi.ts` — typed wrapper for `DELETE /api/v1/builds` with `BulkDeleteBuildsRequest` / `BulkDeleteBuildsResult` types

## [0.10.25] — 2026-05-27

<!-- 2026-05-27 -->
### Changed
- Fusion Index dashboard: removed redundant Artifact Registry table (covered by Artifact List page)

## [0.10.24] — 2026-05-27

<!-- 2026-05-27 -->
### Added
- Fusion Index dashboard: registry metrics stat cards (Total Artifacts, Versions, Tags, Storage, Files OK — turns red when file errors exist)
- Fusion Index dashboard: "By Type" panel with horizontal bar chart showing artifact count per type (top 6, sorted by count)
- `getMetrics()` API function + `RegistrySnapshot` / `MetricsTypeCount` types in `indexApi.ts` — calls `GET /api/index/q/metrics` (BFF-proxied, `index:metrics:read` permission)
- Artifact Registry table rows are now clickable (navigate to artifact detail page)

### Changed
- Compacted `CLAUDE.md` (~90 lines reduction; no information loss)

## [0.10.23] — 2026-05-26

<!-- 2026-05-26 -->
### Changed
- Navigation: renamed "Attach Step to GitOps" → "Create GitOps Run" in Pipelines Control group
- Navigation: renamed sidebar section labels "Run Blueprints" → "Run-Blueprints" and "Step Blueprints" → "Step-Blueprints" for consistency

<!-- 2026-05-25 -->
### Added
- Help system: `?` icon in activity rail utility zone navigates to `/help` full browsing page (videos grid + articles list with Diátaxis type badges, pagination, article detail dialog with rendered markdown)
- Help context panel: `?` button added to `CanvasPanel` via optional `help` prop — opens a slide-in right drawer with "This page" tab (context-sensitive articles by route + videos by service) and "Browse all" tab (search, service/type filters)
- `HelpDrawer.vue` — slide-in panel component (340 px); article detail sub-view with rendered markdown; video thumbnail cards linking to external video pages
- `useHelpDrawer` composable — `provide`/`inject` pattern wires the drawer toggle from `MainLayout` down to any `CanvasPanel` without prop-drilling
- `contentApi.ts` — `HelpArticle`, `HelpArticleDetail`, `VideoItem` types + `listHelp`, `getHelpArticle`, `listVideos` API functions
- `marked@^12` dependency for markdown rendering in help article detail views
- Global `?` help button in topbar (`AppTopBar.vue`) — toggles `HelpDrawer` from any page; highlights when drawer is open
- 44 help articles in `help/` (forge, weave, index, admin, data, monitoring) — tutorial series, how-tos, reference, and explanations; served via fusion-content pointing at fusion-spectra repo
- fusion-content repos Secret updated: `help:` source now points to `fusion-spectra` with `dir: "help"`

## [0.10.10] — 2026-05-25

<!-- 2026-05-25 -->
### Changed
- Pipelines Runs group split into **Monitoring** (Run Overview, GitOps Runs, Triggers) and **Control** (Add Trigger, Attach Step to GitOps, Edit Triggers); Running and Failed pages removed from nav (routes kept); Schedules placeholder removed; "All Runs" renamed to "Run Overview"

## [0.10.9] — 2026-05-25

<!-- 2026-05-25 -->
### Changed
- Pipelines context navigation reorganised: renamed from "Pipelines & Jobs" → "Pipelines"; consolidated 7 groups into 3 — **Runs** (running/all/failed/GitOps runs/schedules/triggers/attach), **Run Blueprints** (chains + wizards, formerly "Weave Chains"), **Step Blueprints** (job + service definitions, formerly separate "Job Templates" / "Service Templates" groups); all "templates" renamed to "blueprints" throughout labels; old placeholder Pipelines group (Active/Scheduled/Archive) removed; sidebar leaves now show full description on hover via tooltip

## [0.10.8] — 2026-05-21

<!-- 2026-05-21 -->
### Added
- GitWatcher detail page: in-flight build name is now a clickable link navigating to `/forge/appbuilds/:id` or `/forge/gitbuilds/:id` based on the `lastBuildName` prefix (`forge-app-*` / `forge-git-*`)

### Added
- Index Cleanup admin page (`/admin/index-cleanup`): three panels — Empty Artifacts, Versions Without Files, Artifacts Without Files — each with an "older than" preset selector, paginated table, and a bulk delete button with confirmation dialog showing deleted/skipped counts; gated by `index:admin:manage` permission
- `indexApi`: `listEmptyArtifacts`, `deleteEmptyArtifacts`, `listVersionsWithoutFiles`, `deleteVersionsWithoutFiles`, `listArtifactsWithoutFiles`, `deleteArtifactsWithoutFiles` admin methods; `BulkDeleteResult` type
- BFF `rbac.yaml`: `index:admin:manage` permission added to `admin` role; route rules for `GET` and `DELETE /api/index/api/v1/admin/*` before the existing read catch-all

### Fixed
- GitWatcher create and edit forms: URL validation now accepts `http://` in addition to `https://` (allows testing against local git servers)
- Builds list "All Types" mode now has server-side pagination (was capped at 50 per type with no page controls); fetches the same page from all three endpoints in parallel, merges by `createdAt` desc, and shows the standard `q-pagination` row

<!-- 2026-05-21 -->
### Added
- GitOps Watchers UI: list page (`/forge/gitwatchers`), create wizard (`/forge/gitwatchers/create`), detail page (`/forge/gitwatchers/:name`), and edit page (`/forge/gitwatchers/:name/edit`) for managing `GitWatcher` CRs that auto-trigger forge builds when a new version appears in a git repository
- `forgeApi`: `GitWatcher`, `GitWatcherSpec`, `GitWatcherStatus`, `GitWatcherPage`, `CreateGitWatcherPayload`, `UpdateGitWatcherPayload`, `SecretKeyRef` types; `listGitWatchers`, `getGitWatcher`, `createGitWatcher`, `updateGitWatcher`, `deleteGitWatcher` methods
- New "GitOps" group in the Forge sidebar with Watchers list and Add Watcher navigation entries
- Watcher create/edit form supports both `git` and `app` build types, all metadata source modes, token secret ref for private repos, enabled/disabled toggle, and Python version selection for git builds
- Watcher detail page polls every 15 s while a build is in-flight (`status.lastBuildName` non-empty); shows phase badge, enabled chip, last built version, last commit SHA, consecutive failure count, and last error

<!-- 2026-05-21 -->
### Added
- App Build wizard (`/forge/appbuilds/create`): 2-step form (repo URL + ref + project dir → review & validate & submit) backed by the new `/api/v1/appbuilds` forge endpoint; name, version, runner, and builder image resolved server-side from `metadata.yaml`
- App Build detail page (`/forge/appbuilds/:id`): two-panel layout (build info + live logs) with 5 s polling while PENDING/BUILDING; shows runner badge (orange), baseDependenciesUrl if present, and link to fusion-index artifact
- App Build type chip in Builds list (orange `#e8732a`); ALL mode now fetches requirements + git + app builds in parallel; row click routes to `/forge/appbuilds/:id`
- `forge-appbuild-create` sidebar entry (rocket icon) in the Forge Venv Builder group
- `forgeApi`: `AppBuildPayload`, `AppBuild`, `AppBuildPage` types; `listAppBuilds`, `createAppBuild`, `getAppBuild`, `getAppBuildLogs`, `validateAppBuild` functions

<!-- 2026-05-18 -->
### Added
- Home dashboard page (`/dashboard`): hero section with platform branding, 4 KPI stat tiles (artifacts, active runs, chains, forge builds), quick-access card grid linking to all contexts, and a recent activity feed; set as default landing page
- Home icon as the first entry in the activity rail; clicking navigates directly to `/dashboard` without opening the sidebar
- Logo click in the topbar navigates to `/dashboard`

### Changed
- Dashboard stat tiles now show live data (artifacts total, running runs, chain count, forge build total); each tile shows a spinner on load and `--` if its service is unavailable; all 7 API calls run in parallel with a 60 s auto-refresh timer
- Dashboard activity feed replaced with real Pipeline Runs panel: lists 8 most recent runs (phase icon, run name, chain, relative time), 24 h stat chips (ok/failed/live) in the header, and an "All →" link to `/pipelines/runs`; clicking a run row navigates to run detail
- Service Health strip added between stats and bottom grid: 4 compact clickable cards (one per service) showing live reachability + latency or override badge; left-border colour reflects status; clicking navigates to `/monitoring`
- Pipeline Runs panel: 3-tile breakdown strip added at the bottom showing Running / Failed / Succeeded counts (24 h window); each tile is a link to its respective run list page (`/pipelines/runs/running`, `/pipelines/runs/failed`, `/pipelines/runs`)
- Dashboard hero banner: subtle `↻ Ns` countdown chip (top-left corner) ticks down every second and resets to 60 after each data refresh

<!-- 2026-05-17 -->
### Added
- Run Stop action on WeaveRunsOverviewPage, WeaveRunsRunningPage, and WeaveRunDetailPage: orange stop-circle button patches `status.phase = Stopped` via the new `POST /runs/:name/stop` endpoint (keeps run history, triggers deploy-cleanup finalizer); optimistic UI update reverts on error
- Security context fields in Job Template and Service Template edit dialogs: collapsible section exposes `runAsUser`, `runAsGroup`, `fsGroup` (pod-level) and `runAsNonRoot`, `allowPrivilegeEscalation` (container-level); fields are stripped from the JSON editor and merged back on save
- Log dialog auto-refresh: polling replaces log content on each tick; configurable interval input (default 10 s, min 5 s, max 300 s); pause/resume toggle and manual refresh button in dialog header; auto-scrolls to bottom only when already pinned there; flashes the log area on each update; polling stops automatically when the dialog is closed

<!-- 2026-05-13 -->
### Fixed
- User menu dropdown in the topbar now opens correctly; removed conflicting manual `@click` toggle that was fighting Quasar's built-in `q-menu` trigger and cancelling every click

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
