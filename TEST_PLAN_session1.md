# Test Plan — Session 1

Features built this session:
1. **Delete versions** — ArtifactDetailPage: delete version (cascades files), delete artifact on last version, delete artifact directly
2. **RBAC Stage 1** — BFF route enforcement, Keycloak groups → roles → permissions, mock OIDC group selector, frontend permission gates
3. **Admin — Artifact Types CRUD** — live CRUD panel in AdminPage Global Settings section

---

## 0. Pre-flight: Helm chart updates (fusion-bff)

The BFF chart does not yet expose the two new config values or mount `rbac.yaml`.
Do these before building images.

### 0a. Add `OIDC_BYPASS_GROUPS` and `RBAC_CONFIG_PATH` to configmap.yaml

In `fusion-bff/deployment/templates/configmap.yaml`, inside the `{{- if .Values.config.oidcBypass }}` block, add after the existing bypass entries:

```yaml
  {{- if .Values.config.oidcBypassGroups }}
  OIDC_BYPASS_GROUPS: {{ .Values.config.oidcBypassGroups | quote }}
  {{- end }}
```

And unconditionally (outside the bypass block, near the other config entries):

```yaml
  RBAC_CONFIG_PATH: {{ .Values.config.rbacConfigPath | default "/etc/fusion-bff/rbac.yaml" | quote }}
```

### 0b. Mount rbac.yaml as a ConfigMap volume in deployment.yaml

Add a new ConfigMap resource in `fusion-bff/deployment/templates/` (e.g. `rbac-configmap.yaml`):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "fusion-bff.fullname" . }}-rbac
  namespace: {{ .Release.Namespace }}
data:
  rbac.yaml: |
    {{- .Files.Get "rbac.yaml" | nindent 4 }}
```

Copy `fusion-bff/rbac.yaml` into `fusion-bff/deployment/rbac.yaml` (Helm `.Files.Get` reads from the chart directory).

In `deployment.yaml` → `spec.volumes`:
```yaml
        - name: rbac-config
          configMap:
            name: {{ include "fusion-bff.fullname" . }}-rbac
```

In `deployment.yaml` → `spec.containers[0].volumeMounts`:
```yaml
            - name: rbac-config
              mountPath: /etc/fusion-bff
              readOnly: true
```

### 0c. Add new values to `values.yaml`

```yaml
  oidcBypassGroups: ""        # OIDC_BYPASS_GROUPS — comma-separated default groups for mock login form
  rbacConfigPath: "/etc/fusion-bff/rbac.yaml"
```

---

## 1. Build & deploy

```bash
# Enter minikube docker daemon
eval $(minikube docker-env)

# Build fusion-bff (bump X.Y.Z)
cd /home/c3po/sources/fusion-platform/fusion-bff
docker build -t fusion-bff:X.Y.Z .

# Build fusion-spectra (bump X.Y.Z)
cd /home/c3po/sources/fusion-platform/fusion-spectra
docker build -t fusion-spectra:X.Y.Z .

# Deploy fusion-bff
helm upgrade --install fusion-bff ./deployment \
  --namespace fusion \
  --set image.repository=fusion-bff \
  --set image.tag=X.Y.Z \
  --set image.pullPolicy=Never \
  --set config.oidcBypass=true \
  --set config.oidcBypassBaseUrl=http://bff.fusion.local \
  --set config.oidcBypassGroups=platform-admin \
  --set config.sessionCookieDomain=auto \
  --set config.corsOrigins=http://spectra.fusion.local \
  --set config.postLoginRedirectUrl=http://spectra.fusion.local/ \
  --set secret.create=false

# Deploy fusion-spectra
helm upgrade --install fusion-spectra ./deployment \
  -f ./deployment/values-dev.yaml \
  --set image.tag=X.Y.Z \
  --namespace fusion

# Verify pods are Running
kubectl get pods -n fusion
```

---

## 2. RBAC

### 2.1 `/bff/userinfo` returns roles and permissions

```bash
# 1. Open browser → http://spectra.fusion.local → redirected to mock login form
# 2. Select group "platform-admin" in the Groups selector → Login
# 3. In browser devtools or curl:
curl -s -b /tmp/bff-cookies.txt http://bff.fusion.local/bff/userinfo | jq .
```

**Expected:**
```json
{
  "sub": "dev-user",
  "email": "dev@local",
  "name": "Dev User",
  "roles": ["admin"],
  "permissions": ["admin:roles:manage","admin:users:view","forge:builds:create","forge:builds:read","index:artifacts:delete","index:artifacts:read","index:artifacts:write","index:types:manage","index:versions:delete","index:versions:write"]
}
```

Repeat for each group and verify correct role/permission set:

| Group | Expected roles | Key permissions present |
|---|---|---|
| `platform-admin`  | `[admin]`    | all 10 permissions |
| `team-data`       | `[engineer]` | `index:artifacts:write`, NO `index:artifacts:delete` |
| `platform-viewer` | `[viewer]`   | `index:artifacts:read` only, NO write/delete |
| *(no group)*      | `[]`         | `[]` |

### 2.2 BFF route enforcement — 403 for missing permission

Login as `platform-viewer`, then attempt protected routes:

```bash
# Should be 200 (viewer has index:artifacts:read)
curl -s -o /dev/null -w "%{http_code}" -b cookies.txt \
  http://bff.fusion.local/api/index/api/v1/artifacts
# Expected: 200

# Should be 403 (viewer lacks index:artifacts:write)
curl -s -o /dev/null -w "%{http_code}" -b cookies.txt \
  -X POST http://bff.fusion.local/api/index/api/v1/artifacts \
  -H "Content-Type: application/json" -d '{"fullName":"x"}'
