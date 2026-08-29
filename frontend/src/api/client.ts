const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number | null

  constructor(status: number | null) {
    super('No se pudo conectar con el servicio.')
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(path: string): Promise<T> {
  if (!apiBaseUrl) {
    throw new ApiError(null)
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new ApiError(response.status)
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(null)
  }
}
