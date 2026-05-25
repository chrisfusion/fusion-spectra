---
title: "Permissions reference"
summary: "Complete list of permission strings used in the Fusion platform for role and resource-permission configuration."
tags:
  - admin
  - reference
  - permissions
  - rbac
routes:
  - /admin
  - /admin/permissions
  - /admin/roles
---

## Fusion Index permissions

| Permission | Description |
|---|---|
| `index:artifacts:read` | List and view artifacts |
| `index:artifacts:create` | Create new artifacts |
| `index:artifacts:delete` | Delete artifacts and all their versions |
| `index:versions:create` | Create new versions on an artifact |
| `index:versions:delete` | Delete individual versions |
| `index:admin:manage` | Run index maintenance operations (cleanup of empty artifacts/versions) |

## Fusion Forge permissions

| Permission | Description |
|---|---|
| `forge:builds:read` | List and view build jobs and logs |
| `forge:builds:create` | Submit new build jobs |
| `forge:builds:delete` | Delete build records |

## Weave permissions

| Permission | Description |
|---|---|
| `weave:resources:read` | Read blueprints, chains, triggers, and run status |
| `weave:templates:write` | Create and update job and service blueprints |
| `weave:chains:write` | Create and update chains |
| `weave:triggers:write` | Create and update triggers |
| `weave:runs:write` | Create runs |
| `weave:runs:delete` | Delete run records |
| `weave:steps:restart` | Stop and restart runs and steps |

## Content permissions

| Permission | Description |
|---|---|
| `content:changelog:read` | Read changelog entries |
| `content:help:read` | Read help articles and videos |

## Admin permissions

| Permission | Description |
|---|---|
| `admin:roles:manage` | Manage role assignments |
| `admin:permissions:manage` | Manage resource-scoped permission grants |
| `admin:health:manage` | Set and clear service health overrides |

## Permission format

Permission strings follow the format `<service>:<resource>:<action>`.

- **service**: the platform component (`index`, `forge`, `weave`, `admin`, `content`)
- **resource**: the type of object (`artifacts`, `builds`, `runs`, etc.)
- **action**: the operation (`read`, `create`, `write`, `delete`, `manage`)

`manage` implies all CRUD operations for that resource — it is used for admin
capabilities that combine read, write, and delete.
