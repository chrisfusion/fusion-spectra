---
title: "How Forge builds work"
summary: "Understand the build lifecycle, isolation model, and how artifacts flow from Forge into Fusion Index."
tags:
  - forge
  - explanation
  - architecture
routes:
  - /forge
  - /forge/venvs
---

## The build lifecycle

When you submit a build request, Forge creates a **build job** in its internal
store and returns immediately. The job is picked up asynchronously by a builder
pod that runs inside the cluster.

```
Submit request → PENDING (job queued)
                     ↓
             BUILDING (pod running)
                     ↓
       SUCCESS ←————→ FAILED
```

Because builds are asynchronous, the UI polls the status every few seconds and
updates the display without requiring a manual refresh.

## Isolation

Each build runs inside its own ephemeral container. Builds cannot see each
other's files or environment variables. The container is destroyed after the
build completes, whether it succeeded or failed.

This isolation means:

- A broken build cannot affect another running build
- Secrets available to the builder pod are not accessible to user-submitted builds
- Logs are captured from the container's stdout and stored for later retrieval

## Where artifacts go

On success, Forge writes the built artifact to **Fusion Index**. The artifact
entry is created automatically — you do not need to create it manually.

The artifact name and version come from one of three sources depending on build
type (see the [build types reference](../reference/build-types)).

Once in Fusion Index, the artifact can be:

- Downloaded directly from the artifact detail page
- Referenced by a Weave pipeline step via artifact name and tag
- Tagged with a label (e.g. `stable`) to make it addressable by name

## GitOps Pollers

A GitOps Poller sits between your Git repository and Forge. It runs on a
configurable schedule, checks whether the tracked branch has new commits, and
submits a build automatically when it does.

This creates a continuous delivery loop:

```
Push to Git → Poller detects commit → Forge builds → Artifact in Index
```

The poller does not build on every poll — only when it sees a commit SHA it
has not processed yet.
