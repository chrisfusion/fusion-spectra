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
repo, no build. Each **Image** wizard run creates one **Weave app** that owns
everything it needs (Deployment, Service, Ingress or Jobs). Nothing is shared
between runs, so ten images are ten independent apps.

| Wizard | Creates | Starts |
|---|---|---|
| Image → Service | a service app: Deployment + Service, optional URL | immediately |
| Image → Job | a job app with one job | immediately, once |
| Image → Cron Job | a job app with a schedule | on every schedule tick |

## Steps

1. Open **Wizards** and pick the wizard.
2. Enter a **Service Name** / **Job Name** — the name of the app (and of a
   service's Deployment).
3. Enter the **Image** — an explicit tag (not `latest`) or a digest, starting with
   one of the allowed prefixes shown under the field.
4. Service: set the **Port** and, optionally, an **Ingress Name** for a URL
   (only the name part — the cluster domain is added automatically).
   Cron Job: pick the **Schedule** (6 fields, seconds first).
5. Click **Create** and follow the run on its detail page; the **Logs** panel
   shows the app's output.

Rolling back the wizard run deletes the app and everything it owns.

To run a different image, roll back the run and start a new one with the new image.
