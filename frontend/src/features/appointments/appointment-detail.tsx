import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { appointmentQueryKeys, updateAppointment } from './appointments.api'
import { appointmentErrorMessage, isAppointmentConflict } from './appointments-error'
import { formatAppointmentTime } from './appointment-time'
import { statusLabel } from './appointment-status'
import type { Appointment, AppointmentStatus } from './appointments.types'

const transitions: Partial<Record<AppointmentStatus, Array<{ status: AppointmentStatus; label: string }>>> = {
  PENDING: [{ status: 'CONFIRMED', label: 'Confirmar' }, { status: 'CANCELLED', label: 'Cancelar' }, { status: 'NO_SHOW', label: 'No asistió' }],
  CONFIRMED: [{ status: 'IN_PROGRESS', label: 'Iniciar' }, { status: 'CANCELLED', label: 'Cancelar' }, { status: 'NO_SHOW', label: 'No asistió' }],
  IN_PROGRESS: [{ status: 'COMPLETED', label: 'Completar' }, { status: 'CANCELLED', label: 'Cancelar' }],
}

export function AppointmentDetail({ appointment, timezone, canManage, onEdit, onReschedule }: { appointment: Appointment; timezone: string; canManage: boolean; onEdit: () => void; onReschedule: () => void }) {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (status: AppointmentStatus) => updateAppointment(appointment.id, { action: 'STATUS', status }),
    onSuccess: async (saved) => {
      client.setQueryData(appointmentQueryKeys.detail(saved.id), saved)
      await client.invalidateQueries({ queryKey: appointmentQueryKeys.lists() })
      await client.invalidateQueries({ queryKey: appointmentQueryKeys.availabilityRoot() })
    },
    onError: async (error) => {
      if (isAppointmentConflict(error)) {
        await client.invalidateQueries({ queryKey: appointmentQueryKeys.lists() })
        await client.invalidateQueries({ queryKey: appointmentQueryKeys.availabilityRoot() })
      }
    },
  })
  const editable = appointment.status === 'PENDING' || appointment.status === 'CONFIRMED'
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2">
      <Info label="Horario" value={`${formatAppointmentTime(appointment.startAt, timezone)}–${formatAppointmentTime(appointment.endAt, timezone)}`} />
      <Info label="Estado" value={statusLabel(appointment.status)} />
      <Info label="Cliente" value={`${appointment.customer.name} · ${appointment.customer.phone}`} />
      <Info label="Empleado" value={`${appointment.employee.displayName} · ${appointment.branch.name}`} />
      <Info label="Servicios" value={appointment.services.map((service) => service.serviceNameSnapshot).join(', ')} />
      <Info label="Total" value={`${appointment.totalDurationMinutes} min · ${appointment.totalPrice}`} />
    </div>
    {appointment.notes && <div><p className="text-xs font-medium text-muted-foreground">Notas</p><p className="whitespace-pre-wrap text-sm">{appointment.notes}</p></div>}
    {canManage && <div className="flex flex-wrap gap-2">
      {editable && <Button size="sm" variant="outline" onClick={onEdit}>Editar</Button>}
      {editable && <Button size="sm" variant="outline" onClick={onReschedule}>Reprogramar</Button>}
      {transitions[appointment.status]?.map((action) => <Button key={action.status} size="sm" variant={action.status === 'CANCELLED' ? 'outline' : 'default'} disabled={mutation.isPending} onClick={() => mutation.mutate(action.status)}>{action.label}</Button>)}
    </div>}
    {mutation.isSuccess && <p className="text-sm text-emerald-700">Estado actualizado.</p>}
    {mutation.error && <p role="alert" className="text-sm text-destructive">{appointmentErrorMessage(mutation.error)}</p>}
  </div>
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="text-sm">{value}</p></div> }
