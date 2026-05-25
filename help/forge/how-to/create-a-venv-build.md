---
title: "Create a venv build"
summary: "Submit a Python virtual environment build from a requirements.txt file."
tags:
  - forge
  - venv
  - build
routes:
  - /forge/venvs/create
  - /forge/gitops-builder/create
---

## When to use this

Use a venv build when you have a `requirements.txt` listing Python packages and
you want Forge to resolve and package them into a built artifact.

## Prerequisites

- A valid `requirements.txt` file
- The `forge:builds:create` permission

## Steps

1. Go to **Forge → Builder → GitOps Builder** (`/forge/gitops-builder/create`).
2. Set **Build type** to **Venv (requirements.txt)**.
3. In step 2 (GitOps Polling), leave **Enable GitOps Polling** off for a one-off build.
4. Drop your `requirements.txt` onto the upload zone or click to browse.
5. Wait for live validation to pass. Fix any reported package errors.
6. Click **Next**, review the summary, then click **Submit**.
7. You are redirected to the Builds list. Your build appears at the top as `PENDING`.

## Verifying the result

Click the build row to open the detail page. When status reaches `SUCCESS`,
the **Artifact** link takes you to the produced entry in Fusion Index.

## Notes

- Validation runs against the configured package registry before submission —
  errors caught here save you a failed build.
- If you need to rebuild the same artifact with the same packages, submit again;
  Forge does not deduplicate requests.
