---
title: "Deploy or schedule a container image"
summary: "Use the Image wizards to run a service, a one-shot job or a cron job from a container image."
tags:
  - weave
  - wizard
  - image-override
routes:
  - /wizards/run/image-service/create
  - /wizards/run/image-job/create
  - /wizards/run/image-cron-job/create
---

## When to use this

You already have a container image and just want it running under Weave — no git
repo, no build. The three **Image** wizards create everything needed and share one
job/service blueprint and one chain per **Base Name**, so ten images cost one
blueprint, one chain and ten runs (or triggers).

| Wizard | Creates | Starts |
|---|---|---|
| Image → Service | a long-running Deployment (optional URL) | immediately |
| Image → Job | a one-shot run | immediately |
| Image → Cron Job | a Cron trigger | on the schedule |

## Steps

1. Open **Wizards** and pick the wizard.
2. Enter a **Base Name** (reuse it to share the blueprint and chain) and a
   **Service Name** / **Job Name** for this instance.
3. Enter the **Image** — an explicit tag (not `latest`) or a digest, starting with
   one of the allowed prefixes shown under the field.
4. Service: set the **Port** and, optionally, an **Ingress Name** for a URL.
   Cron Job: pick the **Schedule**.
5. Click **Create** and follow the run on its detail page.

Rolling back the wizard run removes what it created; shared blueprints and chains
stay until the last user is gone.

To change a running service's image later, use **Change image** on its
[service instance](deploy-service-instance) page.
