---
title: "Tag a version"
summary: "Attach a named tag to an artifact version so it can be referenced by name instead of semver."
tags:
  - index
  - tag
  - version
routes:
  - /fusion-index/artifacts/:id
---

## When to use this

Tag a version when you want a stable, human-readable pointer to a specific
release. Tags are how Weave pipelines reference artifacts without hardcoding
version strings.

## Prerequisites

- An existing artifact with at least one version
- The `index:versions:write` permission (or `index:versions:create` — depends on your platform config)

## Steps

1. Open the artifact detail page.
2. In the **Versions** table, find the version you want to tag.
3. Click the **tag icon** (label icon) on the version row.
4. Enter the tag name (e.g. `stable`, `latest`, `v2-rc`).
   - Allowed characters: lowercase letters, digits, hyphens.
5. Press **Enter** or click the check to confirm.

The tag chip appears on the version row immediately.

## Moving a tag

Tags are exclusive — each tag can only point to one version at a time.

To move `stable` from `1.4.0` to `1.5.0`:

1. Click the tag icon on the `1.5.0` row.
2. Enter `stable` and confirm.

The tag moves automatically. The `1.4.0` row no longer shows the `stable` chip.

## Removing a tag

Click the **×** on the tag chip in the version row. The tag is removed from the
artifact entirely — it does not move to another version.
