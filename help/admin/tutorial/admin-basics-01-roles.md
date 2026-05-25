---
title: "Admin basics — 1. Roles and role assignments"
summary: "Understand the Fusion RBAC model and learn how to assign roles to users and groups."
tags:
  - admin
  - rbac
  - roles
  - series:admin-basics
routes:
  - /admin/roles
  - /admin
---

## What you will learn

- What roles are and what they control
- The difference between roles and resource permissions
- How to assign a role to a user or group

## Prerequisites

- The `admin:roles:manage` permission (admin role)

## What is a role?

A **role** is a named collection of permissions. The platform ships with a set
of predefined roles (e.g. `admin`, `developer`, `viewer`). Roles are defined
in the platform configuration — you cannot create or modify roles through the UI.

What you *can* do is assign a role to a **subject** (a user or a group).
The subject inherits all permissions that the role carries.

## Roles vs resource permissions

Roles grant **global** permissions across the platform. A user with the
`developer` role can, for example, create builds in any Forge project.

**Resource permissions** are more granular — they grant a specific permission
on a specific resource. For example, a user might have `index:artifacts:delete`
only for artifact ID 42.

Use roles for general access levels. Use resource permissions for fine-grained
control over individual resources.

## Step 1 — Open Role Assignments

Go to **Admin → Role Assignments** (`/admin/roles`). The table shows all
current role assignments: who has which role.

## Step 2 — Assign a role

Click **Add Assignment**. A form appears with:

- **Subject type** — `user` or `group`
- **Subject** — the user email or group name
- **Role** — the role to assign

Fill in the fields and click **Save**.

## Step 3 — Verify

The new assignment appears in the table immediately. The user's permissions
take effect on their next login (or session refresh).

## Removing an assignment

Click the **trash icon** on the assignment row and confirm. The user loses the
role's permissions immediately (their next API call will reflect the change).

---

**Series: Admin basics**
**1. Roles and role assignments** · [2. Resource permissions →](admin-basics-02-resource-permissions)
