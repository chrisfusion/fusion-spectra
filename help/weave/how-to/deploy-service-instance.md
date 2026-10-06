---
title: "Deploy a service instance"
summary: "Start a long-running service managed by Weave using a chain with a Deploy step."
tags:
  - weave
  - service-instance
  - deploy
routes:
  - /pipelines/services/create
  - /pipelines/services
---

## When to use this

Use a service instance when you need to run a process indefinitely —
an API server, a worker, or any service that should stay running until you
explicitly stop it.

## Prerequisites

- A chain that contains at least one `Deploy` step (backed by a Service Blueprint)
- The artifact to deploy must exist in Fusion Index with a version tagged (e.g. `stable`)
- The `weave:runs:write` permission

## Steps

1. Go to **Weave → Runs → Services** (`/pipelines/services`).
2. Click **New Service Instance**.
3. Select the **chain** with the deploy step.
4. Enter the **artifact name** from Fusion Index.
5. Enter the **tag** that points to the version to deploy (e.g. `stable`).
6. Optionally set an **ingress name** for external access.
7. Click **Create**.

Instead of an index artifact you can choose **Container image only**: the
step runs the image you enter, with ports, resources and env taken from the
Service Blueprint. See [Run a step with a custom image](run-custom-image).

## Checking health

Open the service instance detail page. Once the deploy step reaches `Deployed`,
the health panel shows the current state:

| Health | Meaning |
|---|---|
| `Healthy` | The deployment is running and passing health checks |
| `Unhealthy` | The deployment is running but failing health checks |
| `RollingBack` | The operator detected a failure and is rolling back |
| `RolledBack` | Rollback complete — running the previous version |
| `Unknown` | Health state cannot be determined |

## Rolling restart

If you move a tag in Fusion Index to a new artifact version and want the
service to pick it up, trigger a rolling restart from the detail page. The
operator replaces the running pods with a fresh deployment using the updated
image.

## Changing the image

On the deployment card, **Change image** rolls the service to a new image and
**Roll back** returns to the previous one. Both need the `weave:runs:image`
permission.

## Stopping

Click **Stop** on the detail page. The operator scales the deployment to zero
and the run phase moves to `Stopped`.
