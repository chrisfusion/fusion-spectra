---
title: "Create a Python Builder build"
summary: "Build a Python project from a Git repository using the Python Builder."
tags:
  - forge
  - git
  - python-builder
  - build
routes:
  - /forge/gitops-builder/create
  - /forge/gitbuilds/create
---

## When to use this

Use the Python Builder when your project lives in a Git repository and uses
`pyproject.toml` to declare its name, version, and dependencies.

## Prerequisites

- Git repository URL (public, or private with a token configured)
- `pyproject.toml` at the repo root or in a subdirectory
- The `forge:builds:create` permission

## Steps

1. Go to **Forge → Builder → GitOps Builder** (`/forge/gitops-builder/create`).
2. Set **Build type** to **Python Builder**.
3. Enter the **Repository URL** (HTTPS clone URL).
4. Set **Branch / ref** if you are not building from `main`.
5. Set **Project directory** if `pyproject.toml` is not at the root.
6. Choose **Metadata source**:
   - **Full** — name and version both read from `pyproject.toml`
   - **Version only** — you supply the name; version from `pyproject.toml`
   - **Manual** — you supply both name and version
7. Leave GitOps Polling off (step 2) for a one-off build.
8. Review and click **Submit**.

## Notes

- The branch field accepts any valid git ref: branch name, tag, or commit SHA.
- If the repo is private, set up a GitOps Poller with a token secret instead
  of entering tokens manually each time.
