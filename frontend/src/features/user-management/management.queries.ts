import { useQuery } from '@tanstack/react-query'
import {
  getPermissions,
  getRoles,
  getUsers,
  managementQueryKeys,
} from './management.api'

export function useUsersQuery(enabled: boolean) {
  return useQuery({
    queryKey: managementQueryKeys.users,
    queryFn: getUsers,
    enabled,
    retry: false,
  })
}

export function useRolesQuery(enabled: boolean) {
  return useQuery({
    queryKey: managementQueryKeys.roles,
    queryFn: getRoles,
    enabled,
    retry: false,
  })
}

export function usePermissionsQuery(enabled: boolean) {
  return useQuery({
    queryKey: managementQueryKeys.permissions,
    queryFn: getPermissions,
    enabled,
    retry: false,
  })
}
