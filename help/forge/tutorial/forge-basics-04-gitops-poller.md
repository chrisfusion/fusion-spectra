---
title: "Forge basics — 4. Automate builds with the GitOps Poller"
summary: "Set up a GitOps Poller so Forge automatically rebuilds your artifact whenever you push to your repository."
tags:
  - forge
  - gitops
  - automation
  - series:forge-basics
routes:
  - /forge/gitwatchers
  - /forge/gitops-builder/create
---

## What you will learn

- What the GitOps Poller is and how it works
- How to create a poller through the GitOps Builder wizard
- How to enable, disable, and delete a poller

## What is the GitOps Poller?

The GitOps Poller (internally called a GitWatcher) monitors a Git repository
on a configurable schedule. When it detects a new commit on the tracked branch,
it automatically submits a build job — the same as you would do manually, but
triggered by the push.

This is the recommended approach for production services: push to Git, and
Forge handles the build without any manual steps.

## Step 1 — Open the GitOps Builder and enable polling

Go to **Forge → Builder → GitOps Builder** (`/forge/gitops-builder/create`).

Complete step 1 (Build) exactly as you would for a manual build — choose type,
enter repo URL, branch, and project directory.

On **step 2 (GitOps Polling)**, toggle **Enable GitOps Polling** on.

## Step 2 — Configure the poller

**Poller name** — a unique DNS-safe name for this poller (e.g. `my-service-poller`).

**Active** — leave checked to start polling immediately after creation.
Uncheck if you want to create the poller in a paused state.

**Token secret** — if your repository is private, enter the name of the
Kubernetes Secret that holds your personal access token. The Forge operator
reads tokens from Secrets in the `fusion` namespace. Leave blank for public
repos.

## Step 3 — Review and submit

Step 3 shows a full summary: build config, polling config, and the derived
build type. Click **Submit**.

Forge creates the GitWatcher resource. The poller appears in
**Forge → Monitoring → GitOps Builds** (`/forge/gitwatchers`).

## Managing your poller

On the GitOps Builds list, click a poller row to open its detail page. From
there you can:

- **Edit** — change the branch, interval, or active state
- **Pause / resume** — toggle the `active` field without deleting the poller
- **Delete** — remove the poller entirely (does not delete past builds)

## Tip: start with manual, then automate

It is good practice to verify your build works as a manual one-off before
enabling the poller. That way you catch configuration errors without waiting
for the poll cycle.

---

**Series: Forge basics**
[← 3. Build from a Git repository](forge-basics-03-python-builder) · **4. Automate with GitOps Poller**
