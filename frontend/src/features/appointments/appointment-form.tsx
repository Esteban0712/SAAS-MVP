import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCustomersQuery } from '@/features/customers/customers.queries'
import { useEmployeeServicesQuery, useEmployeesQuery } from '@/features/employees/employees.queries'
import { appointmentQueryKeys, createAppointment, updateAppointment } from './appointments.api'
import { appointmentErrorMessage, isAppointmentConflict } from './appointments-error'
import { useAvailabilityQuery } from './appointments.queries'
import type { Appointment } from './appointments.types'

const schema = z.object({
  customerId: z.string().uuid('Selecciona un cliente.'),
  employeeId: z.string().uuid('Selecciona un empleado.'),
  branchId: z.string().uuid('Selecciona una sucursal.'),
  serviceIds: z.array(z.string().uuid()).min(1, 'Selecciona al menos un servicio.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona una fecha.'),
  startAt: z.string().min(1, 'Selecciona un horario disponible.'),
  notes: z.string().max(2000, 'Máximo 2000 caracteres.'),
})
type Values = z.infer<typeof schema>

interface Props {
  mode: 'create' | 'edit' | 'reschedule'
  appointment?: Appointment
  initialDate: string
  canReadCustomers: boolean
  canReadEmployees: boolean
  timezone: string
  onClose: () => void
  onSaved: (appointment: Appointment) => void
}

