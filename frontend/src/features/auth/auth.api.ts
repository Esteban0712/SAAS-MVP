import { apiFetch } from '@/api/client'
import type { AuthenticatedPrincipal } from './auth.types'

export interface TenantLoginInput {
  businessSlug: string
  username: string
  password: string
}

export interface PlatformLoginInput {
  username: string
  password: string
}

export function loginTenant(input: TenantLoginInput) {
  return apiFetch<AuthenticatedPrincipal>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function loginPlatform(input: PlatformLoginInput) {
  return apiFetch<AuthenticatedPrincipal>('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getMe() {
  return apiFetch<AuthenticatedPrincipal>('/auth/me')
}

export function logout() {
  return apiFetch<void>('/auth/logout', { method: 'POST' })
}
