---
title: "Weave basics — 5. Deploy a service instance"
summary: "Create a service instance to run a long-lived service managed by the Weave operator."
tags:
  - weave
  - service-instance
  - deploy
  - series:weave-basics
routes:
  - /pipelines/services
  - /pipelines/services/create
  - /pipelines/services/:name
---

## What you will learn

- What a service instance is and how it differs from a batch run
- How to create a service instance
- How to check that the deployed service is healthy

## What is a service instance?

A **service instance** is a specialised Weave run backed by a chain that
contains a `Deploy` step. Instead of running to completion, the deploy step
stays active indefinitely — Weave keeps the underlying Kubernetes Deployment
running and monitors its health.

Use service instances for APIs, background workers, and any process that
should run until explicitly stopped.

## Prerequisites

- A chain with at least one `Deploy` step and a Service Blueprint
- The artifact you want to deploy must be in Fusion Index and tagged
- The `weave:runs:write` permission

## Step 1 — Open the Service Instances page

Go to **Weave → Runs → Services** (`/pipelines/services`) and click
**New Service Instance**.

## Step 2 — Fill in the instance details

**Chain** — select the chain that contains the `Deploy` step.

**Artifact name** — the Fusion Index artifact to deploy.

**Tag** — the artifact tag to use (e.g. `stable`). Weave resolves the tag to
a specific version at deploy time. If you later move the tag to a new version,
you need to trigger a rolling restart to pick it up.

**Ingress host** — optional. Set this if the deployed service should be
reachable via the cluster ingress at a custom hostname.

## Step 3 — Submit

Click **Create**. Weave creates the run and begins executing the chain. The
service instance detail page opens automatically.

## Step 4 — Wait for Deployed status

The `Deploy` step moves from `Pending → Running → Deployed`. The overall run
phase stays `Running` (a `Deployed` step is not terminal — the run continues
as long as the service is up).

When the deploy step reaches `Deployed`, the **Health** field in the detail
panel shows the service's current health state (`Healthy`, `Unhealthy`, etc.).

## Stopping a service instance

On the service instance detail page, click **Stop**. Weave signals the
operator to scale down the deployment and marks the run as `Stopped`.

---

**Series: Weave basics**
[← 4. Monitor a run](weave-basics-04-monitor-runs) · **5. Deploy a service instance**
