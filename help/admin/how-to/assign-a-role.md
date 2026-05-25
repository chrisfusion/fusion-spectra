---
title: "Assign a role to a user or group"
summary: "Grant a user or group a platform role through the Role Assignments admin page."
tags:
  - admin
  - rbac
  - roles
routes:
  - /admin/roles
---

## When to use this

Use this when you need to give a user or group broad platform-level access —
for example, granting someone the `developer` role so they can create builds
and deploy services.

## Prerequisites

- The `admin:roles:manage` permission

## Steps

1. Go to **Admin → Role Assignments** (`/admin/roles`).
2. Click **Add Assignment**.
3. Set **Subject type** to `user` or `group`.
4. Enter the **subject** (user email or group name). The dropdown shows known users and groups.
5. Select the **role** from the dropdown.
6. Click **Save**.

## Notes

- Role permissions are loaded at login. If you assign a role to a user who is
  currently logged in, they need to log out and back in to see the change.
- To assign the same role to multiple users, repeat the process — there is no
  bulk assignment UI.
- Assignments are visible to all admins in the Role Assignments table.
