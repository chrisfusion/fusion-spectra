---
title: "Create a chain"
summary: "Compose Job and Service Blueprints into an executable pipeline using the chain builder."
tags:
  - weave
  - chain
  - pipeline
routes:
  - /pipelines/weave/chains/create
  - /pipelines/weave/chains/advanced
  - /pipelines/weave/chains
---

## When to use this

Create a chain when you want to wire multiple blueprints together into an
ordered pipeline. The chain defines what runs and in what order — a run
executes the chain.

## Prerequisites

- At least one Job or Service Blueprint
- The `weave:chains:write` permission

## Steps

1. Go to **Weave → Blueprints → Chains** and click **New Chain**.
2. Choose **Advanced** for full DAG control (recommended) or a preset wizard for common patterns.
3. On **step 1 (Identity)**:
   - Enter a unique chain **name**.
   - Set **Failure policy**: `Fail` (stop on first error), `FailSlow` (let independent steps finish), or `StopAll` (cancel all steps).
   - Set **Concurrency policy**: `Allow`, `Forbid`, or `Replace`.
4. On **step 2 (Pipeline)**, add steps:
   - Click **Add step** and give it a name.
   - Choose kind: `Job` or `Deploy`.
   - Select the blueprint from the dropdown.
   - Under **Dependencies**, tick steps that must finish before this one starts.
5. Review the live DAG preview on the right. Fix any cycle warnings.
6. On **step 3 (Review)**, verify the DAG and settings, then click **Submit**.

## Notes

- Step names are local to the chain — they do not need to match blueprint names.
- The chain name is immutable. To rename, delete and recreate.
- Chains with no dependencies between steps run all steps in parallel.
- A `Deploy` step stays running after it reaches `Deployed` — the run never
  terminates while a deploy step is active (use a Service Instance for this pattern).
