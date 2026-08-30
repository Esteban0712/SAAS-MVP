import { apiFetch } from '@/api/client'
import type {
  Appointment,
  AppointmentList,
  AppointmentListParams,
  Availability,
  AvailabilityParams,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from './appointments.types'

export const appointmentQueryKeys = {
  all: ['appointments'] as const,
  lists: () => ['appointments', 'list'] as const,
  list: (params: AppointmentListParams) => ['appointments', 'list', params] as const,
  detail: (id: string) => ['appointments', 'detail', id] as const,
  availabilityRoot: () => ['appointments', 'availability'] as const,
  availability: (params: AvailabilityParams) => ['appointments', 'availability', params] as const,
  timezone: ['appointments', 'timezone'] as const,
}

export function getAppointments(params: AppointmentListParams) {
  const query = new URLSearchParams({
    from: params.from,
    to: params.to,
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.employeeId) query.set('employeeId', params.employeeId)
  return apiFetch<AppointmentList>(`/appointments?${query}`)
}

export const getAppointment = (id: string) => apiFetch<Appointment>(`/appointments/${id}`)

export function getAvailability(params: AvailabilityParams) {
  const query = new URLSearchParams({
    branchId: params.branchId,
    employeeId: params.employeeId,
    serviceIds: params.serviceIds.join(','),
    from: params.from,
    to: params.to,
  })
  if (params.excludeAppointmentId) query.set('excludeAppointmentId', params.excludeAppointmentId)
  return apiFetch<Availability>(`/appointments/availability?${query}`)
}

export function createAppointment(input: CreateAppointmentInput) {
  return apiFetch<Appointment>('/appointments', { method: 'POST', body: JSON.stringify(input) })
}

export function updateAppointment(id: string, input: UpdateAppointmentInput) {
  return apiFetch<Appointment>(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}
