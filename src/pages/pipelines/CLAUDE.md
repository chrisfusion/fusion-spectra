## Weave DAG (ChainDagView.vue)
- `@vue-flow/core` + `@dagrejs/dagre` installed; node click/hover events go on `<VueFlow>`, NOT inside node slot divs
- Custom node slots receive `{ data, id }` — store full step object in `node.data.step` during `buildGraph()`
- `stepKind 'Deploy'` (API value) displays as `'Service'` in spectra — always use a `displayKind()` helper; never render raw stepKind
- fusion-weave source is at `../fusion-flux`; disable auth for local dev: `kubectl set env deployment/fusion-weave-api -n fusion ALLOW_UNAUTHENTICATED=true`

## Weave run monitoring pages
- `StepPhase` includes `'Deployed'` (non-terminal) — deploy steps never reach `Succeeded`; polling must not stop on `Deployed`; `phase-badge--deployed` uses green (`--fs-pos`)
- `src/api/weaveMonitorApi.ts` — typed client for `/api/weave/monitor/v1/`; BFF catch-all `GET /api/weave/*` (permission `weave:resources:read`) already covers all monitoring GETs — no BFF changes needed
- `MONITORING_ENABLED=true` is already set on `fusion-weave-api` in minikube — monitoring API is live
- `src/composables/useRunsPolling.ts` — 10s polling composable for list pages; exports `{ polling, startPolling, stopPolling, togglePolling }`; calls `onUnmounted(stopPolling)` internally — callers don't need to
- Pages: `WeaveRunsOverviewPage` (`/pipelines/runs`), `WeaveRunsRunningPage` (`/pipelines/runs/running`), `WeaveRunsFailedPage` (`/pipelines/runs/failed`), `WeaveRunDetailPage` (`/pipelines/runs/:name`)
- Run detail log dialog: `openLogDialog(stepName)` fetches `getStepLogs()` and shows result in a `<q-dialog>` (separate from the step-info dialog); log button shown on ALL step rows regardless of `jobRef`/`deploymentRef` — show "EOF — No LOG available at moment or yet" when `lines` is empty
- Run detail polling: VenvDetailPage pattern — `setInterval` inline, stops automatically when `isTerminal(phase)` (`Succeeded | Failed | Stopped`); `onUnmounted` clears timer
- Run deletion: `DELETE /api/weave/api/v1/runs/:name` (CRUD_BASE in `weaveMonitorApi.ts`) works through the BFF proxy; no stop/cancel mechanism exists in the controller — `Stopped` phase is only set by the StopAll failure policy
- `listRuns()` returns runs in undefined order — sort by `startTime` desc client-side to get most-recent-first
- `listRuns()` returns `RunSummary[]` (monitor API, no `spec`/`activeDeployments`); use `listAllRuns()` (calls `CRUD_BASE/runs` → `{ items: WeaveRun[] }`) when full run objects are needed
- BFF permission mapping for run mutations: `weave:runs:write` = `POST /runs` (create); `weave:steps:restart` = both `POST /runs/:name/stop` (stop) AND `PATCH /runs/:name` (restart annotation); `weave:runs:delete` = `DELETE /runs/:name`
- `RunStatsResponse` also carries `successRate`, `avgDurationMs`, `minDurationMs`, `maxDurationMs` beyond the phase counts

## Service Instances (WeaveRun with stepOverrides)
- Pages: `ServiceInstanceListPage` (`/pipelines/services`), `ServiceInstanceCreatePage` (`/pipelines/services/create`), `ServiceInstanceDetailPage` (`/pipelines/services/:name`)
- `spec.stepOverrides[]` fields: `stepName`, `artifactName`, `tag`, `ingressHost?` — operator creates run-owned Deployment `<runName>-<stepName>`; always create with `POST` (not PATCH/PUT — server-side apply silently drops stepOverrides on first reconcile)
- `status.activeDeployments` — map keyed by `<runName>-<stepName>`; fields: `health`, `codeSourceDeployedVersion`, `codeSourceTag`, `codeSourceArtifact`, `unhealthyDurationSeconds?`; `health` values: `Healthy | Unhealthy | RollingBack | RolledBack | Unknown`
- Run with active deploy step stays `Running` forever until stopped — `isTerminal` must exclude `Deployed`; poll until `status.steps[serve].phase === 'Deployed'` to confirm service is live
- Run name for service instances: derive from artifact name (lowercase, replace non-DNS chars with `-`, strip leading/trailing `-`) + 4-char random suffix

