---
title: "Fusion Index basics — 3. Manage versions and tags"
summary: "Add new versions, move tags between versions, download files, and delete old versions."
tags:
  - index
  - artifact
  - version
  - tag
  - series:index-basics
routes:
  - /fusion-index/artifacts/:id
  - /fusion-index/artifacts/:id/versions/create
---

## What you will learn

- How to add a new version to an existing artifact
- How to attach and move tags
- How to download files
- How to delete a version or a whole artifact

## Prerequisites

- An existing artifact with at least one version (see part 2)
- Appropriate permissions for the actions you want to perform

## Add a new version

Open the artifact detail page. In the **Versions** panel, click **Add Version**.
This opens the 2-step version wizard: enter the semver string and optional
config JSON, then upload files.

## Download files

In the Versions table, each version row has a **Download** button:

- **Single file** — a direct download link opens.
- **Multiple files** — a dropdown lists all files. Click a file name to
  download that specific file.

You can also copy download URLs (ext-BFF or public API) from the same dropdown
if those patterns are configured in your deployment.

## Add a tag

Click the tag icon in the version row. Enter a tag name (e.g. `stable`,
`latest`, `v2-rc`). Tags are lowercase, alphanumeric, and hyphens only.

If the tag already exists on another version, it **moves** — the old version
silently loses it.

## Remove a tag

Click the × on the tag chip inside the version row. The tag is deleted globally
— no version has it afterwards.

## Delete a version

Click the trash icon on the version row. A confirmation dialog appears. If the
version you are deleting is the last one, a second dialog asks whether you also
want to delete the artifact itself.

Deleting a version also removes all its stored files.

## Delete an artifact

Open the artifact detail page. In the metadata panel, click **Delete Artifact**.
Confirm in the dialog. This deletes the artifact, all its versions, and all
their files.

---

**Series: Fusion Index basics**
[← 2. Create your first artifact](index-basics-02-create-artifact) · **3. Manage versions and tags**
