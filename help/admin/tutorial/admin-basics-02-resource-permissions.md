---
title: "Admin basics — 2. Resource permissions"
summary: "Grant a user or group a specific permission scoped to a single resource, rather than platform-wide."
tags:
  - admin
  - rbac
  - resource-permissions
  - series:admin-basics
routes:
  - /admin/permissions
---

## What you will learn

- When to use resource permissions instead of roles
- How to create a resource permission grant
- How to filter and manage existing grants

## Prerequisites

- The `admin:permissions:manage` permission (admin role)

## When to use resource permissions

Use resource permissions when you need to grant access to a specific resource
without giving the user broad platform-level access.

**Example:** A user should be able to delete versions of artifact ID 42, but
should not have platform-wide `index:versions:delete`. Create a resource
permission with:
- Permission: `index:versions:delete`
- Resource type: `artifact`
- Resource ID: `42`

The user gains the permission for that artifact only.

## Step 1 — Open Resource Permissions

Go to **Admin → Resource Permissions** (`/admin/permissions`).

The table shows all existing resource permission grants. Use the filter bar
to narrow by resource type or resource ID.

## Step 2 — Add a grant

Click **Add Grant**. A form appears:

- **Subject type** — `user`, `role`, or `group`
- **Subject** — the specific user email, role name, or group
- **Permission** — select from the dropdown of known permission strings
- **Resource type** — the type of resource being scoped (e.g. `artifact`)
- **Resource ID** — the numeric ID of the specific resource

Fill in all fields and click **Save**.

## Step 3 — Verify

The grant appears in the table. The subject's permission is now active for
that specific resource.

## Removing a grant

Click the **trash icon** on the grant row and confirm. The permission is
revoked immediately.

---

**Series: Admin basics**
[← 1. Roles and role assignments](admin-basics-01-roles) · **2. Resource permissions**
