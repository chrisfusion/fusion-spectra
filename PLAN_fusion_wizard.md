# fusion-wizard integration plan

Moves spectra's shortcut wizards from client-side orchestration (`useGitAppProvisioning.ts` calling
forge/weave directly) onto the new `fusion-wizard` backend (Go operator + REST API in the sibling repo),
which does the same GitWatcher → build → tag → jobTemplate → chain → trigger orchestration server-side,
with a ref-counted ledger, proper rollback, and `fusion-platform.io/managed-by: wizard` labels on
everything it creates.

Decisions made (2026-09-22):
- Migrated wizards render from a **generic, definition-driven page** (not one page per wizard), with an
  optional per-definition display-metadata override map for custom labels/help/widgets.
- A "Wizard Runs" monitoring page (list/retry/rollback/bulk-rollback) is **deferred** — not in this plan.
- BatchCron wizard **stays on the legacy path** — fusion-wizard's `trigger` step only supports a single
  OnDemand/Cron `WeaveTrigger`, not a list of many cron-scheduled entries. Needs new backend step-type
  work first (separate effort).
- **Migration order flipped**: `batch-git-job` is the first migrated wizard, not `python-git-job`.
  `python-git-job`'s definition can't express per-entrypoint Cron schedules (the `trigger` step's
  `type`/`schedule` apply to every `forEach`-expanded instance identically) — migrating it as-is would
  silently drop that capability from today's `GitPythonJobWizardPage`. Holding off until the step
  catalogue supports per-item type/schedule (separate backend effort, same shape as the BatchCron gap).
  `batch-git-job` had its own gap (no "fire immediately" capability) which got fixed directly (see below)
  since it was small and contained — unlike the other two, which need real new step-catalogue work.

## Phase 1 — fusion-bff proxy wiring — ✅ DONE (2026-09-22)
Code was already written and committed by the user (fusion-bff `8ed2a66`) before this session; this
session deployed and verified it end-to-end on minikube:
- Built `fusion-wizard:0.1.0` in minikube's docker daemon, `helm install fusion-wizard
  deployment/fusion-wizard -n fusion` with `config.runnerImage=fusion-runner-python312:local` and
  `api.auth.allowedServiceAccounts=["fusion/fusion-bff"]`
- Built `fusion-bff:0.11.0`, patched the `fusion-bff` ConfigMap (`WIZARD_URL`) and `fusion-bff-rbac`
  ConfigMap (synced `rbac.yaml`) by hand (no `helm upgrade` — matches the established fusion-bff gotcha),
  `kubectl set image` to roll the new image
- **Found and fixed a real auth bug**: fusion-wizard's `AUTH_AUDIENCE` must be set to `fusion-bff` —
  fusion-bff's shared upstream SA token is minted for a custom audience (`fusion-bff`), and leaving
  `AUTH_AUDIENCE` empty makes Kubernetes validate against the apiserver's own default audience instead,
  rejecting the token with a bare 401 and no server-side clue. Confirmed experimentally by toggling it
  both ways against the same live token. Fixed via `helm upgrade ... --set api.auth.audience=fusion-bff`;
  documented in fusion-wizard's `CLAUDE.md` Gotchas + `values.yaml` comment. Also added a diagnostic log
  line in `internal/apiserver/auth.go` (`Authenticate`) so a future TokenReview rejection isn't silent —
  **this is an uncommitted code change in fusion-wizard, ask before committing.**
- Verified via a real mock-OIDC BFF session (curl): `GET /api/wizard/api/v1/definitions` (200, returns
  `python-git-job`), `/runs` (200, empty list), `/resources` (200, empty list), and `GET
  /bff/system-health` shows `wizard` reachable

## Phase 1 (original plan text, superseded by the DONE summary above)
- `internal/config`: add `WIZARD_URL` (default `http://<release>-api.<namespace>.svc.cluster.local:8083`)
- Proxy handler + route registration for `/api/wizard/*`, forwarding `X-User-ID`/`X-User-Email`, mirroring
  the existing forge/index/weave proxy pattern
- `rbac.yaml` + `deployment/rbac.yaml` (keep in sync): new permissions —
  `wizard:definitions:read`, `wizard:runs:read`, `wizard:runs:write` (create/retry/rollback/delete/bulk),
  `wizard:resources:read` — added to `role_permissions` for relevant roles; `route_permissions` rules
  before the catch-all, DELETE → PUT/PATCH → POST ordering
- `internal/docs/openapi.yaml`: path items for the wizard endpoints (tag `wizard`), transcribed from
  fusion-wizard's `runView`/`definitionView`/`resourceView`/`bulkRollbackResponse` DTOs
- fusion-wizard side: add fusion-bff's SA (`fusion/fusion-bff` or whatever the real SA name is) to
  `api.auth.allowedServiceAccounts` in `deployment/fusion-wizard/values.yaml`, deploy the chart to the
  `fusion` minikube namespace
- README/ARCHITECTURE/EXAMPLE.md updates per fusion-bff's own "new upstream proxy" checklist
- CHANGELOG entry, bump fusion-bff patch/minor version
- Verify: raw curl with a real BFF session cookie through `/api/wizard/definitions` returns the
  pre-seeded `python-git-job` definition

