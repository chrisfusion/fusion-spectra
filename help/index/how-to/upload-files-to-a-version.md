---
title: "Upload files to a version"
summary: "Add files to an existing artifact version using the version creation wizard."
tags:
  - index
  - artifact
  - version
  - upload
routes:
  - /fusion-index/artifacts/:id/versions/create
  - /fusion-index/artifacts/:id
---

## When to use this

Use this when you have an existing artifact and want to add a new version with
files attached, or when a previous upload failed partway and you need to complete it.

## Prerequisites

- An existing artifact
- The `index:versions:create` permission

## Steps

1. Open the artifact detail page (`/fusion-index/artifacts/:id`).
2. In the **Versions** panel, click **Add Version**.
3. Enter the **version** as a semantic version string (e.g. `1.3.0`).
4. Optionally enter a JSON **config** blob for version metadata.
5. Click **Next**.
6. Drag files onto the upload zone or click to browse. Multiple files are supported.
7. Wait for all files to show a ✓ status indicator.
8. Click **Finish**.

## Notes

- You cannot add files to an already-created version through this flow — the
  wizard creates a new version each time. File uploads within a single version
  creation session can be retried.
- Files within a version must have unique names. The wizard warns you if you
  drop two files with the same name.
- There is no file size limit enforced in the UI, but your browser and the
  cluster's ingress may impose limits. For very large files, contact your
  platform admin.
