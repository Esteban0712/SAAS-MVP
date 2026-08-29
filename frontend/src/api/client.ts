const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number | null

  constructor(status: number | null) {
    super('No se pudo conectar con el servicio.')
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!apiBaseUrl) {
    throw new ApiError(null)
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })

    if (!response.ok) {
      throw new ApiError(response.status)
    }

    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(null)
  }
}
