import { useQuery } from '@tanstack/react-query'
import { appointmentQueryKeys, getAppointment, getAppointments, getAvailability } from './appointments.api'
import type { AppointmentListParams, AvailabilityParams } from './appointments.types'

export const useAppointmentsQuery = (params: AppointmentListParams, enabled: boolean) =>
  useQuery({ queryKey: appointmentQueryKeys.list(params), queryFn: () => getAppointments(params), enabled, retry: false })

export const useAppointmentQuery = (id: string, enabled: boolean) =>
  useQuery({ queryKey: appointmentQueryKeys.detail(id), queryFn: () => getAppointment(id), enabled, retry: false })

export const useAvailabilityQuery = (params: AvailabilityParams, enabled: boolean) =>
  useQuery({ queryKey: appointmentQueryKeys.availability(params), queryFn: () => getAvailability(params), enabled, retry: false })

export const useAppointmentTimezoneQuery = (enabled: boolean) =>
  useQuery({
    queryKey: appointmentQueryKeys.timezone,
    queryFn: async () => {
      const now = new Date()
      const result = await getAppointments({
        from: new Date(now.getTime() - 86_400_000).toISOString(),
        to: new Date(now.getTime() + 86_400_000).toISOString(),
        page: 1,
        pageSize: 1,
      })
      return result.timezone
    },
    enabled,
    staleTime: 30 * 60_000,
    retry: false,
  })
