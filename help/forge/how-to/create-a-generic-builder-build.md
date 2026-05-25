---
title: "Create a Generic Builder build"
summary: "Build an application from a Git repository using the Generic Builder and a metadata.yaml descriptor."
tags:
  - forge
  - git
  - generic-builder
  - build
routes:
  - /forge/gitops-builder/create
  - /forge/appbuilds/create
---

## When to use this

Use the Generic Builder when your project is not a Python package but still
needs to be built and versioned. Forge reads your application's name, version,
and runtime from a `metadata.yaml` file in the repository.

## Prerequisites

- Git repository URL with a `metadata.yaml` at the repo root or in a subdirectory
- The `forge:builds:create` permission

## What goes in metadata.yaml

At minimum, `metadata.yaml` must contain `name`, `version`, and `runner`:

```yaml
name: my-service
version: 1.0.0
runner: python3.11
```

Forge resolves these server-side — you do not enter name or version in the form.

## Steps

1. Go to **Forge → Builder → GitOps Builder** (`/forge/gitops-builder/create`).
2. Set **Build type** to **Generic Builder**.
3. Enter the **Repository URL**.
4. Set **Branch / ref** (defaults to `main`).
5. Set **Project directory** if `metadata.yaml` is not at the root.
6. Leave GitOps Polling off for a one-off build.
7. Review and click **Submit**.

## Notes

- The review step shows the raw payload sent to Forge. Name and version fields
  are absent — Forge reads them from `metadata.yaml` during the build.
- If `metadata.yaml` is missing or malformed, the build fails immediately with
  a descriptive error in the logs.
