import { apiFetch } from '@/api/client'
import type {
  Customer,
  CustomerList,
  CustomerListParams,
  SaveCustomerInput,
} from './customers.types'

export const customerQueryKeys = {
  all: ['customers'] as const,
  lists: () => [...customerQueryKeys.all, 'list'] as const,
  list: (params: CustomerListParams) =>
    [...customerQueryKeys.lists(), params] as const,
}

export function getCustomers(params: CustomerListParams) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.search) query.set('search', params.search)
  return apiFetch<CustomerList>(`/customers?${query.toString()}`)
}

export function createCustomer(input: SaveCustomerInput) {
  return apiFetch<Customer>('/customers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateCustomer(id: string, input: SaveCustomerInput) {
  return apiFetch<Customer>(`/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
