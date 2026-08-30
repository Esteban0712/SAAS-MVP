import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createService, serviceQueryKeys, updateService } from './services.api'
import { serviceErrorMessage } from './services-error'
import type { Service } from './services.types'
const schema = z.object({ name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200), category: z.string().max(200), description: z.string().max(2000), durationMinutes: z.coerce.number().int().min(1, 'Mínimo 1 minuto.').max(1440), price: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/, 'Usa un importe positivo con máximo 2 decimales.'), active: z.boolean() })
type Values = z.infer<typeof schema>
export function ServiceForm({ service, onClose, onSaved }: { service?: Service; onClose: () => void; onSaved: (service: Service) => void }) {
  const client = useQueryClient(); const form = useForm<Values>({ defaultValues: { name: service?.name ?? '', category: service?.category ?? '', description: service?.description ?? '', durationMinutes: service?.durationMinutes ?? 30, price: service?.price ?? '0.00', active: service?.active ?? true } })
  const mutation = useMutation({ mutationFn: (v: Values) => { const input = { ...v, name: v.name.trim(), category: v.category.trim(), description: v.description.trim() }; return service ? updateService(service.id, input) : createService(input) }, onSuccess: async (saved) => { await client.invalidateQueries({ queryKey: serviceQueryKeys.lists() }); if (service) client.setQueryData(serviceQueryKeys.detail(service.id), saved); onSaved(saved) } })
  const submit = form.handleSubmit(async (values) => { const result = schema.safeParse(values); if (!result.success) { for (const issue of result.error.issues) { const field = issue.path[0]; if (typeof field === 'string' && field in values) form.setError(field as keyof Values, { message: issue.message }) } return } await mutation.mutateAsync(result.data).catch(() => undefined) })
  return <form className="grid gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
    <Field label="Nombre" error={form.formState.errors.name?.message}><Input autoFocus {...form.register('name')} /></Field><Field label="Categoría" error={form.formState.errors.category?.message}><Input {...form.register('category')} /></Field>
    <Field label="Duración (minutos)" error={form.formState.errors.durationMinutes?.message}><Input type="number" min={1} max={1440} {...form.register('durationMinutes')} /></Field><Field label="Precio" error={form.formState.errors.price?.message}><Input inputMode="decimal" {...form.register('price')} /></Field>
    <Field label="Descripción" error={form.formState.errors.description?.message} className="md:col-span-2"><textarea className="min-h-24 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm" {...form.register('description')} /></Field>
    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4" {...form.register('active')} />Servicio activo</label>
    <div className="flex flex-wrap items-center gap-2 md:col-span-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar'}</Button><Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>{mutation.isSuccess && <span className="text-sm text-emerald-700">Guardado correctamente.</span>}</div>{mutation.error && <p role="alert" className="text-sm text-destructive md:col-span-2">{serviceErrorMessage(mutation.error)}</p>}
  </form>
}
function Field({ label, error, children, className = '' }: { label: string; error?: string; children: React.ReactNode; className?: string }) { return <label className={`space-y-1.5 text-sm font-medium ${className}`}><span>{label}</span>{children}{error && <span className="block text-xs text-destructive">{error}</span>}</label> }