# Expected: 403

# Should be 403 (viewer lacks index:artifacts:delete)
curl -s -o /dev/null -w "%{http_code}" -b cookies.txt \
  -X DELETE http://bff.fusion.local/api/index/api/v1/artifacts/1
# Expected: 403
```

### 2.3 Admin route guard (frontend)

Login as `platform-viewer`. In browser navigate to `http://spectra.fusion.local/#/admin`.

**Expected:** redirected to `/data`.

Login as `platform-admin`. Navigate to `#/admin`.

**Expected:** AdminPage loads.

### 2.4 Admin icon visibility in ActivityRail

- Login as `platform-viewer` → Admin icon (gear/shield) at bottom of activity rail **not visible**.
- Login as `platform-admin` → Admin icon **visible**.

### 2.5 Delete buttons gated by permission

Navigate to any ArtifactDetailPage.

- Logged in as `platform-viewer` → **Delete Artifact** button not rendered; trash icons next to versions not rendered.
- Logged in as `team-data` (engineer — has write but NOT delete) → same: delete buttons not rendered.
- Logged in as `platform-admin` → **Delete Artifact** button visible; trash icons next to versions visible.

### 2.6 Mock OIDC login form group selector

Navigate to `http://bff.fusion.local/bff/login` (or open the app unauthenticated).

**Expected:** Login form shows a **Groups** multi-select populated with `platform-admin`, `team-data`, `team-ml`, `platform-viewer`. Default selection is `platform-admin` (from `OIDC_BYPASS_GROUPS`).

Select multiple groups (e.g. `team-data` + `platform-viewer`). Resulting permissions should be union of both roles (engineer ∪ viewer = engineer).

---

## 3. Delete versions

*Prerequisite: logged in as `platform-admin`.*

### 3.1 Delete a version (has files)

1. Navigate to an artifact that has ≥2 versions with files.
2. Click the trash icon on a version that is NOT the last.
3. Confirm dialog.
4. **Expected:** row disappears, no 4xx error toast. Re-fetch the version list (refresh panel) to confirm it's gone.

### 3.2 Delete last version → prompt to delete artifact

1. Navigate to an artifact with exactly 1 version.
2. Delete that version. Confirm first dialog.
3. **Expected:** A second dialog appears: "No versions remaining. Delete the artifact too?"
4. Click **Keep** → artifact detail page remains, versions table shows empty.
5. Repeat: delete last version again, click **Delete Artifact** → navigated to `/fusion-index/artifacts`, artifact not in list.

### 3.3 Delete artifact directly

1. Navigate to any artifact with versions.
2. Click **Delete Artifact** button in the metadata panel header.
3. Confirm dialog.
4. **Expected:** navigated to `/fusion-index/artifacts`, artifact gone from list.

### 3.4 Spinner while delete in-flight

If network is slow (throttle in devtools), confirm the trash icon shows a spinner and the button is disabled during the request.

---

## 4. Admin — Artifact Types CRUD

*Prerequisite: logged in as `platform-admin`, navigate to `#/admin`.*

### 4.1 Global Settings section visible

Scroll below the Users / Platform Services / System Config panels.

**Expected:** A "Global Settings" section header followed by an **Artifact Types** panel loading from the API.

### 4.2 Create a type

1. Click **Add Type** in the panel header.
2. A new inline row appears at the top of the table with name and description inputs.
3. Type `model` in the name field, `ML model artifact` in description.
4. Press Enter or click the checkmark.
5. **Expected:** row saved, `model` appears in the table as an `fs-badge--info` chip.
6. Refresh page → type still present (confirmed from DB).

**Edge cases:**
- Submit with empty name → inline error "Name is required", row stays open.
- Create a type with an already-used name → API 409 error shown inline.
- Press Escape → inline row disappears, no type created.

### 4.3 Edit a type

1. Click the pencil icon on an existing type row.
2. Inputs appear pre-filled with current name and description.
3. Change the name to `ml-model`, press Enter.
4. **Expected:** row updates in-place.
5. Press Escape while editing → original values restored, edit cancelled.

### 4.4 Delete a type

1. Click the trash icon on a type.
2. Confirm dialog: "Delete type **model**? This will remove it from all artifacts."
3. Click **Delete**.
4. **Expected:** row disappears, toast not shown (silent success). Refresh confirms it's gone.
5. Click trash, then click **Cancel** in the dialog → type remains.

### 4.5 Types permission enforcement (BFF)

Login as `platform-viewer`, then:

```bash
# Should be 403 (viewer lacks index:types:manage)
curl -s -o /dev/null -w "%{http_code}" -b cookies.txt \
  -X POST http://bff.fusion.local/api/index/api/v1/types \
  -H "Content-Type: application/json" -d '{"name":"test"}'
# Expected: 403
```

---

## 5. Regression checks

Quick smoke tests to confirm existing functionality is unbroken:

| Check | How | Expected |
|---|---|---|
| Auth flow still works | Open app unauthenticated → mock login → lands on `/data` | Pass |
| Artifact list loads | Navigate to Fusion Index → Artifact List | Table populates |
| Create artifact wizard | Create a new artifact with a version and file upload | Completes all 3 steps |
| Forge venv list | Navigate to Forge → Venv Builds | Table loads (empty or with data) |
| Theme switching | Toggle through themes in settings | Styles update everywhere |
| Session persists | Hard-refresh the page while logged in | Stays logged in |
| Logout | Click logout | Redirected to mock login form |
