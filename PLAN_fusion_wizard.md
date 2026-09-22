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

## Phase 4a — BatchCron backend — ✅ DONE (2026-09-22)
fusion-wizard: new `batchTrigger` step type, creating a single BatchCron `WeaveTrigger` through weave's
dedicated `POST /api/v1/batchtriggers` (generic trigger endpoint can't carry an inline job list). `jobs`
is opaque text, passed straight through — weave validates it at creation (loses the old wizard's
field-level pre-validation UI, documented as an accepted gap). Managed-by labels stamped via a follow-up
`PatchLabels` call (dedicated create endpoint has no labels field) — verified empirically that weave
accepts a labels-only merge-patch on the generic trigger PATCH endpoint. New `batchcron-git-job`
`WizardDefinition`. E2E verified on minikube: created a real run, confirmed the BatchCron trigger + jobs
ConfigMap, confirmed `managed-by` labels, waited for the `* * * * *` entry to fire on its own schedule
(not a one-shot fire — BatchCron never uses `fireOnCreate`), confirmed the fired pod's `JOB_*` env vars
matched the submitted entry, then deleted the run and confirmed zero leftover resources.

Frontend wiring — ✅ DONE (fusion-spectra 0.10.40): new `textarea` widget in `WizardRunPage.vue` +
`wizardDisplayMeta.ts`, per-definition `shortTitle` override (`wizardTitleOverrides`, since
"batchcron-git-job" auto-title-cases to "Batchcron" not "BatchCron"), Done-step trigger-link matching
fixed to include the `batchTrigger` step type (was only checking `type === 'trigger'`). Migrated onto
`/wizards/run/batchcron-git-job/create`; old `GitBatchCronJobWizardPage.vue` removed. `useGitAppProvisioning.ts`
is now used by only one remaining wizard (Python Job). No file-upload affordance for the jobs blob
(paste only) and no client-side field-level pre-validation before submit — both accepted gaps, documented
in the 0.10.40 CHANGELOG entry.

E2E verified via the browser (direct-Playwright-script workaround): filled and submitted the real form,
reached Ready, confirmed View Chain/View Trigger links. Second fire-on-schedule confirmation was
inconclusive due to `fusion-weave-operator` (a different repo, fusion-flux) OOMKilling and crash-looping
in this shared minikube cluster — unrelated to this work. The `batchTrigger` step itself was already
proven correct by an earlier clean curl-based test (real pod fired with correct `JOB_*` env vars) before
that started happening. Not investigated further — out of scope, a different repo's infra issue.

## Phase 4b — python-git-job per-entrypoint schedule: backend — ✅ DONE (2026-09-22)
fusion-wizard gained the `objectList` parameter type (JSON array of flat string-keyed objects, every
entry needs a non-empty `"key"` field) and `${item.<field>}` placeholder syntax alongside the existing
bare `${item}` (which keeps meaning "the entry's `key` field" — fully backward compatible, no other
definition needed to change). Touched `internal/params` (`Context.ItemFields`, `parseRef`, `lookup`,
`ResolveList` now returns `[]ForEachItem{Key, Fields}`), `internal/plan` (`Instance.ItemFields`),
`internal/controller` (threaded through), `internal/steps/catalog.go` (`ValidateDefinition` accepts
objectList as a forEach source). Every object entry needs all fields present (empty string, not
omitted) — no implicit per-field defaults; referencing a field an entry omits is an `UnresolvedError`.

`python-git-job`'s `entrypoints` parameter is now `objectList` (`key`/`type`/`schedule` per entry); its
trigger step's `type`/`schedule` params reference `${item.type}`/`${item.schedule}`. New
`internal/controller.TestMixedOnDemandAndCronEntrypoints` proves it at the reconciler level. E2E verified
on minikube: created a real run with one `OnDemand` and one `Cron` (`0 9 * * *`) entrypoint, confirmed
the two resulting `WeaveTrigger`s have independently correct `type`/`schedule`, deleted the run and
confirmed zero leftover resources.

**Found along the way, fixed in the same pass:** `python-git-job`'s `gitWatcher` step was never wired
with a `projectDir` param, unlike `batch-git-job`/`batchcron-git-job` — the original (pre-Phase-4b)
definition just never carried it over from `GitPythonJobWizardPage`'s "Subfolder" field. Added
`projectDir` (default `""`, matching the other two), wired into the watcher step, in both
`stepstest.PythonJob()` and the chart YAML. E2E verified: a real run using
`projectDir: testcases_v2/app-builds/etl-pipeline` built successfully and the `GitWatcher`'s spec shows
the projectDir correctly set.

## Phase 4b — python-git-job per-entrypoint schedule: frontend — ✅ DONE (fusion-spectra 0.10.41)
New `objectRows` widget (`wizardDisplayMeta.ts`: `WizardRowField`, `rowFields`, `keyPlaceholder`;
`WizardRunPage.vue`: `ObjectRow` type, `newRowKey`/`newRowKeyError` state, `addRow`/`removeRow`) — a
repeatable per-entry row editor (add-row text input + declared sub-fields, e.g. a `select` type toggle
and a conditionally-shown `CronPicker`), reusing the original wizard's `entry-add`/`entry-row`/
`kind-toggle` CSS verbatim. Migrated onto `/wizards/run/python-git-job/create`; old
`GitPythonJobWizardPage.vue` removed. `useGitAppProvisioning.ts` is no longer imported by any wizard
(kept in place per fusion-wizard's own CLAUDE.md note). `src/pages/wizards/CLAUDE.md` rewritten — the
generic pattern is now the only one any current wizard uses.

E2E verified in a **headed, visible** browser (user asked to watch it live): filled the form including
adding two entrypoints via the new row editor (one Manual, one switched to Cron with the CronPicker's
default daily-09:00), submitted, reached Ready with both "View Trigger" links. Confirmed via `kubectl`
that the two resulting `WeaveTrigger`s have independently correct `type`/`schedule` (`OnDemand` /
`Cron 0 9 * * *`) and `managed-by` labels, then deleted the run and confirmed zero leftover resources.

**All three "Git → X" shortcut wizards are now fully migrated onto the generic, backend-driven pattern.**

**Open UX gap surfaced by the user while testing (not yet decided/scoped):** `WizardRunPage.vue` only
polls a run while mounted — the run name/progress live in local component state, not the URL or any
store. Navigating away and back loses track of an in-progress run entirely (the backend run itself is
unaffected). Two options discussed, decision deferred: (a) a full "Wizard Runs" list/monitoring page
(the originally-deferred work from the top of this plan) or (b) a smaller URL-param resume
(`?run=<name>` during Provisioning/Done, so reopening that exact link resumes polling). Revisit before
calling the wizard migration fully "done" from a UX standpoint.

## Cleanup (after phase 3)
- `useGitAppProvisioning.ts` keeps only what python-job/BatchCron still need — do not delete the file
  outright; fusion-wizard's own CLAUDE.md already notes it's kept as a reference/proof-of-concept
- `src/pages/wizards/CLAUDE.md` gets rewritten for the new generic-page pattern once phase 3 lands
