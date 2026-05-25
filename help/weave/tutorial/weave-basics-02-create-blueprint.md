---
title: "Weave basics — 2. Create your first blueprint"
summary: "Create a Job Blueprint that defines a reusable step for your pipelines."
tags:
  - weave
  - blueprint
  - job-template
  - series:weave-basics
routes:
  - /pipelines/weave/jobtemplates/create
  - /pipelines/weave/jobtemplates
---

## What you will learn

- How to create a Job Blueprint through the simple wizard
- What the required fields are and what they control
- How to verify your blueprint is ready to use in a chain

## Prerequisites

- The `weave:templates:write` permission

## Step 1 — Open the Job Blueprint wizard

Navigate to **Weave → Blueprints → Job Blueprints** in the sidebar, then click
**New Job Blueprint**. This opens the simple wizard.

Alternatively, use the expert page for full JSON-level control over the spec.

## Step 2 — Fill in the blueprint details

**Name** — a unique DNS-safe name (e.g. `data-processor`). This name is used
when referencing the blueprint from a chain. It cannot be changed after creation.

**Image** — the container image to run (e.g. `registry.example.com/my-job:1.0.0`).
Use a fully qualified image reference including the tag.

**Environment variables** — optional key-value pairs injected into the container
at runtime. Click **Add variable** to add rows.

## Step 3 — Submit and verify

Click **Save**. The blueprint list opens. Your new blueprint appears in the table.

Click the blueprint row to open its detail view and confirm the spec looks
correct. You can edit the image or environment variables later, but the name is
immutable.

## What comes next

Once you have at least one blueprint, you can compose it into a chain. Continue
to part 3 to create your first chain.

---

**Series: Weave basics**
[← 1. What is Weave?](weave-basics-01-overview) · **2. Create your first blueprint** · [3. Create a chain →](weave-basics-03-create-chain)
