---
title: "Forge basics — 1. What is Fusion Forge?"
summary: "Learn what Fusion Forge does, when to use it, and how it fits into the Fusion platform."
tags:
  - forge
  - overview
  - quickstart
  - series:forge-basics
routes:
  - /forge
  - /forge/venvs
---

## What you will learn

By the end of this article you will understand:

- What Fusion Forge is and what problem it solves
- The three build types it supports
- How a build flows from submission to artifact

## What is Fusion Forge?

Fusion Forge is the platform's **build service**. It takes source material — a
`requirements.txt` file, a Git repository, or an application repository — and
produces a **built artifact** that is stored and versioned in Fusion Index.

You interact with Forge when you need to:

- Package a Python environment (venv) for use in a pipeline step
- Build a Python project from a Git repository
- Build a generic application from source

Forge runs builds in isolation inside containers. You do not need to manage
build infrastructure — submit a request, and Forge handles the rest.

## The three build types

| Build type         | Input                     | Use when                                              |
|--------------------|---------------------------|-------------------------------------------------------|
| **Venv**           | `requirements.txt` file   | You have a plain list of Python packages to install   |
| **Python Builder** | Git repository URL        | Your project lives in Git and uses `pyproject.toml`   |
| **Generic Builder**| Git repository URL        | Your project uses a `metadata.yaml` for any runtime   |

## How a build flows

1. You submit a build request through the **GitOps Builder** wizard or the dedicated create pages.
2. Forge queues the build job (`PENDING`).
3. A builder pod picks up the job and runs the build (`BUILDING`).
4. On success the artifact is written to Fusion Index and the status becomes `SUCCESS`.
5. On failure the status becomes `FAILED` and logs are available on the detail page.

## Where to go next

- **Builds list** — `/forge/venvs` — see all builds across all types with status chips.
- **Detail page** — click any build to see metadata, logs, and the produced artifact.

---

**Series: Forge basics**
**1. What is Fusion Forge?** · [2. Create your first venv build →](forge-basics-02-venv-build)
