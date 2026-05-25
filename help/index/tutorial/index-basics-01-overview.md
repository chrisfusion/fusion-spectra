---
title: "Fusion Index basics — 1. What is Fusion Index?"
summary: "Learn what Fusion Index is, the artifact model, and how it connects to the rest of the platform."
tags:
  - index
  - overview
  - quickstart
  - series:index-basics
routes:
  - /fusion-index
  - /fusion-index/artifacts
---

## What you will learn

- What Fusion Index is and what problems it solves
- The three-level model: artifacts, versions, and files
- How tags give you stable references to moving versions

## What is Fusion Index?

Fusion Index is the platform's **artifact registry**. It stores versioned build
outputs — Python environments, application packages, model files, and any other
binary artifacts — and makes them available for download or deployment.

You interact with Fusion Index when you want to:

- Browse and download artifacts produced by Fusion Forge
- Tag a specific artifact version as `stable` or `latest` for use in pipelines
- Manage the lifecycle of old versions (delete, archive)

## The three-level model

### Artifacts

An **artifact** is the top-level container. It has a globally unique name and
can carry one or more type labels (e.g. `python-venv`, `docker-image`).

Think of an artifact as a project — a named thing that exists independently
of any particular version.

### Versions

Each artifact has one or more **versions**, identified by a semantic version
string (e.g. `1.2.3`, `2.0.0-rc1`). A version contains the actual files.

Versions are immutable once created. You cannot overwrite a version — publish
a new one instead.

### Files

Each version contains one or more **files** — the binary or text payloads.
Multiple files in a single version are common (e.g. a wheel + a lockfile).
Each file has a name, size, content type, and a download URL.

## Tags

A **tag** is a named pointer from an artifact to one of its versions.
For example, the `stable` tag on artifact `my-service` might point to version
`1.4.2`. When you move the tag to `1.5.0`, everything that reads `stable` now
gets the new version — without any other change.

Tags are how Weave pipelines reference artifacts: `artifactName=my-service,
tag=stable` — the pipeline always runs the version currently tagged `stable`.

---

**Series: Fusion Index basics**
**1. What is Fusion Index?** · [2. Create your first artifact →](index-basics-02-create-artifact)
