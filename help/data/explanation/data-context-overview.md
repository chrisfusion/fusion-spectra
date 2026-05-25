---
title: "The Data context — what it is and where it is going"
summary: "Understand what the Data context will provide and how it connects to other Fusion services."
tags:
  - data
  - explanation
  - roadmap
routes:
  - /data
---

## Purpose

The Data context is designed to give data engineers and analysts a central
place to work with data assets — without needing to switch between external
tools. It brings together storage (Index), transformation (Weave), and
environment management (Forge) under a data-oriented lens.

## How Data connects to other services

```
Fusion Forge  →  builds Python environments for data processing
Weave         →  runs data pipelines on a schedule or trigger
Fusion Index  →  stores and versions datasets, models, and outputs
Data context  →  browses, inspects, and governs the above
```

Rather than replacing these services, the Data context provides a higher-level
view that surfaces data-specific metadata (schemas, lineage, quality scores)
alongside the artifacts and pipeline runs that produced them.

## Planned capabilities

Future versions of the Data context will include:

- **Dataset catalog** — discover data assets stored in Index with data-specific metadata
- **Lineage graph** — trace how a dataset was produced (which pipeline, which version)
- **Data source connectors** — link external databases or object storage
- **Quality dashboards** — track schema drift and data quality over time

## What to use today

Until these features are available, the recommended approach is:

- Store datasets as artifacts in **Fusion Index**, using artifact types (e.g. `dataset`) to distinguish them from code artifacts.
- Build processing environments in **Fusion Forge**.
- Orchestrate transformations in **Weave** chains.
