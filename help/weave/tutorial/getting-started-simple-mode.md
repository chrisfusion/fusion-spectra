---
title: "Getting started: wizards and your runs"
summary: "Start a job, cron job or service with a wizard and follow its progress — no chains, steps or blueprints needed."
tags:
  - wizard
  - tutorial
  - getting-started
  - simple-mode
routes:
  - /dashboard
  - /wizards
  - /wizards/runs
---

## What you see

Fusion Spectra shows you a focused workspace with three things:

- **Home** — wizard cards to start something new, plus your recent runs at a glance
- **Wizards** — the same wizards in the sidebar, and the full list of runs
- **Help** — articles like this one

Everything else (chains, step blueprints, builds, the artifact registry) is set up for you by the
wizard in the background.

## Start something

1. On **Home**, pick the card that matches what you want:
   - **Git → …** when your code lives in a git repository (Python job, batch job, cron job, Streamlit service)
   - **Image → …** when you already have a container image (service, one-shot job, cron job)
2. Fill in the form — required fields are marked, advanced options stay collapsed.
3. Submit. You land on the run's page and can watch each provisioning step finish.

## Follow your runs

- **Home → Recent runs** shows the latest runs and how many are in progress, ready or failed.
- **Wizards → All Runs** lists every run. Tick **Only mine** to see just the runs you started.
- Open a run to see its progress, and — for services — the URL once it is ready.

## When something fails

- **Retry** re-runs the failed step; nothing already created is duplicated.
- **Roll Back** removes everything the run created.

If a retry keeps failing, use the bug icon in the top bar to report it.
