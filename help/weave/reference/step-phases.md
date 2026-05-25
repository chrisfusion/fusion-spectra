---
title: "Step phases reference"
summary: "All possible phase values for a Weave run step and how the overall run phase is derived."
tags:
  - weave
  - reference
  - phases
  - status
routes:
  - /pipelines/runs/:name
  - /pipelines/runs
---

## Step phase values

| Phase | Terminal? | Meaning |
|---|---|---|
| `Pending` | No | Waiting for upstream dependencies to complete |
| `Running` | No | The job pod is executing |
| `Succeeded` | Yes | The step exited cleanly (exit code 0) |
| `Failed` | Yes | The step exited with an error |
| `Stopped` | Yes | Cancelled by the chain's failure policy or a manual stop |
| `Deployed` | No | The deploy step's Deployment is running and healthy |

**Terminal** means the step will not change phase again.

## The `Deployed` phase

`Deployed` is special — it only applies to `Deploy` steps (those backed by a
Service Blueprint). A deploy step that reaches `Deployed` stays there
indefinitely. It is **not** a terminal phase: the step continues running, so
the overall run also continues.

This is by design: a service instance should stay running until explicitly
stopped. Do not treat `Deployed` as "finished" when polling for completion.

## Overall run phase

The run phase is derived from step phases:

| Condition | Run phase |
|---|---|
| All steps succeeded | `Succeeded` |
| Any step failed (and failure policy triggered) | `Failed` |
| All steps stopped | `Stopped` |
| Any step running or deployed | `Running` |
| All steps pending | `Pending` |

## Polling tip

When polling for run completion from a script, check that the overall phase
is one of `Succeeded`, `Failed`, or `Stopped`. Do **not** stop polling on
`Running` or `Deployed`.
