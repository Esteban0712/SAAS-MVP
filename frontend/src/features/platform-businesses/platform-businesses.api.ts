import { apiFetch } from '@/api/client'
import type {
  CreatePlatformBusinessInput,
  PlatformBusiness,
  PlatformBusinessDetail,
  PlatformBusinessList,
  PlatformBusinessListParams,
  UpdatePlatformBusinessInput,
} from './platform-businesses.types'

export const platformBusinessQueryKeys = {
  all: ['platform-businesses'] as const,
  lists: () => [...platformBusinessQueryKeys.all, 'list'] as const,
  list: (params: PlatformBusinessListParams) =>
    [...platformBusinessQueryKeys.lists(), params] as const,
  details: () => [...platformBusinessQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...platformBusinessQueryKeys.details(), id] as const,
}

export function getPlatformBusinesses(params: PlatformBusinessListParams) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  return apiFetch<PlatformBusinessList>(
    `/platform/businesses?${query.toString()}`,
  )
}

export function getPlatformBusiness(id: string) {
  return apiFetch<PlatformBusinessDetail>(`/platform/businesses/${id}`)
}

export function createPlatformBusiness(input: CreatePlatformBusinessInput) {
  return apiFetch<PlatformBusiness>('/platform/businesses', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updatePlatformBusiness(
  id: string,
  input: UpdatePlatformBusinessInput,
) {
  return apiFetch<PlatformBusinessDetail>(`/platform/businesses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function suspendPlatformBusiness(id: string) {
  return apiFetch<PlatformBusinessDetail>(
    `/platform/businesses/${id}/suspend`,
    {
      method: 'POST',
    },
  )
}

export function reactivatePlatformBusiness(id: string) {
  return apiFetch<PlatformBusinessDetail>(
    `/platform/businesses/${id}/reactivate`,
    {
      method: 'POST',
    },
  )
}
