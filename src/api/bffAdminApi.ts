import { bffFetch, bffGet } from './bffClient'

export interface GroupRoleAssignment {
  id: number
  group_name: string
  role_name: string
  created_by: string
  created_at: string
}

export interface ResourcePermission {
  id:            number
  subject_type:  'user' | 'group' | 'role'
  subject:       string
  permission:    string
  resource_type: string
  resource_id:   string
  created_by:    string
  created_at:    string
}

export interface ResourcePermissionCreate {
  subject_type:  'user' | 'group' | 'role'
  subject:       string
  permission:    string
  resource_type: string
  resource_id:   string
}

export interface RBACConfigResponse {
  roles:       string[]
  groups:      string[]
  permissions: string[]
}

export const bffAdminApi = {
  listGroupRoles(): Promise<GroupRoleAssignment[]> {
    return bffGet<GroupRoleAssignment[]>('/bff/admin/group-roles')
  },

  createGroupRole(group: string, role: string): Promise<GroupRoleAssignment> {
    return bffFetch('/bff/admin/group-roles', {
      method: 'POST',
      body: JSON.stringify({ group, role }),
    }).then(r => r.json() as Promise<GroupRoleAssignment>)
  },

  async deleteGroupRole(id: number): Promise<void> {
    await bffFetch(`/bff/admin/group-roles/${id}`, { method: 'DELETE' })
  },

  listResourcePermissions(): Promise<ResourcePermission[]> {
    return bffGet<ResourcePermission[]>('/bff/admin/resource-permissions')
  },

  createResourcePermission(payload: ResourcePermissionCreate): Promise<ResourcePermission> {
    return bffFetch('/bff/admin/resource-permissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(r => r.json() as Promise<ResourcePermission>)
  },

  async deleteResourcePermission(id: number): Promise<void> {
    await bffFetch(`/bff/admin/resource-permissions/${id}`, { method: 'DELETE' })
  },

  getRBACConfig(): Promise<RBACConfigResponse> {
    return bffGet<RBACConfigResponse>('/bff/admin/rbac-config')
  },
}
