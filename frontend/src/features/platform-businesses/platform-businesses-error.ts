import { ApiError } from '@/api/client'

export function platformBusinessErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return 'Revisa los datos introducidos.'
    if (error.status === 401)
      return 'Tu sesión ha caducado. Vuelve a iniciar sesión.'
    if (error.status === 403)
      return 'No tienes acceso a la administración de plataforma.'
    if (error.status === 409) return 'Ya existe un negocio con ese slug.'
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo.'
}
