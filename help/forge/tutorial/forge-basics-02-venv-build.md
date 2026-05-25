---
title: "Forge basics — 2. Create your first venv build"
summary: "Submit a Python venv build from a requirements.txt file and track it through to completion."
tags:
  - forge
  - venv
  - quickstart
  - series:forge-basics
routes:
  - /forge/venvs/create
  - /forge/venvs
---

## What you will learn

- How to prepare a `requirements.txt` for a venv build
- How to submit the build through the wizard
- How to read the build detail page and access logs

## Prerequisites

- A `requirements.txt` file listing the Python packages you need
- The `forge:builds:create` permission on your account

## Step 1 — Open the GitOps Builder

Navigate to **Forge → Builder → GitOps Builder** in the sidebar, or go directly to `/forge/gitops-builder/create`.

On **step 1 (Build)**, set **Build type** to **Venv (requirements.txt)**.

## Step 2 — Upload your requirements file

The wizard shows a file drop zone. Either drag your `requirements.txt` onto
it, or click to browse. A live validation panel appears and shows you any
package resolution errors before you submit.

Common issues caught at this stage:

- Unknown package names
- Version conflicts between pinned packages
- Packages not available on the configured registry

Fix any errors in your `requirements.txt` and re-upload. The validation panel
updates immediately.

## Step 3 — Review and submit

Click **Next** to reach the review step. You will see:

- The package count from your file
- The build type confirmed as `requirements`

Click **Submit**. Forge creates the build job and redirects you to the
**Builds** list where you can see the new entry at the top with status
`PENDING`.

## Step 4 — Watch the build

Click the build row to open its detail page. The left panel shows metadata
(status, timestamps, artifact name). The right panel streams build logs.

The status progresses: `PENDING` → `BUILDING` → `SUCCESS` (or `FAILED`).

Auto-polling refreshes the page every 5 seconds while the build is active. You
do not need to refresh manually.

## Step 5 — Locate the produced artifact

When the status reaches `SUCCESS`, the **artifact** field in the metadata panel
becomes a link. Click it to navigate to the corresponding entry in Fusion Index,
where you can download files or attach the artifact to a pipeline.

## Troubleshooting

**Build stays PENDING for more than a minute** — the Forge operator pod may be
unavailable. Check with your platform admin.

**FAILED with "package not found"** — the package is not on the configured
registry. Check with your platform admin for the registry configuration.

---

**Series: Forge basics**
[← 1. What is Fusion Forge?](forge-basics-01-overview) · **2. Create your first venv build** · [3. Build from a Git repository →](forge-basics-03-python-builder)
