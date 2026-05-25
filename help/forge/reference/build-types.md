---
title: "Build types reference"
summary: "Comparison of the three Forge build types: Venv, Python Builder, and Generic Builder."
tags:
  - forge
  - reference
  - build-types
routes:
  - /forge/venvs
  - /forge/gitops-builder/create
---

## Overview

Forge supports three build types. The type determines what input Forge expects
and how it resolves the artifact name and version.

## Venv (`requirements`)

| Property | Value |
|---|---|
| **Input** | `requirements.txt` file (uploaded via the UI) |
| **Name source** | You supply it in the form |
| **Version source** | You supply it in the form |
| **Use case** | Plain Python package lists with no project structure |

Forge installs the listed packages into a virtual environment and archives the
result. No Git access required.

## Python Builder (`git`)

| Property | Value |
|---|---|
| **Input** | Git repository URL |
| **Name source** | `pyproject.toml` or manually overridden |
| **Version source** | `pyproject.toml` or manually overridden |
| **Metadata source options** | `full`, `version`, `manual` |
| **Use case** | Python projects that follow standard packaging |

`metadata_source` controls what Forge reads from `pyproject.toml`:

- `full` — reads name and version from `pyproject.toml`
- `version` — you supply name, Forge reads version from `pyproject.toml`
- `manual` — you supply both name and version

## Generic Builder (`app`)

| Property | Value |
|---|---|
| **Input** | Git repository URL |
| **Name source** | `metadata.yaml` (always — cannot override) |
| **Version source** | `metadata.yaml` (always — cannot override) |
| **Use case** | Non-Python projects with a `metadata.yaml` descriptor |

`metadata.yaml` must define `name`, `version`, and `runner`.

## Choosing a type

```
requirements.txt file available?  →  Venv
Python project with pyproject.toml?  →  Python Builder
Anything else with metadata.yaml?  →  Generic Builder
```

## API values

The `buildType` field in API responses uses these values:

| UI label | API value |
|---|---|
| Venv | `requirements` |
| Python Builder | `git` |
| Generic Builder | `app` |
