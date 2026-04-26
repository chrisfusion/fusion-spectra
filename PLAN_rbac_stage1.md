# RBAC Stage 1 — Implementation Plan

## Goal

Add roles, groups, and permissions to the Fusion platform.
The BFF is the single enforcement point — fusion-index and fusion-forge need no changes.

## Scope

**Stage 1** (this plan): Static config-driven RBAC, Keycloak groups as source.
**Stage 2** (future): Dynamic DB-backed role management + Admin UI in fusion-spectra.
**Stage 3** (future): Resource-scoped group permissions.

---

## Permission model

```
Keycloak groups (JWT claim)
  └─ GroupResolver  ←── interface; Stage 1 = JWT, Stage 2 = DB or both
        │
        ▼
   group_roles map  (rbac.yaml)
        │
        ▼
   role_permissions map  (rbac.yaml)
        │
        ▼
   Session { Roles[], Permissions[] }
        │
        ├── enforced in APIAuth middleware per route
        └── exposed via GET /bff/userinfo → frontend
```

### Permission strings (initial set)

```
index:artifacts:read      index:artifacts:write    index:artifacts:delete
index:versions:write      index:versions:delete    index:types:manage
forge:builds:read         forge:builds:create
admin:users:view          admin:roles:manage
```

### Initial roles

| Role     | Permissions |
|----------|-------------|
| admin    | all |
| engineer | index:artifacts:read/write, index:versions:write, index:types:manage, forge:builds:read/create, admin:users:view |
| viewer   | index:artifacts:read, forge:builds:read |

---

## rbac.yaml (ConfigMap-mounted in K8s)

```yaml
# group_source controls the GroupResolver implementation.
# jwt  = groups from Keycloak JWT "groups" claim (Stage 1, default)
# db   = groups from fusion-platform DB by user sub (Stage 2)
# both = union of jwt + db (Stage 2)
group_source: jwt

group_roles:
  platform-admin:  [admin]
  team-data:       [engineer]
  team-ml:         [engineer]
  platform-viewer: [viewer]

role_permissions:
  admin:
    - index:artifacts:read
    - index:artifacts:write
    - index:artifacts:delete
    - index:versions:write
    - index:versions:delete
    - index:types:manage
    - forge:builds:read
    - forge:builds:create
    - admin:users:view
    - admin:roles:manage
  engineer:
    - index:artifacts:read
    - index:artifacts:write
    - index:versions:write
    - index:types:manage
    - forge:builds:read
    - forge:builds:create
    - admin:users:view
  viewer:
    - index:artifacts:read
    - forge:builds:read

# First matching rule wins. * matches one path segment.
route_permissions:
  - { method: DELETE, path: /api/index/api/v1/artifacts/*/versions/*, permission: index:versions:delete }
  - { method: DELETE, path: /api/index/api/v1/artifacts/*,            permission: index:artifacts:delete }
  - { method: POST,   path: /api/index/api/v1/artifacts/*/versions/*/files, permission: index:versions:write }
  - { method: POST,   path: /api/index/api/v1/artifacts/*/versions,   permission: index:versions:write }
  - { method: POST,   path: /api/index/api/v1/artifacts,              permission: index:artifacts:write }
  - { method: PUT,    path: /api/index/api/v1/artifacts/*/tags/*,     permission: index:artifacts:write }
  - { method: DELETE, path: /api/index/api/v1/artifacts/*/tags/*,     permission: index:artifacts:write }
  - { method: "*",    path: /api/index/api/v1/types*,                 permission: index:types:manage }
  - { method: GET,    path: /api/index/*,                             permission: index:artifacts:read }
  - { method: POST,   path: /api/forge/api/v1/venvs/validate,         permission: forge:builds:create }
  - { method: POST,   path: /api/forge/api/v1/venvs,                  permission: forge:builds:create }
  - { method: GET,    path: /api/forge/*,                             permission: forge:builds:read }
```

---

## Changes — fusion-bff

### 1. `internal/oidc/claims.go`
Add `Groups []string` to `UserClaims`.

### 2. `internal/oidc/validator.go`
Extract `groups` claim from the JWT. Normalize each entry: strip leading `/`
(Keycloak sends `/team-data`; bare `team-data` is also valid).

### 3. `internal/mockoidc/server.go`
- Add `groups []string` to `identity` struct.
- Login form: add a `<select multiple>` populated with all group keys from `rbac.yaml`
  (passed into the server at construction time). Default selection from `OIDC_BYPASS_GROUPS` env var.
- `mintJWT`: include `"groups"` claim.
- `handleAuthSubmit`: parse submitted groups from the form.

### 4. `internal/mockoidc/validator.go`
Extract `groups []string` from the mock JWT payload and populate `UserClaims.Groups`.

### 5. `internal/session/session.go`
Add `Roles []string` and `Permissions []string` to `Session`.