## Weave API — CRUD & edit patterns
- Full CRUD on all four resource types: jobtemplates, servicetemplates, chains, triggers, runs all have `GET / POST / GET :name / PUT :name / PATCH :name / DELETE :name` via `registerCRUD()` — no BFF changes needed for any of these
- `weaveMonitorApi.ts` imports only `bffGet`/`bffDelete` by default — add `bffPatch` or `bffPost` to the import line when adding write operations (same as `bffPut` gotcha in `weaveApi.ts`)
- Rolling restart a Deploy step: `PATCH /api/weave/api/v1/runs/:name` with `{"metadata":{"annotations":{"fusion-platform.io/restart-step":"<stepName>"}}}` — annotation consumed by operator (one-shot); same pattern as `fireWeaveTrigger`
- `PUT /:name` requires `resourceVersion`: the handler calls `client.Update` which enforces K8s optimistic concurrency — always include `metadata.resourceVersion` from the fetched object in the PUT body or the server returns 409 Conflict
- K8s resource names are immutable: `metadata.name` cannot be changed via PUT; show it read-only (lock icon + tooltip "immutable in Kubernetes") in edit UIs; delete+recreate is the only rename path
- `weaveApi.ts` imports: `bffPut` is exported by `bffClient.ts` but was not initially imported in `weaveApi.ts` — add it to the import line when adding PUT operations
- Template edit dialog pattern: view mode shows `<pre>` of `JSON.stringify(t.spec, null, 2)`; edit mode swaps in `<JsonEditor>`; on save compare `newSpec.image !== t.spec.image` and show `$q.dialog` confirm before calling `updateJobTemplate` / `updateServiceTemplate`; buttons inside `q-dialog` need CSS in an unscoped `<style>` block scoped to the dialog class (e.g. `.tpl-dialog .fs-btn { ... }`)

## Advanced Chain Builder (WeaveAdvancedChainPage)
Route: `/pipelines/weave/chains/advanced`. 3-step wizard: step 1 Identity (chain name + `failurePolicy`/`concurrencyPolicy`/`sharedStorage`); step 2 Pipeline (dynamic step list left + sticky `ChainDagView` preview right, grid `1fr 340px`); step 3 Review + Submit → `createWeaveChain()`.
- `StepRow` has `uid`, `name`, `stepKind: 'Job'|'Deploy'`, `templateName`, `dependsOn`, `runOnSuccess/Failure`, `producesOutput`, `consumesOutputFrom`, `envRows`
- `handleNameInput` propagates renames to `dependsOn`/`consumesOutputFrom` across all steps; `removeStep` cleans references
- `toggleDependsOn` also removes from `consumesOutputFrom`; `toggleProducesOutput` removes step from others' `consumesOutputFrom`
- `hasCycle()` — DFS on dep→dependent adjacency list; blocks Next
- Templates loaded lazily on entering step 2 (guard: only if both lists empty — prevents re-fetch on Back+Next)
- `previewSteps` computed maps `StepRow[]` → `WeaveChainStep[]` for live DAG
- Stable v-for keys via `uid` (`++_uid`); all array mutations use spread/filter — never `.push()`/`.splice()`

## fusion-weave deployment (minikube)
- Both `fusion-weave-operator` (container: `manager`) and `fusion-weave-api` (container: `api-server`) share one image — build once, update both
- Build: `eval $(minikube docker-env) && docker build -t fusion-weave-operator:X.Y.Z /path/to/fusion-flux/`
- Deploy: `kubectl set image deployment/fusion-weave-operator manager=fusion-weave-operator:X.Y.Z -n fusion && kubectl set image deployment/fusion-weave-api api-server=fusion-weave-operator:X.Y.Z -n fusion`
- Current semver: `0.2.0` (was `latest` — do not revert to `latest`)
