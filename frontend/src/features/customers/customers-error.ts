import { ApiError } from '@/api/client'

export function customerErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'No tienes permiso para realizar esta acción.'
    if (error.status === 404) return 'El cliente ya no está disponible.'
    if (error.status === 409) return 'Ya existe un cliente con ese teléfono.'
    if (error.status === 400) return 'Revisa los datos introducidos.'
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo.'
}
