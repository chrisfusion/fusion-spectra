## Fusion Forge pages
- `src/api/forgeApi.ts` — typed forge API via BFF proxy path `/api/forge/api/v1/*`
- `src/pages/forge/ForgeIndexPage.vue` — placeholder dashboard
- `src/pages/forge/VenvCreatePage.vue` — 2-step wizard: package info → requirements.txt upload + live validation
- `src/pages/forge/VenvListPage.vue` — unified Builds list (venv + git + app); build-type chips (ALL/requirements/git/app); ALL mode = server-side paginated (fetches same `page`/`pageSize` from all three in parallel, merges by `createdAt` desc, slices to `PAGE_SIZE`, total = sum of all three); per-type mode = server-side pagination; `openBuild()` routes by `b.buildType`
- `src/pages/forge/VenvDetailPage.vue` — two-panel: metadata (left) + logs (right); auto-polls every 5s while PENDING/BUILDING; stops on terminal status or unmount; auto-scrolls logs to bottom
- `src/pages/forge/GitBuildCreatePage.vue` — 2-step wizard (Repository → Review & Submit); metadata_source toggle controls field visibility: `full`→hide both name+version, `version`→show name only, `manual`→show both; `buildPayload()` omits name for `full`, omits version for non-`manual`
- `src/pages/forge/AppBuildCreatePage.vue` — 2-step wizard (Repository → Review & Submit); only 3 inputs: `repo_url` (required), `repo_ref` (default main), `project_dir` (optional); name/version/runner resolved server-side from `metadata.yaml`; `validateAppBuild` on step 2
- `src/pages/forge/AppBuildDetailPage.vue` — same two-panel polling pattern as GitBuildDetailPage; shows `runner` as an orange badge (#e8732a) and `baseDependenciesUrl` when present

## fusion-forge API quirks
- Forge admin endpoints: `DELETE /builds` (`forge:builds:delete`) bulk-deletes FAILED/SUCCESS builds; `POST /builds/zombie-cleanup` (`forge:admin:manage`, admin-only) removes stuck PENDING/BUILDING builds whose CIBuild CR no longer exists — both return `BulkDeleteBuildsResult { deleted: number[], failed: BulkDeleteFailure[] }` (note `deleted` is an **array of IDs**, unlike `indexApi` which returns a count)
- `forge:admin:manage` is stricter than `forge:builds:delete` — only the `admin` role has it; data-engineer and other operator roles do not; gate zombie cleanup with `can('forge:admin:manage')`, not `can('forge:builds:delete')`
- Backend returns `SUCCESS` not `SUCCEEDED` — `normalizeStatus()` in `forgeApi.ts` normalizes on read; `denormalizeStatus()` converts back for filter query params
- `validateVenv` uses raw `fetch` (not `bffFetch`) — forge returns meaningful `ValidationResult` JSON on 422, but `bffFetch` throws and consumes the body
- `validateGitBuild` uses the same raw fetch pattern; `GitBuildPayload` fields are snake_case: `repo_url`, `repo_ref`, `metadata_source`, `entrypoint_file`, `project_dir`
- `validateAppBuild` uses the same raw fetch pattern; `AppBuildPayload` fields are snake_case: `repo_url`, `repo_ref`, `project_dir` — name/version/runner NOT in payload (resolved server-side from `metadata.yaml`)
- `AppBuild` response adds `runner: string | null`, `baseDependenciesUrl: string | null` on top of base `VenvBuild`; both may be absent — always guard with `?? null`
- Git builds use a fully separate endpoint `/api/forge/api/v1/gitbuilds` — the venvs endpoint has no `buildType` filter; route requests by selected type
- App builds use `/api/forge/api/v1/appbuilds` — same conventions as gitbuilds; BFF catch-all `GET /api/forge/*` (permission `forge:builds:read`) covers all new GET endpoints automatically; new POST/validate endpoints need explicit entries in `rbac.yaml` before the catch-all
- `metadata_source` payload rules: `full`→omit name+version (forge reads both from pyproject.toml); `version`→send name only (forge reads version); `manual`→send both
- Multi-value query params: use `q.append('status', s)` per value, not `q.set()`

## Forge navigation (navigation.ts)
Context `forge` has two section-based groups:
- Section **Monitoring** / group **Monitoring**: Build Overview → `/forge/venvs`, GitOps Builds → `/forge/gitwatchers`
- Section **Build** / group **Builder**: Create Venv → `/forge/venvs/create`, GitOps Builder → `/forge/gitops-builder/create`

Delinked (nav entries removed, routes kept for existing edit links): `/forge/gitbuilds/create` → `GitBuildCreatePage`, `/forge/appbuilds/create` → `AppBuildCreatePage`, `/forge/gitwatchers/create` → `GitWatcherCreatePage`

Forge routes (`router/index.ts`): `/forge` → `ForgeIndexPage`, `/forge/venvs` → `VenvListPage`, `/forge/venvs/create` → `VenvCreatePage`, `/forge/venvs/:id` → `VenvDetailPage`, `/forge/gitbuilds/create` → `GitBuildCreatePage`, `/forge/gitbuilds/:id` → `GitBuildDetailPage`, `/forge/appbuilds/create` → `AppBuildCreatePage`, `/forge/appbuilds/:id` → `AppBuildDetailPage`, `/forge/gitwatchers/create` → `GitWatcherCreatePage`, `/forge/gitwatchers/:name/edit` → `GitWatcherEditPage`, `/forge/gitwatchers/:name` → `GitWatcherDetailPage`, `/forge/gitwatchers` → `GitWatcherListPage`, `/forge/gitops-builder/create` → `GitOpsBuilderPage`, `/forge/:pathMatch(.*)*` → `ForgeIndexPage`

## GitOps Builder (forge)
- `src/pages/forge/GitOpsBuilderPage.vue` — 3-step wizard at `/forge/gitops-builder/create`; replaces the separate Git Build, App Build, and Add Watcher create wizards as the single entry point
- Step 1 (Build): type toggle + repo config + Python-specific fields; Step 2 (GitOps Polling): toggle — off = one-off build, on = poller config (name, active, token secret); Step 3 (Review & Submit)
- Submit: polling OFF + Python Builder → `createGitBuild()`; polling OFF + Generic Builder → `createAppBuild()`; polling ON → `createGitWatcher()`
- Terminology: `buildType: 'git'` displays as **Python Builder**; `buildType: 'app'` displays as **Generic Builder**; "watcher" / "GitWatcher" is referred to as **GitOps Poller** throughout the UI
- Old wizards (`GitBuildCreatePage`, `AppBuildCreatePage`, `GitWatcherCreatePage`) are delinked from nav but routes kept — `GitWatcherEditPage` still links to edit flow; do not delete until edit flow is fully migrated

## fusion-forge deployment (minikube)
- Two separate K8s deployments share one image: `fusion-forge-server` (container: `server`) and `fusion-forge-operator` (container: `operator`)
- minikube uses `:local` tags: `eval $(minikube docker-env) && make docker-build IMG=fusion-forge:local` then `kubectl rollout restart deployment/fusion-forge-server deployment/fusion-forge-operator -n fusion`
- When `builder/main.go` changes, ALSO rebuild the builder image separately: `make docker-build-builder BUILDER_IMG=fusion-venv-builder:local` — `make docker-build` never touches it
- `helm upgrade fusion-forge deployment/ -n fusion` applies RBAC, ConfigMap, and other template changes; run after any chart-level change (not just image changes)