## Phase 2 (backend prerequisite for batch-job) — ✅ DONE (2026-09-22)
fusion-wizard `4c9c175`, committed and deployed:
- Trigger step gained `fireOnCreate: "true"` — fires the trigger exactly once, only on the call that
  actually creates it (never on adopt/re-confirm/retry); new `WeaveClient.Fire`/`Weave.Fire`, test
  coverage (`TestTriggerFireOnCreate`) confirming exactly-once across create/adopt/re-ensure.
- New pre-seeded `WizardDefinition` `batch-git-job` (`definitions.batchGitJob.enabled`, default `true`):
  watcher/build/tag/template/chain/trigger, single fixed trigger (`type`/`schedule` parameterised,
  `fireOnCreate: true`) — matches `GitBatchJobWizardPage`'s shape. Chart contract test + `stepstest.BatchJob`
  reference fixture, mirroring `python-git-job`'s existing pattern.
- E2E verified on minikube: created a real run (`wizard-fw-batch-verify`) through the BFF proxy, confirmed
  a real pod ran and completed (`fireOnCreate` actually fired), confirmed `managed-by` labels on every
  created resource, deleted the run and confirmed rollback left zero leftover resources.

## Phase 3 — fusion-spectra: generic wizard-run page + Batch-job migration — ✅ DONE (2026-09-22)
- `src/api/wizardApi.ts` (mirrors `forgeApi.ts`/`weaveApi.ts` conventions):
  types `WizardDefinition`, `WizardParameter`, `WizardRun`, `WizardRunStepStatus`, `WizardResource`;
  functions `listDefinitions`, `getDefinition(name)`, `createRun(req)`, `getRun(name)`, `listRuns(filters)`,
  `retryRun(name)`, `rollbackRun(name)`, `deleteRun(name)`, `bulkRollback(req)`, `listResources(filters)`
- `src/data/wizardDisplayMeta.ts` (new, optional layer): `Record<definitionName, Record<paramName,
  { label?: string; help?: string; widget?: 'text' | 'tagChips' | 'cron' | ... }>>` — consulted by the
  generic page; a param with no entry falls back to auto-generated (title-cased name + the definition's
  own `parameter.description`)
- `src/pages/wizards/WizardRunPage.vue` (new, generic, replaces per-wizard Setup/Progress/Done pages):
  1. Setup — `getDefinition(name)`, render one field per `spec.parameters[]` keyed by `type`
     (string/number/boolean/stringList), applying display-meta overrides; client-side `pattern`/`required`
     validation before enabling Next, same as today's wizard pattern
  2. Provisioning — `createRun({definition, parameters})`, then poll `getRun(name)` (reuse the existing
     `ProgressItem`/progress-list CSS) mapping `status.steps[]` → `{key: step.key, label: <from
     definition step name or display-meta>, status: phase-mapped, detail: step.message}`; expose
     Retry (`retryRun`) when `status.phase === 'Failed'` and Rollback (`rollbackRun`) at any time
  3. Done — link to the created chain/trigger, same as today
  - Route: `/wizards/run/:definition/create` (definition name in the path); `WizardsLandingPage.vue`
    cards point here instead of a per-wizard route once migrated
- Migrate `batch-git-job` first: point its landing card at `/wizards/run/batch-git-job/create`,
  remove `GitBatchJobWizardPage.vue` + its router/nav entries once verified — **done**
- E2E verify via the browser: confirm the generic page's Setup/Progress/Done flow matches the old
  wizard's UX, and check pods/logs, not just "reached Done" — **done**. fusion-spectra:0.10.39.
  Playwright MCP tool crashes on launch (sandbox bug, see `reference_playwright_sandbox_issue.md`
  memory) — used the documented direct-`playwright-core`-script workaround instead, no MCP-layer
  re-diagnosis. Filled and submitted the real form, watched provisioning reach Ready, confirmed a real
  pod completed (`kubectl get pods`), confirmed `managed-by` labels, deleted the run and confirmed
  rollback left zero leftover resources — all through the actual browser UI, not just curl.
  `src/pages/wizards/CLAUDE.md` rewritten to document the two coexisting patterns.

## Phase 4 — python-git-job and BatchCron (blocked, separate backend effort each)
- `python-git-job`: needs the step catalogue to support per-`forEach`-item `type`/`schedule` (or an
  equivalent), not just a shared value for every expansion — before it can be migrated without losing the
  per-entrypoint OnDemand/Cron choice `GitPythonJobWizardPage` has today.
- BatchCron: needs a new step type (or a `trigger` extension) accepting a structured list parameter (many
  `{cron, params}` entries) instead of a `stringList`, plus equivalent of `weaveApi.validateBatchJobs`'s
  field-level validation. Until either lands, `GitPythonJobWizardPage.vue`/`GitBatchCronJobWizardPage.vue`
  and their parts of `useGitAppProvisioning.ts` stay as-is.

## Cleanup (after phase 3)
- `useGitAppProvisioning.ts` keeps only what python-job/BatchCron still need — do not delete the file
  outright; fusion-wizard's own CLAUDE.md already notes it's kept as a reference/proof-of-concept
- `src/pages/wizards/CLAUDE.md` gets rewritten for the new generic-page pattern once phase 3 lands
