---
title: "Weave basics — 1. What is Weave?"
summary: "Learn what the Weave pipeline engine is, its core concepts, and how it fits into the Fusion platform."
tags:
  - weave
  - overview
  - quickstart
  - series:weave-basics
routes:
  - /pipelines
---

## What you will learn

- What Weave is and what problem it solves
- The four core concepts: blueprints, chains, runs, and service instances
- How data flows from blueprint to running workload

## What is Weave?

Weave is the Fusion platform's **pipeline orchestration engine**. It lets you
define reusable step templates (blueprints), compose them into pipelines
(chains), and trigger controlled executions (runs).

You use Weave when you need to:

- Run a repeatable sequence of compute steps (ETL, training, batch processing)
- Deploy a long-running service managed by the platform
- Automate pipeline execution on a schedule or event

## Core concepts

### Blueprints (templates)

A **blueprint** describes a single reusable step. There are two kinds:

| Kind | Description |
|---|---|
| **Job Blueprint** | Runs to completion — batch jobs, scripts, one-off tasks |
| **Service Blueprint** | Runs continuously — APIs, workers, long-lived processes |

Blueprints specify the container image, environment variables, and resource
requirements. They do not do anything on their own — they are referenced by chains.

### Chains

A **chain** is a directed acyclic graph (DAG) of steps. Each step in a chain
references a blueprint and can declare dependencies on other steps. Weave
executes steps in dependency order, running independent steps in parallel.

### Runs

A **run** is one execution of a chain. When you trigger a chain, Weave creates
a run object and starts executing the steps. The run tracks the phase of each
step and the overall pipeline phase.

### Service Instances

A **service instance** is a specialised run type for long-lived services. It
keeps a `Deploy` step running indefinitely and exposes the service via the
cluster's ingress. You manage service instances separately from batch runs.

## Navigation in Spectra

The **Weave** context in the sidebar is organised into two topics:

- **Runs** — monitor active, completed, and failed pipeline executions; manage service instances
- **Blueprints** — create and manage Job and Service blueprints, chains, and triggers

---

**Series: Weave basics**
**1. What is Weave?** · [2. Create your first blueprint →](weave-basics-02-create-blueprint)
