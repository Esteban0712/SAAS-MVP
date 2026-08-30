import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useServicesQuery } from '@/features/services/services.queries'
import { employeeQueryKeys, replaceEmployeeServices } from './employees.api'
import { employeeErrorMessage } from './employees-error'
import { useEmployeeServicesQuery } from './employees.queries'

const schema = z.object({ serviceIds: z.array(z.string().uuid()) })
type Values = z.infer<typeof schema>
export function AssignedServicesForm({ employeeId, canViewServices }: { employeeId: string; canViewServices: boolean }) {
  const client = useQueryClient(); const [searchInput, setSearchInput] = useState(''); const [search, setSearch] = useState('')
  const assigned = useEmployeeServicesQuery(employeeId, true); const catalog = useServicesQuery({ search, page: 1, pageSize: 100 }, canViewServices)
  const form = useForm<Values>({ defaultValues: { serviceIds: [] } }); const selected = useWatch({ control: form.control, name: 'serviceIds' })
  useEffect(() => { if (assigned.data) form.reset({ serviceIds: assigned.data.map((s) => s.id) }) }, [assigned.data, form])
  const mutation = useMutation({ mutationFn: (values: Values) => replaceEmployeeServices(employeeId, values.serviceIds), onSuccess: async (saved) => { client.setQueryData(employeeQueryKeys.services(employeeId), saved); await client.invalidateQueries({ queryKey: employeeQueryKeys.detail(employeeId) }) } })
  if (!canViewServices) return <p className="text-sm text-muted-foreground">Necesitas `services.view` para consultar el catálogo y editar asignaciones.</p>
  if (assigned.isPending || catalog.isPending) return <p className="text-sm text-muted-foreground">Cargando servicios…</p>
  if (assigned.error || catalog.error) return <p role="alert" className="text-sm text-destructive">{employeeErrorMessage(assigned.error || catalog.error)}</p>
  const toggle = (id: string) => form.setValue('serviceIds', selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id], { shouldDirty: true })
  return <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutateAsync(schema.parse(values)).catch(() => undefined))}>
    <div><h3 className="font-medium">Servicios asignados</h3><p className="text-sm text-muted-foreground">Selecciona el catálogo completo que puede realizar este empleado.</p></div>
    <div className="flex max-w-lg gap-2"><Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar servicio" /><Button type="button" variant="outline" onClick={() => setSearch(searchInput.trim())}>Buscar</Button></div>
    {catalog.data?.items.length === 0 ? <p className="text-sm text-muted-foreground">No hay servicios disponibles.</p> : <div className="grid gap-2 sm:grid-cols-2">{catalog.data?.items.map((service) => <label key={service.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" className="mt-1 size-4" checked={selected.includes(service.id)} onChange={() => toggle(service.id)} /><span><strong className="block">{service.name}</strong><span className="text-muted-foreground">{service.durationMinutes} min · {service.price}</span></span></label>)}</div>}
    <div className="flex flex-wrap items-center gap-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar servicios'}</Button><span className="text-sm text-muted-foreground">{selected.length} seleccionados</span>{mutation.isSuccess && <span className="text-sm text-emerald-700">Asignaciones guardadas.</span>}</div>
    {mutation.error && <p role="alert" className="text-sm text-destructive">{employeeErrorMessage(mutation.error)}</p>}
  </form>
}
