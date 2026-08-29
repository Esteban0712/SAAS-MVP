export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED'

export interface UserSummary {
  id: string
  businessId: string
  roleId: string
  username: string
  status: UserStatus
  mustChangePassword: boolean
  isOwner: boolean
  email: string | null
  phone: string | null
  displayName: string | null
  createdAt: string
  updatedAt: string
  role: { id: string; name: string }
}

export interface PermissionSummary {
  id: string
  code: string
  name: string
  description: string | null
  module: string | null
}

export interface RoleSummary {
  id: string
  businessId: string
  name: string
  active: boolean
  isSystemDefault: boolean
  description: string | null
  createdAt: string
  updatedAt: string
  permissions: PermissionSummary[]
}

export interface CreateUserInput {
  roleId: string
  username: string
  password: string
  status: UserStatus
  displayName?: string
  email?: string
  phone?: string
}

export type UpdateUserInput = Omit<CreateUserInput, 'password'>

export interface SaveRoleInput {
  name: string
  description?: string
  active: boolean
  permissionIds: string[]
}
