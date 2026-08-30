import { ApiError } from '@/api/client'

export function appointmentErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 400) return 'La cita o el horario seleccionado ya no son válidos.'
    if (error.status === 403) return 'No tienes permiso para realizar esta acción.'
    if (error.status === 404) return 'Alguno de los datos seleccionados ya no está disponible.'
    if (error.status === 409) return 'Ese horario acaba de ser ocupado. Selecciona otro slot.'
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo.'
}

export function isAppointmentConflict(error: unknown) {
  return error instanceof ApiError && error.status === 409
}
