---
title: "Build statuses reference"
summary: "All possible status values for a Forge build and what each means."
tags:
  - forge
  - reference
  - status
routes:
  - /forge/venvs
  - /forge/venvs/:id
  - /forge/gitbuilds/:id
  - /forge/appbuilds/:id
---

## Status values

| Status | Terminal? | Meaning |
|---|---|---|
| `PENDING` | No | The build request has been accepted and is queued |
| `BUILDING` | No | A builder pod has picked up the job and is running |
| `SUCCESS` | Yes | The build completed and the artifact was produced |
| `FAILED` | Yes | The build encountered an error; see logs for details |
| `CANCELLED` | Yes | The build was cancelled before completion |

**Terminal** means the build will not change state again. The detail page
stops polling automatically when a terminal status is reached.

## What to do when a build fails

1. Open the detail page and read the log panel on the right.
2. Common causes:
   - **Package not found** — the package is missing from the configured registry
   - **Version conflict** — two packages require incompatible versions of a dependency
   - **Build script error** — the project's build step exited non-zero
   - **metadata.yaml missing** — required for Generic Builder builds
3. Fix the underlying issue and resubmit.

## Filtering by status

On the Builds list (`/forge/venvs`) use the status chip filters at the top to
show only builds in a specific state. You can combine status filters with the
build-type chips.
