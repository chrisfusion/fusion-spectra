---
title: "Weave basics — 4. Monitor a run"
summary: "Trigger a pipeline run and track it through to completion using the run monitoring pages."
tags:
  - weave
  - run
  - monitoring
  - series:weave-basics
routes:
  - /pipelines/runs
  - /pipelines/runs/running
  - /pipelines/runs/:name
  - /pipelines/runs/failed
---

## What you will learn

- How to trigger a run from a chain
- How to navigate the run monitoring pages
- How to read step phases and view step logs

## Prerequisites

- At least one chain (see part 3)
- The `weave:runs:write` permission to create runs

## Step 1 — Trigger a run

Go to **Weave → Blueprints → Chains** and click the chain you want to execute.
On the chain detail page, click **Run** (or **New Run**). Weave creates a run
object and the run appears on the Runs Overview page.

## Step 2 — Navigate the monitoring pages

The **Runs** sub-section has three list views:

| Page | What it shows |
|---|---|
| **Monitoring** (`/pipelines/runs`) | All runs, sorted by start time |
| **Running** (`/pipelines/runs/running`) | Only active runs |
| **Failed** (`/pipelines/runs/failed`) | Only failed runs |

Use the Running page during active pipelines so you can spot issues without
scrolling past completed history.

## Step 3 — Read the run detail page

Click any run row to open its detail page. The page shows:

- **Overall phase** — the run's current phase badge at the top
- **Step table** — one row per step with its individual phase badge
- **Start time and duration** — for the run and each step

### Step phases

| Phase | Terminal? | Meaning |
|---|---|---|
| `Pending` | No | Waiting for dependencies to complete |
| `Running` | No | Currently executing |
| `Succeeded` | Yes | Completed successfully |
| `Failed` | Yes | Exited with an error |
| `Stopped` | Yes | Cancelled by a failure policy or manually |
| `Deployed` | No | Deploy step is live (service — not terminal) |

The page auto-polls every few seconds while any step is non-terminal.

## Step 4 — View step logs

Click the **log icon** on any step row to open the log dialog. Logs are
fetched live from the Weave API. If the step has not started yet or the log
is not yet available, the dialog shows "No log available yet".

## Stopping a run

On the run detail page, click **Stop**. Weave sends a stop signal to the
controller. The run transitions to `Stopped` (or individual steps to `Stopped`)
depending on the chain's failure policy.

---

**Series: Weave basics**
[← 3. Create a chain](weave-basics-03-create-chain) · **4. Monitor a run** · [5. Deploy a service instance →](weave-basics-05-service-instance)
