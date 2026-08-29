import { apiFetch } from '@/api/client'
import type {
  CreateUserInput,
  PermissionSummary,
  RoleSummary,
  SaveRoleInput,
  UpdateUserInput,
  UserSummary,
} from './management.types'

export const managementQueryKeys = {
  users: ['management', 'users'] as const,
  roles: ['management', 'roles'] as const,
  permissions: ['management', 'permissions'] as const,
}

export function getUsers() {
  return apiFetch<UserSummary[]>('/users')
}

export function createUser(input: CreateUserInput) {
  return apiFetch<UserSummary>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateUser(id: string, input: UpdateUserInput) {
  return apiFetch<UserSummary>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function getRoles() {
  return apiFetch<RoleSummary[]>('/roles')
}

export function createRole(input: SaveRoleInput) {
  return apiFetch<RoleSummary>('/roles', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateRole(id: string, input: SaveRoleInput) {
  return apiFetch<RoleSummary>(`/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function getPermissions() {
  return apiFetch<PermissionSummary[]>('/permissions')
}
