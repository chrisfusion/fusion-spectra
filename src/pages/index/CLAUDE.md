## fusion-index API shape
All fields camelCase; IDs are `number`. `Artifact` has `types: TypeResponse[]`; `ArtifactVersion` has `tags: ArtifactTag[]` — both may be absent, always guard with `?? []`.
- Artifacts: `listArtifacts(params?: ArtifactListParams)` → `ArtifactsPage` — `name` (prefix), `tag`, `missingTag`, `type[]` (OR), `olderThan`, `min/maxVersions` (`maxVersions=0` = no versions), `hasFiles`, `hasIncompleteFiles`, `minTotalBytes`, `hasRetention`, `sort` (`createdAt` default | `name` | `versionCount` | `largestVersion` | `totalSize`), `order` (default asc for name, desc otherwise), `page` 0-based, `pageSize`; all filters AND-combined (fusion-index ≥ 0.6.0 — older versions made name/tag/type mutually exclusive), `getArtifact(id)`, `createArtifact({fullName, description?})`, `deleteArtifact(id)` (cascades versions)
- Versions: `listVersions(id, filterQS?, deletable?)` (filter = e.g. a `versionFilter`; `deletable=true` = exactly what a bulk delete removes), `bulkDeleteArtifactVersions(id, filterQS, dryRun)` → `DELETE /artifacts/{id}/versions` (needs `index:versions:delete` — a dry run is a DELETE too, so use the read-only list for previews), `createVersion(artifactId, {version, config?})`, `deleteVersion(artifactId, semver)` (backend cleans files — frontend does NOT delete individually), `listVersions(artifactId)` → bare `ArtifactVersion[]` newest first
- Files: `uploadFile(artifactId, semver, file)` (multipart, field `file`), `listFiles(artifactId, semver)` → `ArtifactFile[]` with `sizeBytes/downloadUrl/contentType/status`, `getFileDownloadUrl(artifactId, semver, fileId)`
- Types: `listTypes()`, `createType({name, description?})` (409 on duplicate), `updateType(id, payload)`, `deleteType(id)`
- Admin maintenance (permission `index:admin:manage`): age-based cleanups via `adminList(path, {olderThan, page, pageSize})` / `adminDelete(path, olderThan)` with `AdminCleanupPath` = `artifacts/empty` | `artifacts/no-files` | `versions/empty` | `files/incomplete` | `types/unused`; DELETEs return `{ deleted, skipped }` (skipped = protected tag); BFF rules must precede the `GET /api/index/*` catch-all in `rbac.yaml`
- Version filters (`VersionFilter`: keepLast, olderThan, from, below, hasFiles, hasIncompleteFiles, minBytes, maxBytes — AND-combined): `listAllVersions(f, page, pageSize, deletable)` → `GET /versions` (paged, any reader), `bulkDeleteVersions(f, dryRun)` → `DELETE /admin/versions` → `{deleted, skipped, dryRun, versions}`. The per-artifact `GET /artifacts/{id}/versions` still returns a bare array
- Retention: `getEffectiveRetention(id)` → `{source: artifact|types|none, rule, own, fromTypes (no typeName — map typeId via the artifact's types), versionFilter}`, `listRetentionPolicies()`, `setRetention('types'|'artifacts', id, {keepLast?, maxAgeDays?})` (PUT upsert, at least one field), `deleteRetention(scope, id)`; permission `index:retention:manage`
- Tags across artifacts: `listTags({tag?, broken?, page, pageSize})` → `TagListItem` (has `artifactName`, `version`, `broken`)
- fusion-index ≥ 0.6.0 (migrations 000009/000010) for all of the above; `Artifact` gained optional `versionCount`/`largestVersionBytes`/`totalBytes`, `ArtifactVersion` `totalBytes`

## fusion-index metrics
- `getMetrics()` in `indexApi.ts` → `GET /api/index/q/metrics` (permission `index:metrics:read`, all roles); returns `RegistrySnapshot`: `totalArtifacts`, `totalVersions`, `totalTags`, `filesAvailable`, `filesPending`, `filesError`, `totalStorageBytes`, `artifactsWithoutTags`, `artifactsWithoutVersions`, `artifactsWithoutFiles`, `versionsWithoutFiles`, `brokenTags`, `unusedTypes`, `retentionPolicies`, `typeCounts: {typeName, count}[]`, `storageBytesByBackend: {backend, bytes}[]`; TTL-cached 60s server-side

