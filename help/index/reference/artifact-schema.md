---
title: "Artifact schema reference"
summary: "Field-by-field description of the Artifact, ArtifactVersion, and ArtifactFile objects returned by the Fusion Index API."
tags:
  - index
  - reference
  - schema
  - api
routes:
  - /fusion-index/artifacts
  - /fusion-index/artifacts/:id
---

## Artifact

| Field | Type | Description |
|---|---|---|
| `id` | number | Unique numeric identifier |
| `fullName` | string | Globally unique artifact name |
| `description` | string | Optional free-text description |
| `types` | TypeResponse[] | Attached type labels (may be empty — guard with `?? []`) |
| `createdAt` | string | ISO 8601 timestamp |
| `updatedAt` | string | ISO 8601 timestamp |

## ArtifactVersion

| Field | Type | Description |
|---|---|---|
| `id` | number | Unique numeric identifier |
| `artifactId` | number | Parent artifact ID |
| `major` | number | Major semver component |
| `minor` | number | Minor semver component |
| `patch` | number | Patch semver component |
| `preRelease` | string \| null | Pre-release label (e.g. `rc1`) |
| `buildMeta` | string \| null | Build metadata (e.g. `build.42`) |
| `config` | object \| null | Arbitrary JSON metadata stored at version creation |
| `tags` | ArtifactTag[] | Tags pointing to this version (may be absent — guard with `?? []`) |
| `createdAt` | string | ISO 8601 timestamp |

## ArtifactFile

| Field | Type | Description |
|---|---|---|
| `id` | number | Unique numeric identifier |
| `name` | string | Original filename |
| `sizeBytes` | number | File size in bytes |
| `contentType` | string | MIME type (e.g. `application/zip`) |
| `downloadUrl` | string | Relative URL path for download |
| `status` | string | Upload status (`ready`, `uploading`, `failed`) |

## ArtifactTag

| Field | Type | Description |
|---|---|---|
| `id` | number | Unique numeric identifier |
| `artifactId` | number | Parent artifact ID |
| `versionId` | number | The version this tag currently points to |
| `tag` | string | Tag name |
| `createdAt` | string | ISO 8601 timestamp |
| `updatedAt` | string | ISO 8601 timestamp (changes when tag is moved) |

## TypeResponse

| Field | Type | Description |
|---|---|---|
| `id` | number | Unique numeric identifier |
| `name` | string | Type label (e.g. `python-venv`) |
| `description` | string | Optional description |
