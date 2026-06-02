## fusion-index API shape
All fields camelCase; IDs are `number`. `Artifact` has `types: TypeResponse[]`; `ArtifactVersion` has `tags: ArtifactTag[]` — both may be absent, always guard with `?? []`.
- Artifacts: `listArtifacts(params?)` (params: `name`, `tag`, `type[]`, `page` 0-based, `pageSize` → `ArtifactsPage`), `getArtifact(id)`, `createArtifact({fullName, description?})`, `deleteArtifact(id)` (cascades versions)
- Versions: `createVersion(artifactId, {version, config?})`, `deleteVersion(artifactId, semver)` (backend cleans files — frontend does NOT delete individually), `listVersions(artifactId)` → bare `ArtifactVersion[]` newest first
- Files: `uploadFile(artifactId, semver, file)` (multipart, field `file`), `listFiles(artifactId, semver)` → `ArtifactFile[]` with `sizeBytes/downloadUrl/contentType/status`, `getFileDownloadUrl(artifactId, semver, fileId)`
- Types: `listTypes()`, `createType({name, description?})` (409 on duplicate), `updateType(id, payload)`, `deleteType(id)`
- Admin maintenance (permission `index:admin:manage`): `GET/DELETE /api/v1/admin/artifacts/empty`, `/admin/versions/empty`, `/admin/artifacts/no-files`; GETs take `?olderThan=<RFC3339>&page=&pageSize=`; DELETEs return `{ deleted, skipped }` (skipped = protected tag); BFF rules must precede the `GET /api/index/*` catch-all in `rbac.yaml`

## fusion-index metrics
- `getMetrics()` in `indexApi.ts` → `GET /api/index/q/metrics` (permission `index:metrics:read`, all roles); returns `RegistrySnapshot`: `totalArtifacts`, `totalVersions`, `totalTags`, `filesAvailable`, `filesPending`, `filesError`, `totalStorageBytes`, `artifactsWithoutTags`, `artifactsWithoutVersions`, `typeCounts: {typeName, count}[]`; TTL-cached 60s server-side

## Fusion Index pages
- `src/pages/FusionIndexPage.vue` — dashboard: artifact table, recent versions, quick search (page 0, size 20)
- `src/pages/index/ArtifactListPage.vue` — paginated list (20/page), debounced name search, clickable rows → detail
- `src/pages/index/ArtifactDetailPage.vue` — metadata panel + versions table; single file → `<a>` link, multiple → `q-btn-dropdown`; Delete Artifact (`can('index:artifacts:delete')`) + Delete version per row (`can('index:versions:delete')`), both with `$q.dialog` confirm; last-version delete prompts to delete artifact too; `deletingVersions: ref<Set<string>>` tracks in-flight rows
- `src/pages/index/ArtifactCreatePage.vue` — 3-step wizard (Artifact → Version → Files): step 1 async name-availability check; step 2 semver + optional JsonEditor config; step 3 drag-and-drop upload with orphan recovery; semver regex `/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/`
- `src/pages/index/ArtifactVersionCreatePage.vue` — 2-step wizard (Version → Files): NaN guard on `:id`; `createdVersion` ref locks Back/Submit once version exists (orphan recovery)

## Fusion Index navigation (navigation.ts)
Context `fusion-index` has two groups:
- **Registry**: Dashboard → `/fusion-index`, Artifact List → `/fusion-index/artifacts`, Create Artifact → `/fusion-index/artifacts/create`
- **Monitoring**: Overview → `/fusion-index/monitoring` (placeholder)

Fusion Index routes: `/fusion-index` → `FusionIndexPage`, `/fusion-index/artifacts` → `ArtifactListPage`, `/fusion-index/artifacts/create` → `ArtifactCreatePage`, `/fusion-index/artifacts/:id/versions/create` → `ArtifactVersionCreatePage`, `/fusion-index/artifacts/:id` → `ArtifactDetailPage`, `/fusion-index/:pathMatch(.*)*` → `FusionIndexPage`

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