## Fusion Index pages
- `src/pages/index/ArtifactListPage.vue` — the context's landing page (the old `FusionIndexPage` dashboard was removed in 0.10.59). The **route query is the single source of truth** for filters, sort, page (1-based) and size: read via `qs/qa/qn/qb` helpers, written only via `setQuery(patch)` (drops empty keys, resets page unless `keepPage`); loads on `route.fullPath` change, guarded by `route.path` so leaving the page doesn't fire a load, and a `loadSeq` counter drops stale responses. Query uses UI units (`olderThanDays`, `minTotalMB`) converted to API params in `params`. Name cell is a real `router-link` (middle-click works); the row click ignores clicks that came from the link
  - `src/pages/index/artifactListQuery.ts` — `ARTIFACT_LIST_PATH`, the `ArtifactListQuery` keys and `ARTIFACT_VIEWS` (quick views); `artifactViewLink(id)` builds a filtered-list link — reuse it for any "show me these artifacts" link (Index Cleanup health tiles use it)
  - Type filter needs `listTypes()`, which the BFF gates on `index:types:manage` (rule `* /types*`) — viewers get 403, so the Types button hides itself on failure
- `src/pages/index/ArtifactDetailPage.vue` — metadata panel + versions table; single file → `<a>` link, multiple → `q-btn-dropdown`; Delete Artifact (`can('index:artifacts:delete')`) + Delete version per row (`can('index:versions:delete')`), both with `$q.dialog` confirm; deleting a **tagged** version warns (`.delete-tag-warning`, unscoped style) — the single delete removes the tags with it and fusion-weave resolves artifacts only by tag, whereas retention/bulk deletes always skip tagged versions; last-version delete prompts to delete artifact too; `deletingVersions: ref<Set<string>>` tracks in-flight rows
- `src/components/ArtifactRetentionPanel.vue` — Retention panel on the detail page: effective rule, own-policy edit (`can('index:retention:manage', id)`), preview of what the rule removes now (two read-only `listVersions` calls: matching vs `deletable` — the difference is the tagged versions kept), "Apply now" (`can('index:versions:delete', id)`; re-reads the rule first since `maxAgeDays` is relative to now). Emits `expiring` (semvers → "expires" badge in the version table) and `applied` (reload versions); the page bumps its `refreshKey` after tag add/remove and version delete. Rule text / input parsing: `src/utils/retention.ts`
- `src/pages/index/ArtifactCreatePage.vue` — 3-step wizard (Artifact → Version → Files): step 1 async name-availability check; step 2 semver + optional JsonEditor config; step 3 drag-and-drop upload with orphan recovery; semver regex `/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/`
- `src/pages/index/ArtifactVersionCreatePage.vue` — 2-step wizard (Version → Files): NaN guard on `:id`; `createdVersion` ref locks Back/Submit once version exists (orphan recovery)

## Fusion Index navigation (navigation.ts)
Context `fusion-index` has two groups:
- **Registry**: Artifact List → `/fusion-index/artifacts` (also the context `rootPath`), Create Artifact → `/fusion-index/artifacts/create`
- **Monitoring**: Overview → `/fusion-index/monitoring` (placeholder)

Fusion Index routes: `/fusion-index` → redirect to `/fusion-index/artifacts`, `/fusion-index/artifacts` → `ArtifactListPage`, `/fusion-index/artifacts/create` → `ArtifactCreatePage`, `/fusion-index/artifacts/:id/versions/create` → `ArtifactVersionCreatePage`, `/fusion-index/artifacts/:id` → `ArtifactDetailPage`, `/fusion-index/:pathMatch(.*)*` → redirect to the list

## Tag model
- A tag (e.g. `stable`, `latest`) is an **artifact-level named pointer** to one semver at a time — like a git tag
- `putTag(artifactId, tagName, semver)` upserts: if the tag already exists on another version it **moves** (old version silently loses it)
- `deleteTag(artifactId, tagName)` removes the tag globally — no version has it afterwards
- Inline tag editing on `ArtifactDetailPage`: `tagMutating: ref<Set<number>>` tracks in-flight version IDs; `tagAddingFor: ref<number|null>` is the row in add mode
- `ArtifactTag` shape: `{ id, artifactId, tag, versionId, createdAt, updatedAt }`

## Ext-BFF / Public API copy URLs (ArtifactDetailPage)
Two optional copy buttons per file: `mdi-content-copy` (ext-BFF URL, always shown when pattern configured) and `mdi-earth` (public URL, shown only for versions with `extBffPublicTag`, default `public`). Both hidden via `v-if` when pattern is empty string — safe without config.
- Patterns in `window.FUSION_CONFIG`: `extBffDownloadPattern`, `extBffPublicPattern`, `extBffPublicTag`; placeholders: `{artifactId}`, `{semver}`, `{fileId}`; getters in `src/config/runtime.ts`
- Single file: icon buttons inline after download link; multi-file: separate `q-btn-dropdown` buttons, each lists all files
- Clipboard: success → `$q.notify` toast; failure → `$q.dialog` with selectable `<pre class="copy-fallback-url">`
- Helm values: `config.extBffDownloadPattern/extBffPublicPattern/extBffPublicTag` in `values.yaml` → rendered by `templates/configmap.yaml`
