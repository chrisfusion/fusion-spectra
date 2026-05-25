---
title: "Set up a GitOps Poller"
summary: "Configure Forge to automatically rebuild an artifact whenever you push to a Git repository."
tags:
  - forge
  - gitops
  - automation
  - poller
routes:
  - /forge/gitwatchers
  - /forge/gitwatchers/create
  - /forge/gitops-builder/create
---

## When to use this

Use a GitOps Poller when you want builds to trigger automatically on every
push, without manual submissions. This is the recommended pattern for any
artifact that is deployed continuously.

## Prerequisites

- A working one-off build for the same repository (verify it builds before automating)
- A Kubernetes Secret in the `fusion` namespace containing a personal access
  token, if the repository is private
- The `forge:builds:create` permission

## Steps

1. Go to **Forge → Builder → GitOps Builder** (`/forge/gitops-builder/create`).
2. Configure the build on step 1 exactly as you would for a one-off build.
3. On step 2 (GitOps Polling), toggle **Enable GitOps Polling** on.
4. Enter a **Poller name** (lowercase, hyphens only — it becomes a Kubernetes resource name).
5. Leave **Active** checked to start polling immediately.
6. If the repo is private, enter the name of the Kubernetes Secret in **Token secret**.
7. Review the summary on step 3 and click **Submit**.

## Verifying the poller is active

Go to **Forge → Monitoring → GitOps Builds** (`/forge/gitwatchers`). The new
poller appears in the list. Click it to open the detail page, which shows
the poll status, last triggered time, and any recent build history.

## Pausing and resuming

Open the poller detail page and click **Edit**. Toggle **Active** off to pause.
The resource remains but no new builds are triggered until you re-enable it.

## Private repositories

Create the token secret before setting up the poller:

```sh
kubectl -n fusion create secret generic my-repo-token \
  --from-literal=token=ghp_yourtoken
```

Then enter `my-repo-token` in the **Token secret** field of the wizard.
