export interface Customer {
  id: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  active: boolean
  branchId: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomerList {
  items: Customer[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CustomerListParams {
  search: string
  page: number
  pageSize: number
}

export interface SaveCustomerInput {
  name: string
  phone: string
  email?: string
  notes?: string
  active: boolean
}
