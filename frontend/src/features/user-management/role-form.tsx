import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createRole, managementQueryKeys, updateRole } from './management.api'
import { managementErrorMessage } from './management-error'
import type { PermissionSummary, RoleSummary } from './management.types'

const roleSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres.'),
  description: z.string(),
  active: z.boolean(),
  permissionIds: z.array(z.string().uuid()),
})

type RoleFormValues = z.infer<typeof roleSchema>

export function RoleForm({ role, permissions, onClose }: { role?: RoleSummary; permissions: PermissionSummary[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm<RoleFormValues>({
    defaultValues: {
      name: role?.name ?? '',
      description: role?.description ?? '',
      active: role?.active ?? true,
      permissionIds: role?.permissions.map((permission) => permission.id) ?? [],
    },
  })
  const mutation = useMutation({
    mutationFn: (values: RoleFormValues) => {
      const input = { ...values, name: values.name.trim(), description: values.description.trim() || undefined }
      return role ? updateRole(role.id, input) : createRole(input)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: managementQueryKeys.roles })
      await queryClient.invalidateQueries({ queryKey: managementQueryKeys.users })
    },
  })
  const submit = form.handleSubmit(async (values) => {
    const result = roleSchema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        if (issue.path[0] === 'name') form.setError('name', { message: issue.message })
      }
      return
    }
    await mutation.mutateAsync(result.data).catch(() => undefined)
  })

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">
          <span>Nombre</span>
          <Input {...form.register('name')} />
          {form.formState.errors.name?.message && <span className="block text-xs text-destructive">{form.formState.errors.name.message}</span>}
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>Descripción</span>
          <Input {...form.register('description')} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="size-4" {...form.register('active')} /> Rol activo
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Permisos</legend>
        <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3">
          {permissions.map((permission) => (
            <label key={permission.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" value={permission.id} className="mt-0.5 size-4" {...form.register('permissionIds')} />
              <span><span className="block font-medium">{permission.code}</span><span className="text-xs text-muted-foreground">{permission.name}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar rol'}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        {mutation.isSuccess && <span className="text-sm text-emerald-700">Rol guardado.</span>}
      </div>
      {mutation.error && <p role="alert" className="text-sm text-destructive">{managementErrorMessage(mutation.error)}</p>}
    </form>
  )
}
