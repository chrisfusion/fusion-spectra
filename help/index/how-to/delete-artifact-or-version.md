---
title: "Delete an artifact or version"
summary: "Remove an artifact version (and its files) or an entire artifact from Fusion Index."
tags:
  - index
  - artifact
  - version
  - delete
routes:
  - /fusion-index/artifacts/:id
---

## When to use this

Delete versions when they are no longer needed to reclaim storage. Delete an
entire artifact when the project is retired.

## Prerequisites

- To delete a version: the `index:versions:delete` permission
- To delete an artifact: the `index:artifacts:delete` permission

## Delete a version

1. Open the artifact detail page.
2. In the **Versions** table, find the version to remove.
3. Click the **trash icon** on the version row.
4. Confirm in the dialog.

Deleting a version also deletes all its files. If this is the last version on
the artifact, a second dialog appears asking whether you also want to delete
the artifact itself.

## Delete an artifact

1. Open the artifact detail page.
2. In the metadata panel header, click **Delete Artifact** (trash icon).
3. Confirm in the dialog.

Deleting an artifact removes all its versions and files. This action cannot
be undone.

## Notes

- Tags on a deleted version are also deleted. Other versions' tags are unaffected.
- If a version is tagged `protected`, the delete button is disabled. Remove
  the `protected` tag first (requires admin permission).
- Builds in Fusion Forge that produced an artifact are not affected by deleting
  the artifact from the index — the build record and logs remain in Forge.
