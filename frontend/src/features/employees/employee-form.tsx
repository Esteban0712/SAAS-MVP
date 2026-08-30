import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createEmployee, employeeQueryKeys, updateEmployee } from './employees.api'
import { employeeErrorMessage } from './employees-error'
import type { BranchOption, Employee } from './employees.types'

const schema = z.object({
  displayName: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  branchId: z.string().uuid('Selecciona una sucursal.'),
  phone: z.string().max(50), notes: z.string().max(2000), active: z.boolean(),
})
type Values = z.infer<typeof schema>

export function EmployeeForm({ employee, branches, onClose, onSaved }: { employee?: Employee; branches: BranchOption[]; onClose: () => void; onSaved: (employee: Employee) => void }) {
  const client = useQueryClient()
  const form = useForm<Values>({ defaultValues: { displayName: employee?.displayName ?? '', branchId: employee?.branchId ?? branches.find((b) => b.isMain && b.active)?.id ?? branches.find((b) => b.active)?.id ?? '', phone: employee?.phone ?? '', notes: employee?.notes ?? '', active: employee?.active ?? true } })
  const mutation = useMutation({ mutationFn: (v: Values) => { const input = { ...v, displayName: v.displayName.trim(), phone: v.phone.trim(), notes: v.notes.trim() }; return employee ? updateEmployee(employee.id, input) : createEmployee(input) }, onSuccess: async (saved) => { await client.invalidateQueries({ queryKey: employeeQueryKeys.lists() }); if (employee) client.setQueryData(employeeQueryKeys.detail(employee.id), saved); onSaved(saved) } })
  const submit = form.handleSubmit(async (values) => { const result = schema.safeParse(values); if (!result.success) { for (const issue of result.error.issues) { const field = issue.path[0]; if (typeof field === 'string' && field in values) form.setError(field as keyof Values, { message: issue.message }) } return } await mutation.mutateAsync(result.data).catch(() => undefined) })
  return <form className="grid gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
    <Field label="Nombre" error={form.formState.errors.displayName?.message}><Input autoFocus {...form.register('displayName')} /></Field>
    <Field label="Sucursal" error={form.formState.errors.branchId?.message}><select className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm" {...form.register('branchId')}><option value="">Selecciona una sucursal</option>{branches.filter((b) => b.active || b.id === employee?.branchId).map((b) => <option key={b.id} value={b.id}>{b.name}{!b.active ? ' (inactiva)' : ''}</option>)}</select></Field>
    <Field label="Teléfono" error={form.formState.errors.phone?.message}><Input type="tel" {...form.register('phone')} /></Field>
    <label className="flex items-center gap-2 self-end pb-1 text-sm font-medium"><input type="checkbox" className="size-4" {...form.register('active')} />Empleado activo</label>
    <Field label="Notas" error={form.formState.errors.notes?.message} className="md:col-span-2"><textarea className="min-h-24 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm" {...form.register('notes')} /></Field>
    <div className="flex flex-wrap items-center gap-2 md:col-span-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar datos'}</Button><Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>{mutation.isSuccess && <span className="text-sm text-emerald-700">Guardado correctamente.</span>}</div>
    {mutation.error && <p role="alert" className="text-sm text-destructive md:col-span-2">{employeeErrorMessage(mutation.error)}</p>}
  </form>
}
function Field({ label, error, children, className = '' }: { label: string; error?: string; children: React.ReactNode; className?: string }) { return <label className={`space-y-1.5 text-sm font-medium ${className}`}><span>{label}</span>{children}{error && <span className="block text-xs text-destructive">{error}</span>}</label> }
