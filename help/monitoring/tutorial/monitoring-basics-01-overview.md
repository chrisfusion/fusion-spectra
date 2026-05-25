---
title: "Monitoring — overview"
summary: "Introduction to the Monitoring context in Fusion Spectra and the platform-wide observability it will provide."
tags:
  - monitoring
  - overview
routes:
  - /monitoring
---

## What is the Monitoring context?

The **Monitoring** context is the platform's central observability hub. It will
bring together health signals, metrics, and alerting from all Fusion services
into a single view.

## Current status

The Monitoring context is under active development. A first set of views is
planned for upcoming releases.

## What is available now

For current operational visibility:

- **Run health** — see active and failing pipeline runs in **Weave → Runs** (`/pipelines/runs`)
- **Build health** — see build status in **Forge → Monitoring → Build Overview** (`/forge/venvs`)
- **Service health** — platform-wide service status is visible on the main dashboard
- **Admin health overrides** — admins can set manual status signals at `/admin/health`

## Planned capabilities

Future versions of the Monitoring context will include:

- Cross-service health dashboard
- Pipeline run metrics (success rate, average duration, failure trends)
- Alert configuration for failed runs and degraded services
- Log aggregation and search across all platform components
