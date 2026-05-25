---
title: "Weave basics — 3. Create a chain"
summary: "Compose blueprints into a pipeline chain using the Advanced Chain Builder."
tags:
  - weave
  - chain
  - pipeline
  - series:weave-basics
routes:
  - /pipelines/weave/chains/create
  - /pipelines/weave/chains/advanced
  - /pipelines/weave/chains
---

## What you will learn

- How to create a chain with multiple steps using the Advanced Chain Builder
- How to define step dependencies to control execution order
- How to preview the resulting DAG before submitting

## Prerequisites

- At least one Job Blueprint (see part 2)
- The `weave:chains:write` permission

## Step 1 — Open the Advanced Chain Builder

Go to **Weave → Blueprints → Chains** and click **New Chain → Advanced**.

The Advanced Chain Builder is a 3-step wizard with a live DAG preview.

## Step 2 — Identity

On step 1, enter:

**Chain name** — unique, DNS-safe (e.g. `my-etl-pipeline`). Immutable after creation.

**Failure policy** — what happens when a step fails:
- `Fail` — stop the run immediately (default)
- `FailSlow` — let independent steps finish before stopping
- `StopAll` — stop and cancel all running steps

**Concurrency policy** — what happens when a new run is triggered while another is active:
- `Allow` — run both in parallel
- `Forbid` — reject the new run
- `Replace` — cancel the existing run and start the new one

## Step 3 — Pipeline

On step 2, build the step list on the left. The right panel shows a live DAG
preview that updates as you add steps.

For each step:

1. Click **Add step**.
2. Enter a **step name** (local to this chain, not the blueprint name).
3. Choose **Step kind**: `Job` for batch steps, `Deploy` for services.
4. Select the **blueprint** from the dropdown.
5. Under **Dependencies**, tick the names of steps that must complete before
   this one starts. Steps with no dependencies run first, in parallel.

The DAG preview shows arrows representing dependencies. If you accidentally
create a cycle, the wizard blocks you from advancing until it is resolved.

## Step 4 — Review and submit

Step 3 shows the full DAG, the settings table, and the step list. Review
everything, then click **Submit**. The chain is created and you are returned to
the chains list.

## Triggering your chain

See part 4 of this series to learn how to create a run from your chain.

---

**Series: Weave basics**
[← 2. Create your first blueprint](weave-basics-02-create-blueprint) · **3. Create a chain** · [4. Monitor a run →](weave-basics-04-monitor-runs)
