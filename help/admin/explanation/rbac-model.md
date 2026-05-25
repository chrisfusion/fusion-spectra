---
title: "Understanding the Fusion RBAC model"
summary: "How roles, resource permissions, and subjects combine to control access across the platform."
tags:
  - admin
  - explanation
  - rbac
  - architecture
routes:
  - /admin
  - /admin/roles
  - /admin/permissions
---

## Two-layer access control

The Fusion platform uses a two-layer RBAC model:

1. **Roles** — broad, platform-wide permissions bundled by function
2. **Resource permissions** — narrow, per-resource grants for specific operations

A user's effective permissions are the **union** of both layers.

## Layer 1: Roles

A role is a named bundle of permissions defined in the platform configuration.
Examples: `admin`, `developer`, `viewer`.

You assign roles to subjects (users or groups) through the Role Assignments
page. Assignments are global — if a user has the `developer` role, they have
every permission that role carries, across every resource on the platform.

**Use roles for**: access levels that should apply broadly. Most users will
need at most one or two roles.

## Layer 2: Resource permissions

A resource permission is a direct grant of a single permission string for a
specific resource ID. It is scoped: it does not affect other resources of the
same type.

Example grant:
- Subject: `alice@example.com`
- Permission: `index:artifacts:delete`
- Resource type: `artifact`
- Resource ID: `42`

Alice can delete artifact 42, but not any other artifact.

**Use resource permissions for**: exceptions to the role-level policy. Sharing
access to one specific artifact, delegating a single admin action, or giving
temporary elevated access to a resource.

## How checks work

When a user performs an action, the BFF checks:

1. Does the user's role grant this permission globally? → **allow**
2. Does the user have a resource permission for this specific permission + resource ID? → **allow**
3. Neither? → **deny**

The check is a logical OR — either condition is sufficient.

## Subjects

A subject can be a:

- **User** — identified by email address
- **Group** — a named collection of users managed in your identity provider
- **Role** — when a permission is granted to a role, every user with that role inherits the resource permission

## Permissions at login

Resource permissions are loaded into the user session at login. Role
assignments take effect at the next login. Changes made while a user is logged
in require a session refresh or re-login to reflect.
