import { useQuery } from '@tanstack/react-query'
import {
  getPlatformBusiness,
  getPlatformBusinesses,
  platformBusinessQueryKeys,
} from './platform-businesses.api'
import type { PlatformBusinessListParams } from './platform-businesses.types'

export function usePlatformBusinessesQuery(params: PlatformBusinessListParams) {
  return useQuery({
    queryKey: platformBusinessQueryKeys.list(params),
    queryFn: () => getPlatformBusinesses(params),
    retry: false,
  })
}

export function usePlatformBusinessQuery(id: string) {
  return useQuery({
    queryKey: platformBusinessQueryKeys.detail(id),
    queryFn: () => getPlatformBusiness(id),
    retry: false,
  })
}
