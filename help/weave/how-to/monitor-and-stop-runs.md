---
title: "Monitor and stop runs"
summary: "Track active pipeline runs, read step-level status, view logs, and stop runs that need to be cancelled."
tags:
  - weave
  - run
  - monitoring
  - logs
routes:
  - /pipelines/runs
  - /pipelines/runs/running
  - /pipelines/runs/failed
  - /pipelines/runs/:name
---

## When to use this

Use the run monitoring pages whenever you need to check on active pipelines,
investigate a failure, or cancel a run that is stuck or no longer needed.

## Navigate to the run

- **All runs** — `/pipelines/runs` (Runs Overview): sorted by start time, most recent first.
- **Active runs** — `/pipelines/runs/running`: only runs currently executing.
- **Failed runs** — `/pipelines/runs/failed`: only terminal failures.

Click any row to open the run detail page.

## Read the run detail page

The detail page shows:

- **Run phase badge** — the overall pipeline phase
- **Step table** — one row per step with its own phase and timing
- **Duration** — elapsed time per step and overall

The page polls automatically every few seconds while any step is non-terminal.

## View step logs

Click the **log icon** on any step row (visible regardless of step phase).
A dialog opens with the step's captured stdout/stderr. If no log is available
yet, the dialog shows "EOF — No log available at moment or yet".

## Stop a run

On the run detail page, click **Stop**. Weave sends a stop signal to the
operator. Running steps transition to `Stopped` according to the chain's
failure policy.

Note: there is no "pause" — stopping a run is permanent. To re-run, create
a new run from the chain.

## Delete a completed run

On the run detail page, click **Delete**. This removes the run record from
Weave. It does not affect any artifacts produced during the run.
