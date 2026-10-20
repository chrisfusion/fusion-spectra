<script setup lang="ts">
import RoleAssignmentPanel from '@/components/RoleAssignmentPanel.vue'
import type { RoleAssignmentApi } from '@/components/RoleAssignmentPanel.vue'
import { bffAdminApi } from '@/api/bffAdminApi'
import type { GroupRoleAssignment, UserRoleAssignment } from '@/api/bffAdminApi'

const ROLES = ['admin', 'engineer', 'user', 'viewer']

const fromGroup = (a: GroupRoleAssignment) => ({ ...a, subject: a.group_name })
const fromUser  = (a: UserRoleAssignment)  => ({ ...a, subject: a.user_sub })

const groupApi: RoleAssignmentApi = {
  list:   async () => (await bffAdminApi.listGroupRoles()).map(fromGroup),
  create: async (group, role) => fromGroup(await bffAdminApi.createGroupRole(group, role)),
  remove: id => bffAdminApi.deleteGroupRole(id),
}

// Direct assignments by OIDC sub, for the few users no OIDC group covers.
const userApi: RoleAssignmentApi = {
  list:   async () => (await bffAdminApi.listUserRoles()).map(fromUser),
  create: async (sub, role) => fromUser(await bffAdminApi.createUserRole(sub, role)),
  remove: id => bffAdminApi.deleteUserRole(id),
}
</script>

<template>
  <div class="page-grid">
    <RoleAssignmentPanel
      title="Role Assignments"
      icon="mdi-shield-account-outline"
      subject-label="Group"
      placeholder="keycloak-group-name"
      empty-text="No assignments yet — all roles come from rbac.yaml"
      :roles="ROLES"
      :api="groupApi"
    />
    <RoleAssignmentPanel
      title="User Role Assignments"
      icon="mdi-account-key-outline"
      subject-label="User (sub)"
      placeholder="oidc-sub, e.g. 3f2a9c1e-…"
      empty-text="No user assignments — roles come from groups only"
      hint="For the few users no OIDC group covers. The sub is the user's OIDC subject (in Keycloak the user ID). These roles are added on top of the user's group roles and apply at their next login."
      :roles="ROLES"
      :api="userApi"
    />
  </div>
</template>

<style scoped>
.page-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 16px;
  align-content: start;
}
</style>
