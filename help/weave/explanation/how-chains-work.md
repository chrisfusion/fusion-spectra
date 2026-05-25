---
title: "How Weave chains work"
summary: "Understand the DAG execution model, how steps depend on each other, and how the Weave operator drives runs to completion."
tags:
  - weave
  - explanation
  - chain
  - dag
  - architecture
routes:
  - /pipelines/weave/chains
  - /pipelines
---

## Chains as directed acyclic graphs

A chain is a **directed acyclic graph (DAG)** of steps. Each step is a node;
each dependency declaration is a directed edge pointing from the dependency to
the dependent step.

```
[ingest] → [transform] → [load]
                ↓
           [validate]
```

In this example, `transform` depends on `ingest`. Both `load` and `validate`
depend on `transform`. When the chain runs:

1. `ingest` starts immediately (no dependencies).
2. `transform` starts when `ingest` succeeds.
3. `load` and `validate` both start as soon as `transform` succeeds — in parallel.
4. The run succeeds when all four steps have succeeded.

## What the Weave operator does

The Weave operator is a Kubernetes controller that watches `WeaveRun` objects
and reconciles them to the desired state. On every reconciliation loop:

1. It reads the chain's DAG.
2. For each step, it checks whether all dependencies have succeeded.
3. For steps whose dependencies are met and that have not started yet, it
   creates a Kubernetes `Job` (for Job steps) or `Deployment` (for Deploy steps).
4. It updates the run's status with the current phase of each step.

The operator does not run in the UI — it runs continuously in the cluster. The
Spectra UI reads run status from the Weave API, which reads from the cluster.

## Why immutable names

Chain names and step names are Kubernetes resource names. Once a chain is
created, its name cannot be changed because it may already be referenced by
existing runs. To "rename" a chain, delete it and create a new one.

## Triggered runs vs service instances

A standard run executes the chain once and transitions to a terminal phase
when all steps finish. A service instance uses the same chain mechanism but
relies on a `Deploy` step that stays in `Deployed` indefinitely.

The distinction is in the step kind:
- `Job` steps → terminate; run moves toward `Succeeded`
- `Deploy` steps → stay running; run stays `Running`

You choose which kind each step uses when building the chain. A chain can mix
Job and Deploy steps, though this is uncommon — typically a chain is either
all-batch or has a single deploy step at the end.

## Failure propagation

When a step fails, the chain's `failurePolicy` determines what happens to other
steps. See the [chain policies reference](../reference/chain-policies) for
details. At the run level, the operator marks the run as `Failed` only after
the policy has been applied and all affected steps have settled.
