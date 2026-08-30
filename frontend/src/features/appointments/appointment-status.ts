import type { AppointmentStatus } from './appointments.types'

export function statusLabel(status: AppointmentStatus) {
  return ({
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmada',
    IN_PROGRESS: 'En curso',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
    NO_SHOW: 'No asistió',
    RESCHEDULED: 'Reprogramada',
  } as Record<AppointmentStatus, string>)[status]
}
