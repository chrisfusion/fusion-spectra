---
title: "The artifact and version model"
summary: "Why Fusion Index separates artifacts, versions, files, and tags into distinct concepts, and how they work together."
tags:
  - index
  - explanation
  - architecture
  - model
routes:
  - /fusion-index
  - /fusion-index/artifacts
---

## Why three levels?

Fusion Index organises content into three levels: artifact → version → file.
Each level has a distinct role:

**Artifact** — the stable identity. An artifact's name never changes. It acts
as an addressable namespace for all the versions ever produced for a project.

**Version** — an immutable point-in-time snapshot. Once created, a version and
its files cannot be modified. Immutability guarantees that consumers always get
exactly what they asked for when they specify a semver.

**File** — the actual bytes. A version can contain multiple files (e.g. a wheel
and a lockfile). Splitting them preserves download granularity — consumers can
fetch only the files they need.

## Why tags are separate from versions

Semver strings like `1.4.2` are immutable — they always refer to the same
content. But pipelines and services need a way to say "give me the latest
stable build" without updating their config on every release.

Tags solve this. A tag like `stable` is a mutable pointer that you advance
manually. Consumers reference the tag, not the semver, so promoting a new
build to `stable` is a single tag operation rather than an update to every
downstream that references the artifact.

This separation means:
- Tags are policy decisions (made by you), not content decisions.
- Versions are facts (produced by builds), not policies.
- You can have both: pin to `1.4.2` for reproducibility, or use `stable` for continuous deployment.

## Relation to Fusion Forge

Forge creates artifact entries automatically when a build succeeds. The name
and version come from your project's metadata. You do not need to pre-register
the artifact — Forge handles that.

After Forge creates the artifact, you manage it in Fusion Index: add tags,
download files, delete old versions, and control access through permissions.

## Relation to Weave

Weave service instances reference artifacts by name and tag. The operator
resolves the tag to a version ID at deploy time, fetches the file download URL,
and uses it to pull the image or asset into the running pod.

The clean separation between tagging and deployment means you can stage a
release in Index (`stable` → `1.5.0`) and deploy it at any time by restarting
the relevant service instance — no chain or blueprint changes needed.