export function AppointmentForm({ mode, appointment, initialDate, canReadCustomers, canReadEmployees, timezone, onClose, onSaved }: Props) {
  const client = useQueryClient()
  const customers = useCustomersQuery({ search: '', page: 1, pageSize: 100 }, canReadCustomers)
  const employees = useEmployeesQuery({ search: '', page: 1, pageSize: 100 }, canReadEmployees)
  const form = useForm<Values>({
    defaultValues: {
      customerId: appointment?.customerId ?? '',
      employeeId: appointment?.employeeId ?? '',
      branchId: appointment?.branchId ?? '',
      serviceIds: appointment?.services.map((service) => service.serviceId) ?? [],
      date: initialDate,
      startAt: '',
      notes: appointment?.notes ?? '',
    },
  })
  const employeeId = useWatch({ control: form.control, name: 'employeeId' })
  const branchId = useWatch({ control: form.control, name: 'branchId' })
  const serviceIds = useWatch({ control: form.control, name: 'serviceIds' })
  const date = useWatch({ control: form.control, name: 'date' })
  const startAt = useWatch({ control: form.control, name: 'startAt' })
  const assigned = useEmployeeServicesQuery(employeeId, canReadEmployees && Boolean(employeeId))
  const availabilityParams = { branchId, employeeId, serviceIds, from: date, to: date, excludeAppointmentId: mode === 'reschedule' ? appointment?.id : undefined }
  const availability = useAvailabilityQuery(availabilityParams, mode !== 'edit' && Boolean(branchId && employeeId && date && serviceIds.length))

  useEffect(() => {
    if (mode === 'edit') return
    const employee = employees.data?.items.find((item) => item.id === employeeId)
    if (employee && form.getValues('branchId') !== employee.branchId) form.setValue('branchId', employee.branchId)
  }, [employeeId, employees.data, form, mode])

  useEffect(() => {
    if (mode !== 'edit') form.setValue('startAt', '')
  }, [branchId, employeeId, serviceIds, date, form, mode])

  const mutation = useMutation({
    mutationFn: (values: Values) => {
      if (mode === 'edit' && appointment) {
        return updateAppointment(appointment.id, { action: 'EDIT', customerId: values.customerId, serviceIds: values.serviceIds, notes: values.notes.trim() })
      }
      if (mode === 'reschedule' && appointment) {
        return updateAppointment(appointment.id, { action: 'RESCHEDULE', branchId: values.branchId, employeeId: values.employeeId, serviceIds: values.serviceIds, startAt: values.startAt, notes: values.notes.trim() })
      }
      return createAppointment({ branchId: values.branchId, customerId: values.customerId, employeeId: values.employeeId, serviceIds: values.serviceIds, startAt: values.startAt, notes: values.notes.trim() })
    },
    onSuccess: async (saved) => {
      client.setQueryData(appointmentQueryKeys.detail(saved.id), saved)
      if (appointment) await client.invalidateQueries({ queryKey: appointmentQueryKeys.detail(appointment.id) })
      await client.invalidateQueries({ queryKey: appointmentQueryKeys.lists() })
      await client.invalidateQueries({ queryKey: appointmentQueryKeys.availabilityRoot() })
      onSaved(saved)
    },
    onError: async (error) => {
      if (isAppointmentConflict(error)) {
        await client.invalidateQueries({ queryKey: appointmentQueryKeys.lists() })
        await client.invalidateQueries({ queryKey: appointmentQueryKeys.availabilityRoot() })
      }
    },
  })

  const submit = form.handleSubmit(async (raw) => {
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string') form.setError(field as keyof Values, { message: issue.message })
      }
      return
    }
    await mutation.mutateAsync(parsed.data).catch(() => undefined)
  })

  if (!canReadCustomers || !canReadEmployees) {
    return <p role="alert" className="text-sm text-destructive">Para gestionar citas también necesitas acceso de lectura a clientes y empleados.</p>
  }
  const slots = availability.data?.days[0]?.slots ?? []
  const selected = serviceIds ?? []
  const toggleService = (id: string) => form.setValue('serviceIds', selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id], { shouldValidate: true })

  return <form className="space-y-5" onSubmit={submit} noValidate>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Cliente" error={form.formState.errors.customerId?.message}>
        <select className={selectClass} disabled={mode === 'reschedule'} {...form.register('customerId')}><option value="">Selecciona un cliente</option>{customers.data?.items.filter((item) => item.active || item.id === appointment?.customerId).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.phone}</option>)}</select>
      </Field>
      {mode !== 'edit' && <Field label="Empleado" error={form.formState.errors.employeeId?.message}>
        <select className={selectClass} {...form.register('employeeId')}><option value="">Selecciona un empleado</option>{employees.data?.items.filter((item) => item.active || item.id === appointment?.employeeId).map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.branch.name}</option>)}</select>
      </Field>}
      {mode !== 'edit' && <input type="hidden" {...form.register('branchId')} />}
      {mode !== 'edit' && <Field label="Fecha" error={form.formState.errors.date?.message}><Input type="date" {...form.register('date')} /></Field>}
      <Field label="Notas" error={form.formState.errors.notes?.message} className={mode === 'edit' ? '' : 'md:col-span-2'}><textarea className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm" {...form.register('notes')} /></Field>
    </div>

    <section className="space-y-2">
      <div><h3 className="text-sm font-medium">Servicios</h3><p className="text-xs text-muted-foreground">Solo se muestran los servicios asignados al empleado.</p></div>
      {assigned.isPending && <p className="text-sm text-muted-foreground">Cargando servicios…</p>}
      {assigned.data?.length === 0 && <p className="text-sm text-muted-foreground">El empleado no tiene servicios asignados.</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {assigned.data?.map((service) => <label key={service.id} className="flex gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" className="mt-1 size-4" checked={selected.includes(service.id)} onChange={() => toggleService(service.id)} /><span><strong className="block">{service.name}</strong><span className="text-muted-foreground">{service.durationMinutes} min · {service.price}</span></span></label>)}
      </div>
      {form.formState.errors.serviceIds && <p className="text-xs text-destructive">{form.formState.errors.serviceIds.message}</p>}
    </section>

    {mode !== 'edit' && <section className="space-y-2"><h3 className="text-sm font-medium">Horario disponible</h3>
      {availability.isPending && <p className="text-sm text-muted-foreground">Consultando disponibilidad…</p>}
      {availability.error && <p role="alert" className="text-sm text-destructive">{appointmentErrorMessage(availability.error)}</p>}
      {availability.data && slots.length === 0 && <p className="text-sm text-muted-foreground">No quedan horarios para esta selección.</p>}
      <div className="flex flex-wrap gap-2">{slots.map((slot) => <label key={slot.startAt} className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${startAt === slot.startAt ? 'border-primary bg-primary text-primary-foreground' : ''}`}><input type="radio" className="sr-only" value={slot.startAt} {...form.register('startAt')} />{slot.localStart.slice(11, 16)}–{slot.localEnd.slice(11, 16)}</label>)}</div>
      {availability.data && <p className="text-xs text-muted-foreground">Timezone: {availability.data.timezone} · {availability.data.durationMinutes} min</p>}
      {form.formState.errors.startAt && <p className="text-xs text-destructive">{form.formState.errors.startAt.message}</p>}
    </section>}

    <div className="flex flex-wrap items-center gap-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : mode === 'reschedule' ? 'Reprogramar cita' : 'Guardar cita'}</Button><Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>{mutation.isSuccess && <span className="text-sm text-emerald-700">Cita guardada.</span>}</div>
    {mutation.error && <p role="alert" className="text-sm text-destructive">{appointmentErrorMessage(mutation.error)}{isAppointmentConflict(mutation.error) ? ' La agenda y la disponibilidad se han actualizado.' : ''}</p>}
    <p className="text-xs text-muted-foreground">Las horas se muestran según {timezone}.</p>
  </form>
}

const selectClass = 'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm'
function Field({ label, error, children, className = '' }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return <label className={`space-y-1.5 text-sm font-medium ${className}`}><span>{label}</span>{children}{error && <span className="block text-xs text-destructive">{error}</span>}</label>
}
