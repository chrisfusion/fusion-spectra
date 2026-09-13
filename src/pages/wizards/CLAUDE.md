## Shortcut wizard pattern
One-pagers that compose several Forge/Weave primitives into a ready-to-use setup. Steps: Setup → Provisioning → Done (`step: ref<1|2|3>`), same `.wizard-steps`/`.form-body`/`.progress-list` CSS as `GitPythonJobWizardPage.vue` — copy its `<style scoped>` block verbatim for a new wizard.

Shared provisioning (GitWatcher → build → `"stable"` tag → job blueprint → chain) lives in `src/composables/useGitAppProvisioning.ts` — use it, don't re-implement. Wizard-specific trigger creation stays in the page itself.

Wire-up for a new wizard: card in `WizardsLandingPage.vue`, nav leaf in `navigation.ts` under `wizards-available`, route in `router/index.ts`.

**Gotchas (found 2026-09-10, fixed in `useGitAppProvisioning.ts`):**
- `codeSource.artifactName` must be `app.<AppBuild.name>`, not the raw build name — see fusion-spectra/CLAUDE.md's API clients section.
- Don't poll GitWatcher's `status.lastBuildName` for build completion — it's transient and can clear before your first poll on a fast build. Query `forgeApi.listAppBuilds({name})` and pick the highest `id` instead.
- A "wizard reaches Done" browser walkthrough does NOT prove the underlying job actually runs — verify with `kubectl get pods -n fusion | grep <name>` and check logs before calling a wizard done.
- (found 2026-09-13) `waitForBuild` must finish by polling `forgeApi.getAppBuild(id)`, not just `listAppBuilds()` — fusion-forge's `GET /appbuilds` list reads Postgres directly with no sync; only `GET /appbuilds/:id` lazily syncs the CIBuild CR's status into the DB row. Polling list alone can hang forever even after the build actually succeeds.
- For a trigger type whose entries fire on their own internal schedule (e.g. `BatchCron`), skip the generic one-shot fire annotation in the wizard's Done step — it runs through an unrelated code path (`maybeCreateRun`) that creates a bare run with none of that type's contextual env vars.
