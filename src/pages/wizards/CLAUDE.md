## Two wizard patterns coexist (migration in progress, see `PLAN_fusion_wizard.md`)

**Generic, backend-driven (`WizardRunPage.vue`, `/wizards/run/:definition/create`)** — the target pattern.
Provisioning is a real `fusion-wizard` backend `WizardRun` (ledger-backed rollback/retry), not client-side
orchestration. The Setup form renders itself from the `WizardDefinition`'s own `spec.parameters` — a new
definition needs **zero** frontend code. To add one: create the `WizardDefinition` in
`fusion-wizard/deployment/fusion-wizard/templates/definitions/` (toggle in `values.yaml`, matching
`stepstest.*` reference fixture + chart contract test — see that repo's `CLAUDE.md`), then point a
`WizardsLandingPage.vue` card / `navigation.ts` leaf at `/wizards/run/<definition-name>/create`. Only add
an entry to `src/data/wizardDisplayMeta.ts` when the auto-generated label/widget genuinely needs help
(friendlier label, `select`/`cron`/`tags` widget instead of plain text, or a field that should only show
conditionally via `showIf`) — it's optional, not required. **Git → Batch Job** uses this pattern
(`batch-git-job` definition).

**Legacy, client-side-orchestrated (per-wizard `.vue` page)** — still used by **Git → Python Job** and
**Git → BatchCron Job**, blocked from migrating by real fusion-wizard step-catalogue gaps (no per-`forEach`
-item trigger type/schedule; no batch/many-cron-entries trigger step — see `PLAN_fusion_wizard.md`).
One-pagers that compose several Forge/Weave primitives into a ready-to-use setup. Steps: Setup →
Provisioning → Done (`step: ref<1|2|3>`), same `.wizard-steps`/`.form-body`/`.progress-list` CSS as
`GitPythonJobWizardPage.vue` — copy its `<style scoped>` block verbatim for a new wizard of this kind (or
copy `WizardRunPage.vue`'s equivalent block, which is the same CSS, if the new wizard fits the generic
pattern instead — prefer that when it does).

Shared provisioning (GitWatcher → build → `"stable"` tag → job blueprint → chain) lives in `src/composables/useGitAppProvisioning.ts` — use it, don't re-implement, for a *new legacy-pattern* wizard. Wizard-specific trigger creation stays in the page itself.

Wire-up for a new legacy-pattern wizard: card in `WizardsLandingPage.vue`, nav leaf in `navigation.ts` under `wizards-available`, route in `router/index.ts`.

**Gotchas (found 2026-09-10, fixed in `useGitAppProvisioning.ts`):**
- `codeSource.artifactName` must be `app.<AppBuild.name>`, not the raw build name — see fusion-spectra/CLAUDE.md's API clients section.
- Don't poll GitWatcher's `status.lastBuildName` for build completion — it's transient and can clear before your first poll on a fast build. Query `forgeApi.listAppBuilds({name})` and pick the highest `id` instead.
- A "wizard reaches Done" browser walkthrough does NOT prove the underlying job actually runs — verify with `kubectl get pods -n fusion | grep <name>` and check logs before calling a wizard done.
- (found 2026-09-13) `waitForBuild` must finish by polling `forgeApi.getAppBuild(id)`, not just `listAppBuilds()` — fusion-forge's `GET /appbuilds` list reads Postgres directly with no sync; only `GET /appbuilds/:id` lazily syncs the CIBuild CR's status into the DB row. Polling list alone can hang forever even after the build actually succeeds.
- For a trigger type whose entries fire on their own internal schedule (e.g. `BatchCron`), skip the generic one-shot fire annotation in the wizard's Done step — it runs through an unrelated code path (`maybeCreateRun`) that creates a bare run with none of that type's contextual env vars.
