---
title: "Chain policies reference"
summary: "Reference for the failurePolicy and concurrencyPolicy fields on Weave chains."
tags:
  - weave
  - reference
  - chain
  - policy
routes:
  - /pipelines/weave/chains/create
  - /pipelines/weave/chains/advanced
  - /pipelines/weave/chains/:name
---

## failurePolicy

Controls what happens when a step in a run fails.

| Value | Behaviour |
|---|---|
| `Fail` | Stop the run immediately. Steps that have not started are cancelled. Currently running steps are allowed to finish. **Default.** |
| `FailSlow` | Allow all already-started steps to complete before failing the run. Steps not yet started are cancelled. |
| `StopAll` | Immediately send a stop signal to all running steps and fail the run. |

**Recommendation:** Use `Fail` for most pipelines. Use `FailSlow` when parallel
steps produce outputs that are still useful even if one path fails. Use
`StopAll` only when lingering steps would cause side effects (e.g. writing
duplicate records).

## concurrencyPolicy

Controls what happens when a new run is triggered while another run of the
same chain is still active.

| Value | Behaviour |
|---|---|
| `Allow` | Both runs execute in parallel. |
| `Forbid` | The new run is rejected. The existing run continues. |
| `Replace` | The existing run is stopped and the new run starts. |

**Recommendation:** Use `Forbid` for pipelines where parallel runs would
conflict (e.g. writing to the same output table). Use `Allow` for independent
workloads (e.g. per-user batch jobs). Use `Replace` for scheduled pipelines
where only the latest run matters.

## sharedStorage

An optional field on the chain spec. When set, a shared volume is mounted into
every step pod. Steps can use this volume to pass intermediate files to each
other without external storage.

The value is a Kubernetes `PersistentVolumeClaim` name that must exist in the
`fusion` namespace before the chain runs.
