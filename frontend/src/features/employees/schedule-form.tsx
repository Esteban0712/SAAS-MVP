import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { employeeQueryKeys, replaceEmployeeSchedules } from './employees.api'
import { employeeErrorMessage } from './employees-error'
import { useEmployeeSchedulesQuery } from './employees.queries'
import type { DayOfWeek, EmployeeSchedule } from './employees.types'
const days: Array<{ value: DayOfWeek; label: string }> = [{ value: 'MONDAY', label: 'Lunes' }, { value: 'TUESDAY', label: 'Martes' }, { value: 'WEDNESDAY', label: 'Miércoles' }, { value: 'THURSDAY', label: 'Jueves' }, { value: 'FRIDAY', label: 'Viernes' }, { value: 'SATURDAY', label: 'Sábado' }, { value: 'SUNDAY', label: 'Domingo' }]
const time = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/
const rowSchema = z.object({ dayOfWeek: z.enum(days.map((d) => d.value) as [DayOfWeek, ...DayOfWeek[]]), startTime: z.string().regex(time, 'Hora no válida.'), endTime: z.string().regex(time, 'Hora no válida.'), active: z.boolean() })
const schema = z.object({ schedules: z.array(rowSchema) }).superRefine(({ schedules }, context) => { schedules.forEach((row, index) => { const start = canonical(row.startTime); const end = canonical(row.endTime); if (start >= end) context.addIssue({ code: 'custom', path: ['schedules', index, 'endTime'], message: 'El final debe ser posterior al inicio.' }); schedules.slice(0, index).forEach((other) => { if (other.dayOfWeek === row.dayOfWeek && start < canonical(other.endTime) && end > canonical(other.startTime)) context.addIssue({ code: 'custom', path: ['schedules', index, 'startTime'], message: start === canonical(other.startTime) && end === canonical(other.endTime) ? 'Bloque duplicado.' : 'El bloque se solapa con otro.' }) }) }) })
type Values = z.infer<typeof schema>
const canonical = (value: string) => value.length === 5 ? `${value}:00` : value
export function ScheduleForm({ employeeId }: { employeeId: string }) {
  const client = useQueryClient(); const query = useEmployeeSchedulesQuery(employeeId, true); const form = useForm<Values>({ defaultValues: { schedules: [] } }); const fields = useFieldArray({ control: form.control, name: 'schedules' })
  useEffect(() => { if (query.data) form.reset({ schedules: query.data.map((row) => ({ ...row, startTime: row.startTime.slice(0, 5), endTime: row.endTime.slice(0, 5) })) }) }, [query.data, form])
  const mutation = useMutation({ mutationFn: (values: Values) => replaceEmployeeSchedules(employeeId, values.schedules.map((row) => ({ ...row, startTime: canonical(row.startTime), endTime: canonical(row.endTime) })) as EmployeeSchedule[]), onSuccess: (saved) => client.setQueryData(employeeQueryKeys.schedules(employeeId), saved) })
  const submit = form.handleSubmit(async (values) => { const result = schema.safeParse(values); if (!result.success) { for (const issue of result.error.issues) { const [, index, field] = issue.path; if (typeof index === 'number' && typeof field === 'string') form.setError(`schedules.${index}.${field}` as `schedules.${number}.startTime`, { message: issue.message }) } return } await mutation.mutateAsync(result.data).catch(() => undefined) })
  if (query.isPending) return <p className="text-sm text-muted-foreground">Cargando horario…</p>
  if (query.error) return <p role="alert" className="text-sm text-destructive">{employeeErrorMessage(query.error)}</p>
  return <form className="space-y-4" onSubmit={submit} noValidate><div><h3 className="font-medium">Horario semanal</h3><p className="text-sm text-muted-foreground">Añade varios bloques por día; los bloques adyacentes están permitidos.</p></div>
    {fields.fields.length === 0 && <p className="text-sm text-muted-foreground">No hay bloques configurados.</p>}
    <div className="space-y-2">{fields.fields.map((field, index) => <div key={field.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1.2fr_1fr_1fr_auto_auto] sm:items-start"><select className="h-8 rounded-lg border bg-background px-2 text-sm" {...form.register(`schedules.${index}.dayOfWeek`)}>{days.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select><div><Input type="time" step="1" {...form.register(`schedules.${index}.startTime`)} />{form.formState.errors.schedules?.[index]?.startTime?.message && <span className="text-xs text-destructive">{form.formState.errors.schedules[index]?.startTime?.message}</span>}</div><div><Input type="time" step="1" {...form.register(`schedules.${index}.endTime`)} />{form.formState.errors.schedules?.[index]?.endTime?.message && <span className="text-xs text-destructive">{form.formState.errors.schedules[index]?.endTime?.message}</span>}</div><label className="flex h-8 items-center gap-2 text-sm"><input type="checkbox" {...form.register(`schedules.${index}.active`)} />Activo</label><Button type="button" size="sm" variant="outline" onClick={() => fields.remove(index)}>Quitar</Button></div>)}</div>
    <Button type="button" variant="outline" onClick={() => fields.append({ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00', active: true })}>Añadir bloque</Button>
    <div className="flex flex-wrap items-center gap-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar horario'}</Button>{mutation.isSuccess && <span className="text-sm text-emerald-700">Horario guardado.</span>}</div>{mutation.error && <p role="alert" className="text-sm text-destructive">{employeeErrorMessage(mutation.error)}</p>}
  </form>
}
