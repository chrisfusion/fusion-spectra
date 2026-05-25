---
title: "Platform monitoring — design and approach"
summary: "How Fusion approaches observability across its services and what each monitoring surface is responsible for."
tags:
  - monitoring
  - explanation
  - architecture
  - observability
routes:
  - /monitoring
---

## Observability layers in Fusion

The Fusion platform separates observability into three layers:

1. **Service health** — is a service reachable and functioning?
2. **Pipeline observability** — are runs succeeding? What failed and why?
3. **Build observability** — are build jobs completing? What are the failure rates?

Each layer is surfaced in a different part of the UI today and will converge
in the Monitoring context as it matures.

## Service health

Platform service health is tracked by the BFF and displayed on the main
dashboard. It reflects the live reachability of each service (`forge`,
`weave`, `index`, `spectra`).

Admins can set manual overrides for planned maintenance or to flag a known
issue before automated detection catches it — see **Admin → Service Health**.

## Pipeline observability (Weave)

Weave run monitoring lives in **Weave → Runs**. It shows:

- All runs with their overall phase
- Active runs filtered for operational focus
- Failed runs for investigation
- Per-run step detail with phases and logs

The Weave operator tracks step-level phase transitions continuously. The UI
polls the Weave API and renders the current state.

## Build observability (Forge)

Forge build monitoring lives in **Forge → Monitoring → Build Overview**. It shows:

- All build jobs across all types (venv, git, app)
- Status filtering (pending, building, success, failed)
- Per-build detail with full logs

## Where monitoring is going

The standalone Monitoring context will aggregate signals from all three layers:
a single dashboard where you can see the health of every service, the current
run success rate, and the most recent build failures — without navigating
between contexts.

This is particularly useful for platform operations teams who need a broad
view rather than the deep-dive perspective that the per-service pages offer.
