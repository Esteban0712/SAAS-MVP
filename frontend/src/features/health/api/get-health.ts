import { apiFetch, ApiError } from '@/api/client'

export interface HealthResponse {
  status: 'ok'
  database: 'ok'
}

export async function getHealth(): Promise<HealthResponse> {
  const health = await apiFetch<HealthResponse>('/health')

  if (health.status !== 'ok' || health.database !== 'ok') {
    throw new ApiError(null)
  }

  return health
}
