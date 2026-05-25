---
title: "Fusion Index basics — 2. Create your first artifact"
summary: "Create an artifact, add a version, and upload files through the 3-step wizard."
tags:
  - index
  - artifact
  - upload
  - series:index-basics
routes:
  - /fusion-index/artifacts/create
  - /fusion-index/artifacts
---

## What you will learn

- How to create an artifact through the creation wizard
- How to add a version with a semantic version string
- How to upload one or more files to the version

## Prerequisites

- The `index:artifacts:create` permission

## Step 1 — Start the artifact wizard

Go to **Fusion Index → Registry → Create Artifact** (`/fusion-index/artifacts/create`).

The wizard has three steps: Artifact → Version → Files.

## Step 2 — Artifact details

Enter the artifact **full name**. This is the globally unique identifier — use
a descriptive, namespaced name like `team-name/service-name`.

Optionally add a **description**.

Click **Next**. The wizard checks that the name is not already taken. If it
is, change the name and try again.

## Step 3 — Version details

Enter the **version** as a semantic version string:

- Valid: `1.0.0`, `2.1.3-rc1`, `0.9.0+build.42`
- Invalid: `v1.0`, `latest`, `1.0`

Optionally add a JSON **configuration** blob. This is stored as metadata on
the version and can be read by downstream consumers (e.g. pipeline steps that
need version-specific parameters).

Click **Next**.

## Step 4 — Upload files

The file upload step supports drag-and-drop of one or more files. Drop your
files onto the upload zone or click to browse.

Each file shows its upload progress. All uploads run in parallel.

When all files reach ✓, click **Finish**. You are redirected to the artifact
detail page.

## What to do if a file upload fails

If a file fails to upload, the wizard shows a retry option per file.
The artifact and version have already been created at this point — retrying
only re-uploads the failed file.

If you abandon the wizard after the version was created but before all files
uploaded, the version exists in a partial state. You can complete it later
from the artifact detail page using **Add Files** on the version row.

---

**Series: Fusion Index basics**
[← 1. What is Fusion Index?](index-basics-01-overview) · **2. Create your first artifact** · [3. Manage versions and tags →](index-basics-03-manage-versions)
