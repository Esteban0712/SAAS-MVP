import { useQuery } from '@tanstack/react-query'
import { customerQueryKeys, getCustomers } from './customers.api'
import type { CustomerListParams } from './customers.types'

export function useCustomersQuery(
  params: CustomerListParams,
  enabled: boolean,
) {
  return useQuery({
    queryKey: customerQueryKeys.list(params),
    queryFn: () => getCustomers(params),
    enabled,
    retry: false,
  })
}
