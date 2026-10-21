---
title: "Inspect and change a Weave app"
summary: "See what a Weave app runs, read its logs, change its image or start a job entrypoint right away."
tags:
  - weave
  - app
  - image-override
routes:
  - /pipelines/weave/apps
---

## When to use this

A **Weave app** is one service or job that owns all its Kubernetes objects. The
Image wizards and the Git → Python wizards create one per wizard run. Open
**Weave → Runs → Monitoring → Apps** to see all of them.

## What the detail page shows

- **App** — phase, what it runs (an image, or fusion-index code on a runner
  image), the token it gets, and the wizard run that created it.
- **Service** — Deployment, port, ingress name and URL.
- **Entrypoints** (jobs) — each entrypoint with its schedule, or *on demand*.
- **Logs / Executions** — the live service log, or one log per job execution
  (kept for 24 hours; the result stays listed).

## Change the image

Image apps only: click **Change image** and enter a new image with an explicit
tag (not `latest`) or a digest, starting with one of the cluster's allowed
prefixes. A service rolls its Deployment; a job uses the image from its next
execution on.

Apps built from git have no image to change — their code follows the tag in
fusion-index, so move the tag to deploy another version.

If a wizard created the app, the wizard run still records the old image:
retrying that run may set the old image again.

## Run a job now

Click **Run now** next to an entrypoint to start it once, in addition to its
schedule. It's disabled while a previous execution of that entrypoint is still
running.
