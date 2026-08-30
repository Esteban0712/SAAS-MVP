export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'RESCHEDULED'

export interface AppointmentServiceSnapshot {
  id: string
  serviceId: string
  serviceNameSnapshot: string
  priceSnapshot: string
  durationMinutesSnapshot: number
}

export interface Appointment {
  id: string
  businessId: string
  branchId: string
  customerId: string
  employeeId: string
  originalAppointmentId: string | null
  status: AppointmentStatus
  startAt: string
  endAt: string
  notes: string | null
  createdAt: string
  updatedAt: string
  branch: { id: string; name: string }
  customer: { id: string; name: string; phone: string }
  employee: { id: string; displayName: string }
  services: AppointmentServiceSnapshot[]
  totalDurationMinutes: number
  totalPrice: string
}

export interface AppointmentList {
  items: Appointment[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  timezone: string
}

export interface AppointmentListParams {
  from: string
  to: string
  page: number
  pageSize: number
  employeeId?: string
}

export interface AvailabilityParams {
  branchId: string
  employeeId: string
  serviceIds: string[]
  from: string
  to: string
  excludeAppointmentId?: string
}

export interface AvailabilitySlot {
  startAt: string
  endAt: string
  localStart: string
  localEnd: string
  offset: string
}

export interface Availability {
  timezone: string
  durationMinutes: number
  from: string
  to: string
  days: Array<{ date: string; slots: AvailabilitySlot[] }>
}

export interface CreateAppointmentInput {
  branchId: string
  customerId: string
  employeeId: string
  serviceIds: string[]
  startAt: string
  notes?: string
}

export type UpdateAppointmentInput =
  | { action: 'EDIT'; customerId?: string; serviceIds?: string[]; notes?: string }
  | {
      action: 'RESCHEDULE'
      branchId?: string
      employeeId?: string
      serviceIds?: string[]
      startAt: string
      notes?: string
    }
  | { action: 'STATUS'; status: AppointmentStatus; notes?: string }
