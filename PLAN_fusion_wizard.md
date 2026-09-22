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

## Phase 2 — fusion-spectra: generic wizard-run page + Python-job migration
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
- Migrate `python-git-job` first: point its landing card at `/wizards/run/python-git-job/create`,
  remove `GitPythonJobWizardPage.vue` + its router/nav entries once verified
- E2E verify on minikube: real GitWatcher/build/template/chain/trigger created, `managed-by` labels
  present via `kubectl get -o yaml`, same functional outcome as the old wizard (per the existing
  "wizard reaching Done doesn't prove the job runs" gotcha — check pods/logs too)

## Phase 3 — batch-job definition + migration
- Add `batch-git-job` `WizardDefinition` to `deployment/fusion-wizard/templates/definitions/` (new file,
  toggled via `values.yaml` `definitions.batchGitJob.enabled`): same step shape as `python-git-job` but a
  single fixed trigger (no `forEach`) — fits the existing catalogue, no fusion-wizard Go changes needed
- Migrate `GitBatchJobWizardPage.vue` the same way as phase 2; remove the old page once verified

## Phase 4 — BatchCron (blocked, separate effort)
- Needs a new fusion-wizard step type (or an extension of `trigger`) accepting a structured list
  parameter (many `{cron, params}` entries) instead of a `stringList`, plus equivalent of
  `weaveApi.validateBatchJobs`'s field-level validation. Until then `GitBatchCronJobWizardPage.vue` and
  the BatchCron parts of `useGitAppProvisioning.ts` stay as-is.

## Cleanup (after phase 3)
- `useGitAppProvisioning.ts` keeps only what BatchCron still needs (or nothing, if BatchCron gets its own
  minimal inline logic) — do not delete the file outright; fusion-wizard's own CLAUDE.md already notes
  it's kept as a reference/proof-of-concept
- `src/pages/wizards/CLAUDE.md` gets rewritten for the new generic-page pattern once phase 2 lands
