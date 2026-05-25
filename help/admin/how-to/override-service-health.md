---
title: "Override a service health status"
summary: "Manually set the displayed health state for a platform service, useful during maintenance or incidents."
tags:
  - admin
  - health
  - service-status
routes:
  - /admin/health
---

## When to use this

Use health overrides when:
- You are performing planned maintenance and want to signal `Maintenance` status
  to all users on the dashboard
- A service is degraded and you want to set `Unhealthy` before the automated
  check catches it
- A false-positive health check is showing `Unhealthy` and you want to
  temporarily override it while investigating

## Prerequisites

- The `admin:health:manage` permission

## Services you can override

| Service | Display name |
|---|---|
| `forge` | Fusion Forge |
| `index` | Fusion Index |
| `weave` | Weave |
| `spectra` | Fusion Spectra |

## Steps

1. Go to **Admin → Service Health** (`/admin/health`).
2. Find the service you want to override.
3. Click **Set Override**.
4. Choose a status: `Healthy`, `Unhealthy`, `Offline`, or `Maintenance`.
5. Click **Save**.

The override appears immediately on the platform health dashboard visible to
all users.

## Removing an override

Click the **delete icon** on the override row. The platform reverts to the
automatically detected health state.

## Status values

| Status | When to use |
|---|---|
| `Healthy` | Override a false-positive degraded state |
| `Unhealthy` | Signal a known degradation before automated checks update |
| `Offline` | Service is intentionally down for maintenance |
| `Maintenance` | Scheduled maintenance window — service may be intermittently unavailable |
