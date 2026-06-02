## Admin page
- `src/pages/AdminPage.vue` — navigation hub: 2-column card grid, one card per admin section; live cards navigate on click, placeholder cards show "soon" badge
  - Live: Role Assignments (`/admin/roles`), Resource Permissions (`/admin/permissions`), Artifact Types (`/admin/types`), Service Status Overrides (`/admin/health`), Index Cleanup (`/admin/index-cleanup`), Forge Cleanup (`/admin/forge-cleanup`)
  - Placeholder: All Users, Platform Services, Configuration, Integrations, Audit Log

## Admin sub-pages
- `src/pages/admin/ForgeCleanupPage.vue` — two-panel forge maintenance page at `/admin/forge-cleanup`; top panel: bulk-delete terminal (FAILED/SUCCESS) builds by type and age (`forge:builds:delete`); bottom panel: zombie cleanup — removes stuck PENDING/BUILDING builds whose CIBuild CR is gone (`forge:admin:manage`, admin-only); both panels use the filter-and-fire pattern (no preview table); result bar shows `deleted.length` count + per-item failure list; `BulkDeleteBuildsResult.deleted` is an array of IDs, not a count
- `src/pages/admin/IndexCleanupPage.vue` — three-panel index maintenance at `/admin/index-cleanup` (empty artifacts, versions without files, artifacts without files); preview-before-delete pattern with `olderThan` filter, paginated table, and "Delete All" button; `$q.dialog` confirm; permission `index:admin:manage`
- `src/pages/admin/ArtifactTypesPage.vue` — Artifact Types CRUD; inline create row, inline edit, delete with `$q.dialog`; backed by `indexApi` types endpoints
- `src/pages/admin/ResourcePermissionsPage.vue` — Resource Permissions CRUD at `/admin/permissions`; table with subject_type/subject/permission/resource_type/resource_id/created_by/actions; filter bar: resource_type dropdown + resource_id text (client-side); "Add Grant" form: subject_type select → subject + permission + resource_type + resource_id; subjects/permissions/groups loaded from `GET /bff/admin/rbac-config`; delete with `$q.dialog`
- `src/pages/admin/ServiceStatusOverridesPage.vue` — Service Health Overrides at `/admin/health`; BFF endpoints: `GET/PUT /bff/admin/service-status/:service`, `DELETE /bff/admin/service-status/:service` (all require `admin:health:manage`); `GET /bff/system-health` — any logged-in user; valid services: `forge`, `index`, `weave`, `spectra`; valid statuses: `Healthy`, `Unhealthy`, `Offline`, `Maintenance`; guard display with `SERVICE_LABELS[svc.name] ?? svc.name`

## BFF admin API
- `src/api/bffAdminApi.ts` — typed admin API client
  - `listResourcePermissions()` / `createResourcePermission()` / `deleteResourcePermission()` → `/bff/admin/resource-permissions`
  - `getRBACConfig()` → `/bff/admin/rbac-config` returns `{roles, groups, permissions}` for dropdown population
  - `listServiceStatusOverrides`, `upsertServiceStatusOverride`, `deleteServiceStatusOverride` → `/bff/admin/service-status`

## Admin routes (router/index.ts)
All `adminOnly: true`: `/admin/roles` → `RoleAssignmentsPage`, `/admin/permissions` → `ResourcePermissionsPage`, `/admin/types` → `ArtifactTypesPage`, `/admin/health` → `ServiceStatusOverridesPage`, `/admin/index-cleanup` → `IndexCleanupPage`, `/admin/forge-cleanup` → `ForgeCleanupPage`, `/admin/:pathMatch(.*)*` → `AdminPage`
