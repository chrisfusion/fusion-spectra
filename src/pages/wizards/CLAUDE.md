## Shortcut wizard pattern: generic, backend-driven

All three "Git → X" shortcut wizards (Batch Job, BatchCron Job, Python Job) run through
`WizardRunPage.vue` (`/wizards/run/:definition/create`) against a real `fusion-wizard` backend
`WizardDefinition` — ledger-backed provisioning with real rollback/retry, not client-side
orchestration. The Setup form renders itself from the `WizardDefinition`'s own `spec.parameters` — a
new definition needs **zero** frontend code by default.

To add a new wizard of this kind:
1. Create the `WizardDefinition` in `fusion-wizard/deployment/fusion-wizard/templates/definitions/`
   (toggle in `values.yaml`, matching `stepstest.*` reference fixture + chart contract test — see
   that repo's `CLAUDE.md` for the step catalogue and gotchas)
2. Point a `WizardsLandingPage.vue` card / `navigation.ts` leaf at
   `/wizards/run/<definition-name>/create` — no new route needed, the generic one is parametric
3. Only add an entry to `src/data/wizardDisplayMeta.ts` when the auto-generated label/widget
   genuinely needs help (friendlier label, a `select`/`cron`/`tags`/`textarea`/`objectRows` widget
   instead of plain text, a field that should only show conditionally via `showIf`, or a short-title
   override in `wizardTitleOverrides` for a definition name that doesn't title-case naturally) — it's
   optional, not required

**`objectRows` widget** (used by `python-git-job`'s `entrypoints`): the UI counterpart of an
`objectList` parameter — a repeatable list of small rows (add-row text input + per-row sub-fields
declared in `WizardFieldDisplayMeta.rowFields`, e.g. a `select` type toggle and a conditionally-shown
`CronPicker`). Each row is a plain object keyed by field name, always including `"key"` (the row's
identity, matching the backend's `objectList` convention — see fusion-wizard's `CLAUDE.md`). This is
the one widget so far with real per-row structure; every other widget is a single value.

**Known gaps vs. the old client-side wizards** (accepted, not fixed): no field-level pre-validation
before submit (a malformed input now fails at creation with the backend's own error message, not a
rich inline check) and no file-upload affordance for `batchcron-git-job`'s jobs blob (paste only). See
`PLAN_fusion_wizard.md` for the full history of what moved and why.

## Legacy pattern (historical reference only, not used by any current wizard)

`src/composables/useGitAppProvisioning.ts` is the client-side orchestration (GitWatcher → build →
`"stable"` tag → job blueprint → chain) every wizard used before migrating onto the pattern above. Kept
in place per fusion-wizard's own `CLAUDE.md` note ("kept as a reference/proof-of-concept"), not deleted
— but nothing currently imports it. Do not build a new wizard against it; use the generic pattern.

**Gotchas from that era** (useful if `useGitAppProvisioning.ts` is ever revived or referenced):
- `codeSource.artifactName` must be `app.<AppBuild.name>`, not the raw build name — see fusion-spectra/CLAUDE.md's API clients section.
- Don't poll GitWatcher's `status.lastBuildName` for build completion — it's transient and can clear before your first poll on a fast build. Query `forgeApi.listAppBuilds({name})` and pick the highest `id` instead.
- A "wizard reaches Done" browser walkthrough does NOT prove the underlying job actually runs — verify with `kubectl get pods -n fusion | grep <name>` and check logs before calling a wizard done. (This still applies to the generic pattern too.)
- `waitForBuild` must finish by polling `forgeApi.getAppBuild(id)`, not just `listAppBuilds()` — fusion-forge's `GET /appbuilds` list reads Postgres directly with no sync; only `GET /appbuilds/:id` lazily syncs the CIBuild CR's status into the DB row. Polling list alone can hang forever even after the build actually succeeds. (fusion-wizard's `waitBuild` step has its own version of this fix.)
- For a trigger type whose entries fire on their own internal schedule (e.g. `BatchCron`), skip the generic one-shot fire annotation — it runs through an unrelated code path that creates a bare run with none of that type's contextual env vars. (fusion-wizard's `batchTrigger` step never sets `fireOnCreate` for the same reason.)
