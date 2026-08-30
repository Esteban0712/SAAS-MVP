import { useQuery } from '@tanstack/react-query'
import { getService, getServices, serviceQueryKeys } from './services.api'
import type { ServiceListParams } from './services.types'
export const useServicesQuery = (params: ServiceListParams, enabled: boolean) => useQuery({ queryKey: serviceQueryKeys.list(params), queryFn: () => getServices(params), enabled, retry: false })
export const useServiceQuery = (id: string, enabled: boolean) => useQuery({ queryKey: serviceQueryKeys.detail(id), queryFn: () => getService(id), enabled, retry: false })
