---
title: "Create a Job Blueprint"
summary: "Define a reusable job step that can be referenced in pipeline chains."
tags:
  - weave
  - blueprint
  - job-template
routes:
  - /pipelines/weave/jobtemplates/create
  - /pipelines/weave/jobtemplates
---

## When to use this

Create a Job Blueprint when you have a batch task — a script, data processor,
or any step that runs to completion — and want to reuse it across multiple chains.

## Prerequisites

- The `weave:templates:write` permission

## Steps

1. Go to **Weave → Blueprints → Job Blueprints** and click **New Job Blueprint**.
2. Enter a unique **name** (lowercase, hyphens only — immutable after creation).
3. Enter the container **image** including tag.
4. Add any **environment variables** the container needs at runtime.
5. Click **Save**.

## Notes

- The name is a Kubernetes resource name and cannot be changed after creation.
  To rename, delete and recreate.
- The image field accepts any valid container image reference. For private
  registries, the cluster must have pull secrets configured — this is a
  platform-level configuration, not per-blueprint.
- Use the **expert page** (accessible from the blueprint list) to set advanced
  fields like resource limits, volume mounts, or command overrides.
