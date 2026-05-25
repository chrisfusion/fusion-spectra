---
title: "Create an artifact"
summary: "Register a new named artifact in Fusion Index."
tags:
  - index
  - artifact
routes:
  - /fusion-index/artifacts/create
---

## When to use this

Create an artifact when you want to register a new named entry in the registry.
An artifact is a top-level container — you add versions and files to it afterwards.

Note: Fusion Forge creates artifacts automatically when a build succeeds.
This how-to is for manual registration.

## Prerequisites

- The `index:artifacts:create` permission

## Steps

1. Go to **Fusion Index → Registry → Create Artifact** (`/fusion-index/artifacts/create`).
2. Enter a unique **full name** (e.g. `platform/my-service`).
3. Optionally enter a **description**.
4. Click **Next**. The wizard checks name availability.
5. On the **Version** step, enter a semver string for the first version.
6. On the **Files** step, upload one or more files (or skip and add them later).
7. Click **Finish**.

## Notes

- Names are globally unique. Use a namespaced format like `team/artifact` to
  avoid collisions.
- You cannot rename an artifact after creation. Choose the name carefully.
- Artifact **types** (e.g. `python-venv`) can be attached on the detail page
  after creation if your admin has configured types.
