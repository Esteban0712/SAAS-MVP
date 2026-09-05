export type BusinessStatus =
  'TRIAL' | 'ACTIVE' | 'PAYMENT_PENDING' | 'SUSPENDED' | 'CANCELLED'

export interface PlatformBusiness {
  id: string
  name: string
  slug: string
  status: BusinessStatus
  timezone: string
  currency: string
  maxUsers: number
  logoUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface PlatformBusinessList {
  items: PlatformBusiness[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PlatformBusinessListParams {
  search: string
  status: BusinessStatus | ''
  page: number
  pageSize: number
}

export interface PlatformBranch {
  id: string
  businessId: string
  name: string
  isMain: boolean
  active: boolean
  address: string | null
  phone: string | null
  createdAt: string
  updatedAt: string
}

export interface PlatformBusinessDetail extends PlatformBusiness {
  taxId: string | null
  address: string | null
  phone: string | null
  settingsJson: unknown
  branches: PlatformBranch[]
  summary: {
    branches: number
    users: number
    customers: number
    employees: number
    services: number
    appointments: number
    sales: number
  }
}

export interface UpdatePlatformBusinessInput {
  name?: string
  timezone?: string
  currency?: string
  maxUsers?: number
  logoUrl?: string
  taxId?: string
  address?: string
  phone?: string
}

export interface CreatePlatformBusinessInput {
  name: string
  slug: string
  timezone: string
  currency: string
  maxUsers: number
  logoUrl?: string
  taxId?: string
  address?: string
  phone?: string
  branch: {
    name: string
    address?: string
    phone?: string
  }
  admin: {
    username: string
    password: string
    email?: string
    displayName?: string
    phone?: string
  }
}
