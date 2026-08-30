import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useSession } from '@/features/auth/use-session'
import { AppointmentDetail } from '@/features/appointments/appointment-detail'
import { statusLabel } from '@/features/appointments/appointment-status'
import { AppointmentForm } from '@/features/appointments/appointment-form'
import { appointmentErrorMessage } from '@/features/appointments/appointments-error'
import { useAppointmentQuery, useAppointmentsQuery, useAppointmentTimezoneQuery } from '@/features/appointments/appointments.queries'
import { addLocalDays, currentDateInZone, dateInZone, dayRange, formatAgendaDate, formatAppointmentTime } from '@/features/appointments/appointment-time'
import type { Appointment } from '@/features/appointments/appointments.types'
import { useEmployeesQuery } from '@/features/employees/employees.queries'

type Editor = { mode: 'create' } | { mode: 'edit' | 'reschedule'; appointment: Appointment } | null
const PAGE_SIZE = 100

export function AgendaPage() {
  const { data: principal } = useSession()
  const permissions = principal?.actorType === 'USER' ? principal.permissions : []
  const canView = permissions.includes('appointments.view')
  const canManage = permissions.includes('appointments.manage')
  const canReadCustomers = permissions.includes('customers.view')
  const canReadEmployees = permissions.includes('employees.view')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [editor, setEditor] = useState<Editor>(null)
  const timezoneQuery = useAppointmentTimezoneQuery(canView)
  const timezone = timezoneQuery.data
  const date = selectedDate ?? (timezone ? currentDateInZone(timezone) : new Date().toISOString().slice(0, 10))
  const range = useMemo(() => timezone ? dayRange(date, timezone) : { from: '', to: '' }, [date, timezone])
  const appointments = useAppointmentsQuery({ ...range, page: 1, pageSize: PAGE_SIZE, employeeId: employeeId || undefined }, canView && Boolean(timezone))
  const employees = useEmployeesQuery({ search: '', page: 1, pageSize: 100 }, canView && canReadEmployees)
  const detail = useAppointmentQuery(selectedId, canView && Boolean(selectedId))

  if (!canView) return <Restricted />
  const changeDate = (next: string) => { setSelectedDate(next); setSelectedId(''); setEditor(null) }
  const openSaved = (saved: Appointment) => {
    setEditor(null)
    setSelectedId(saved.id)
    if (timezone) setSelectedDate(dateInZone(new Date(saved.startAt), timezone))
  }

  return <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
    <section className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">Operación</p><h1 className="text-2xl font-semibold md:text-3xl">Agenda</h1>{timezone && <p className="text-sm text-muted-foreground">{formatAgendaDate(date, timezone)} · {timezone}</p>}</div>{canManage && <Button onClick={() => { setEditor({ mode: 'create' }); setSelectedId('') }}>Nueva cita</Button>}</section>
    <Card><CardContent className="flex flex-col gap-3 pt-4 md:flex-row md:items-end">
      <div className="flex gap-2"><Button variant="outline" onClick={() => changeDate(addLocalDays(date, -1))}>Anterior</Button><Button variant="outline" disabled={!timezone} onClick={() => timezone && changeDate(currentDateInZone(timezone))}>Hoy</Button><Button variant="outline" onClick={() => changeDate(addLocalDays(date, 1))}>Siguiente</Button></div>
      <label className="space-y-1 text-sm font-medium"><span className="block">Fecha</span><Input type="date" value={date} onChange={(event) => changeDate(event.target.value)} /></label>
      {canReadEmployees && <label className="space-y-1 text-sm font-medium md:min-w-60"><span className="block">Empleado</span><select className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setSelectedId('') }}><option value="">Todos</option>{employees.data?.items.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName}</option>)}</select></label>}
    </CardContent></Card>
    {editor && canManage && timezone && <Card><CardHeader><CardTitle>{editor.mode === 'create' ? 'Crear cita' : editor.mode === 'edit' ? 'Editar cita' : 'Reprogramar cita'}</CardTitle><CardDescription>{editor.mode === 'reschedule' ? 'La cita original quedará marcada como reprogramada.' : 'La disponibilidad procede del backend.'}</CardDescription></CardHeader><CardContent><AppointmentForm key={editor.mode === 'create' ? `new-${date}` : `${editor.mode}-${editor.appointment.id}`} mode={editor.mode} appointment={editor.mode === 'create' ? undefined : editor.appointment} initialDate={date} canReadCustomers={canReadCustomers} canReadEmployees={canReadEmployees} timezone={timezone} onClose={() => setEditor(null)} onSaved={openSaved} /></CardContent></Card>}
    {selectedId && <Card><CardHeader><CardTitle>Detalle de cita</CardTitle></CardHeader><CardContent>{detail.isPending && <p className="text-sm text-muted-foreground">Cargando detalle…</p>}{detail.error && <p role="alert" className="text-sm text-destructive">{appointmentErrorMessage(detail.error)}</p>}{detail.data && timezone && <AppointmentDetail appointment={detail.data} timezone={timezone} canManage={canManage} onEdit={() => setEditor({ mode: 'edit', appointment: detail.data })} onReschedule={() => setEditor({ mode: 'reschedule', appointment: detail.data })} />}</CardContent></Card>}
    <Card><CardHeader className="border-b"><CardTitle>Citas del día</CardTitle><CardDescription>Ordenadas por hora local del negocio.</CardDescription></CardHeader><CardContent className="space-y-4">
      {(timezoneQuery.isPending || appointments.isPending) && <p className="text-sm text-muted-foreground">Cargando agenda…</p>}
      {(timezoneQuery.error || appointments.error) && <p role="alert" className="text-sm text-destructive">{appointmentErrorMessage(timezoneQuery.error || appointments.error)}</p>}
      {appointments.data?.items.length === 0 && <p className="text-sm text-muted-foreground">No hay citas para este día.</p>}
      {appointments.data && appointments.data.items.length > 0 && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{appointments.data.items.map((appointment) => <article key={appointment.id} className="flex min-w-0 flex-col gap-3 rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xl font-semibold tabular-nums">{timezone && formatAppointmentTime(appointment.startAt, timezone)}</p><h2 className="font-medium">{appointment.customer.name}</h2></div><span className="rounded-full bg-muted px-2 py-1 text-xs">{statusLabel(appointment.status)}</span></div><div className="text-sm text-muted-foreground"><p>{appointment.employee.displayName}</p><p className="truncate">{appointment.services.map((service) => service.serviceNameSnapshot).join(', ')}</p></div><Button size="sm" variant="outline" className="mt-auto self-start" onClick={() => { setSelectedId(appointment.id); setEditor(null) }}>Ver detalle</Button></article>)}</div>}
      {appointments.data && <p className="border-t pt-4 text-sm text-muted-foreground">{appointments.data.total} {appointments.data.total === 1 ? 'cita' : 'citas'}</p>}
    </CardContent></Card>
  </main>
}

function Restricted() { return <main className="flex flex-1 p-4 md:p-6"><Card className="w-full"><CardHeader><CardTitle>Acceso restringido</CardTitle><CardDescription>No tienes permiso para consultar la agenda.</CardDescription></CardHeader></Card></main> }
