---
title: "Grant a resource-scoped permission"
summary: "Give a user or group a specific permission on a single resource without granting platform-wide access."
tags:
  - admin
  - rbac
  - resource-permissions
routes:
  - /admin/permissions
---

## When to use this

Use resource permissions when a user needs access to one specific resource but
should not have the corresponding global permission. For example, allowing a
contractor to delete only specific artifacts.

## Prerequisites

- The `admin:permissions:manage` permission

## Steps

1. Go to **Admin → Resource Permissions** (`/admin/permissions`).
2. Click **Add Grant**.
3. Set **Subject type**: `user`, `role`, or `group`.
4. Enter the **subject** using the dropdown or text field.
5. Select the **permission** from the dropdown.
6. Select the **resource type** (e.g. `artifact`, `build`).
7. Enter the **resource ID** (the numeric ID of the specific resource).
8. Click **Save**.

## Finding the resource ID

- **Artifacts**: open the artifact detail page — the ID appears in the URL (`/fusion-index/artifacts/42`).
- **Builds**: open the build detail page — the ID appears in the URL.

## Notes

- Resource permissions supplement roles — they do not replace them. A user with
  a resource permission but no role may still be blocked by platform-level
  checks elsewhere.
- Granting a permission to a `role` means every user with that role gets the
  resource-scoped permission too. This is a way to give `developer` role users
  access to specific admin resources.
