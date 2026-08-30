import { apiFetch } from '@/api/client'
import type { SaveServiceInput, Service, ServiceList, ServiceListParams } from './services.types'
export const serviceQueryKeys = { all: ['services'] as const, lists: () => ['services', 'list'] as const, list: (params: ServiceListParams) => ['services', 'list', params] as const, detail: (id: string) => ['services', 'detail', id] as const }
export function getServices(params: ServiceListParams) { const q = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) }); if (params.search) q.set('search', params.search); return apiFetch<ServiceList>(`/services?${q}`) }
export const getService = (id: string) => apiFetch<Service>(`/services/${id}`)
export function createService(input: SaveServiceInput) { return apiFetch<Service>('/services', { method: 'POST', body: JSON.stringify(input) }) }
export function updateService(id: string, input: SaveServiceInput) { return apiFetch<Service>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(input) }) }
