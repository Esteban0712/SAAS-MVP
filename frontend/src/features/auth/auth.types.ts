export interface TenantPrincipal {
  actorType: 'USER'
  userId: string
  businessId: string
  roleId: string
  username: string
  displayName: string | null
  permissions: string[]
}

export interface PlatformPrincipal {
  actorType: 'PLATFORM'
  platformUserId: string
  username: string
}

export type AuthenticatedPrincipal = TenantPrincipal | PlatformPrincipal
