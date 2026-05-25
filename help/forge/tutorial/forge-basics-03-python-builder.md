---
title: "Forge basics — 3. Build from a Git repository"
summary: "Use the Python Builder to compile a Python project directly from a Git repository URL."
tags:
  - forge
  - git
  - python-builder
  - series:forge-basics
routes:
  - /forge/gitops-builder/create
  - /forge/gitbuilds/create
---

## What you will learn

- The difference between the Python Builder and the Generic Builder
- How to submit a Git-sourced build
- How `metadata_source` controls what Forge reads from your repo

## Prerequisites

- A Git repository URL accessible from the cluster (public GitHub, or private with a token)
- Your repo must contain a `pyproject.toml` (Python Builder) or `metadata.yaml` (Generic Builder)
- The `forge:builds:create` permission

## Python Builder vs Generic Builder

| | Python Builder | Generic Builder |
|---|---|---|
| **Input** | Git repo with `pyproject.toml` | Git repo with `metadata.yaml` |
| **Name/version source** | `metadata_source` controls this | Always from `metadata.yaml` |
| **Language** | Python only | Any runtime defined in metadata |

Use **Python Builder** for Python projects. Use **Generic Builder** for anything else.

## Step 1 — Open the GitOps Builder, set type to Python Builder

Go to **Forge → Builder → GitOps Builder** (`/forge/gitops-builder/create`).

On step 1, set **Build type** to **Python Builder**.

## Step 2 — Enter the repository details

**Repository URL** — the full HTTPS clone URL (e.g. `https://github.com/org/my-project`).

**Branch / ref** — defaults to `main`. Change this if you want to build from a
tag or another branch.

**Project directory** — leave blank if `pyproject.toml` is at the repo root.
If your project is nested (e.g. `services/worker`), enter the subdirectory here.

## Step 3 — Choose the metadata source

The **Metadata source** toggle controls where Forge reads the artifact name and
version from:

| Setting | Name comes from | Version comes from |
|---|---|---|
| `Full (pyproject.toml)` | `pyproject.toml` | `pyproject.toml` |
| `Version only` | You enter it in the form | `pyproject.toml` |
| `Manual` | You enter it in the form | You enter it in the form |

For most cases, **Full** is correct — Forge reads everything from your
`pyproject.toml`. Use **Manual** when you want to override the name or pin a
specific version string.

## Step 4 — Review and submit

Click **Next** to see the review panel summarising your inputs. If everything
looks correct, click **Submit**.

Forge submits a build job. The Builds list opens and your build appears as
`PENDING → BUILDING → SUCCESS`.

## If your repository is private

You need a personal access token. Configure it through the GitOps Poller flow
(see part 4 of this series) rather than entering it on every manual build.

---

**Series: Forge basics**
[← 2. Create your first venv build](forge-basics-02-venv-build) · **3. Build from a Git repository** · [4. Automate with GitOps Poller →](forge-basics-04-gitops-poller)