### 6. NEW `internal/rbac/config.go`
```go
type RBACConfig struct {
    GroupSource      string              // "jwt" | "db" | "both"
    GroupRoles       map[string][]string // group → roles
    RolePermissions  map[string][]string // role → permissions
    RoutePermissions []RouteRule
}
type RouteRule struct {
    Method     string // HTTP method or "*"
    Path       string // glob pattern with * as single-segment wildcard
    Permission string
}
func LoadConfig(path string) (*RBACConfig, error)
```

### 7. NEW `internal/rbac/engine.go`
```go
// GroupResolver interface — Stage 1: JWTResolver, Stage 2: DBResolver, MergedResolver
type GroupResolver interface {
    Resolve(ctx context.Context, sub string, jwtGroups []string) ([]string, error)
}

type JWTResolver struct{}   // passes jwtGroups through unchanged
// DBResolver and MergedResolver are stubs with comments for Stage 2

type Engine struct {
    resolver GroupResolver
    cfg      *RBACConfig
}
func NewEngine(cfg *RBACConfig) *Engine      // picks resolver based on cfg.GroupSource
func (e *Engine) Resolve(ctx, sub, jwtGroups) (roles, permissions []string, err error)
```

### 8. NEW `internal/rbac/route.go`
```go
// RoutePermission returns the required permission for (method, path),
// or "" if the route is unrestricted. First matching RouteRule wins.
// Pattern matching: literal segments match exactly; "*" matches any one segment.
func RoutePermission(rules []RouteRule, method, path string) string
```

### 9. `internal/api/handler/auth.go`
- `NewAuthHandler` receives `*rbac.Engine`.
- `Callback`: after session creation, call `engine.Resolve` and store roles+permissions.
- `UserInfo`: return `roles` and `permissions` fields alongside sub/email/name.

### 10. `internal/api/middleware/apiauth.go`
- Receive `*rbac.Engine` and `[]rbac.RouteRule`.
- After successful session auth, call `rbac.RoutePermission(rules, method, path)`.
- If a permission is required and not in `session.Permissions`, abort 403.

### 11. `cmd/server/main.go`
- Load `rbac.yaml` (path from `RBAC_CONFIG_PATH` env, default `./rbac.yaml`).
- Build `rbac.Engine`.
- Pass engine to `NewAuthHandler` and `APIAuth` middleware.
- Pass group names to `mockoidc.New` for the login form selector.

### 12. NEW `rbac.yaml`
Default config file (as shown above). Mounted via ConfigMap in K8s.

---

## Changes — fusion-spectra

### 1. `src/stores/auth.ts`
Add `roles: string[]` and `permissions: string[]` to `UserInfo`.

### 2. NEW `src/composables/usePermission.ts`
```typescript
export function usePermission() {
  const auth = useAuthStore()
  const can     = (permission: string) => auth.user?.permissions.includes(permission) ?? false
  const hasRole = (role: string)       => auth.user?.roles.includes(role) ?? false
  const isAdmin = computed(() => hasRole('admin'))
  return { can, hasRole, isAdmin }
}
```
**Why a composable over direct store reads:**
- `can('index:artifacts:delete')` reads like a sentence
- Single extension point for Stage 2 resource-scoped checks
- Call sites don't change when the logic evolves

### 3. `src/router/index.ts`
Before resolving a route with `meta.adminOnly`, check `auth.user?.roles.includes('admin')`.
If not admin, redirect to `/data`.

### 4. `src/components/ActivityRail.vue`
Hide the Admin context item if user does not have the `admin` role.

### 5. `src/pages/index/ArtifactDetailPage.vue`
Gate `confirmDeleteArtifact` button and `confirmDeleteVersion` button with
`can('index:artifacts:delete')` / `can('index:versions:delete')`.

---

## Stage 2 hooks (no code, just where to extend)

| Extension point | How Stage 2 plugs in |
|---|---|
| `GroupResolver` interface | Add `DBResolver` struct; wire when `group_source: db` or `both` |
| `rbac.yaml group_source` | Switch value; no interface change |
| `Session.Roles/Permissions` | Already there; Admin UI pages just call new BFF endpoints to manage DB entries |
| `usePermission.can()` | Add optional resource arg for scope checks without changing existing call sites |

---

## Implementation order

1. fusion-bff: rbac package (config + engine + route)
2. fusion-bff: oidc/claims + oidc/validator (groups extraction)
3. fusion-bff: session (roles + permissions fields)
4. fusion-bff: handler/auth (resolve + store + expose)
5. fusion-bff: middleware/apiauth (route enforcement)
6. fusion-bff: mockoidc (groups in JWT + login form selector)
7. fusion-bff: main.go (wire everything)
8. fusion-bff: rbac.yaml default config
9. fusion-spectra: auth store
10. fusion-spectra: usePermission composable
11. fusion-spectra: router admin guard
12. fusion-spectra: ActivityRail admin hide
13. fusion-spectra: ArtifactDetailPage permission gates
