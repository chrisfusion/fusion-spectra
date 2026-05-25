---
title: "Tag model reference"
summary: "How Fusion Index tags work as mutable pointers, their constraints, and the API operations that manage them."
tags:
  - index
  - reference
  - tag
routes:
  - /fusion-index/artifacts/:id
---

## What a tag is

A tag is a **named pointer** from an artifact to one specific version. Tags are
mutable — you can move them to different versions at any time.

This is similar to a Git tag except that Fusion Index tags are always mutable
(there is no "annotated" vs "lightweight" distinction).

## Constraints

- A tag belongs to exactly one artifact — you cannot share a tag across artifacts.
- A tag points to exactly one version at a time — moving it to a new version
  removes it from the old one atomically.
- Tag names are lowercase, and may contain letters, digits, and hyphens.
  Maximum length: 64 characters.
- An artifact can have any number of tags.
- A version can have any number of tags pointing to it simultaneously.

## Operations

| Operation | Effect |
|---|---|
| **Create tag** (`putTag`) | If the tag does not exist, creates it pointing to the specified version |
| **Move tag** (`putTag` with existing name) | Removes the tag from its current version and points it to the new one |
| **Delete tag** (`deleteTag`) | Removes the tag from the artifact — no version has it afterwards |

## Protected tag

The special tag `protected` prevents a version from being deleted through the
UI. A version with the `protected` tag has its delete button disabled. Removing
the tag requires admin-level permission.

The `protected` tag is otherwise a regular tag — you can create, move, and
delete it like any other tag (subject to permission).

## Tag resolution in Weave

When a Weave service instance references an artifact with a tag
(e.g. `tag=stable`), Weave resolves the tag to the current version ID at deploy
time. If you later move `stable` to a new version, the running service does
**not** automatically update — you must trigger a rolling restart to pick up
the new version.
