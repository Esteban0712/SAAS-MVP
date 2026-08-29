import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createUser,
  managementQueryKeys,
  updateUser,
} from './management.api'
import { managementErrorMessage } from './management-error'
import type {
  RoleSummary,
  UserStatus,
  UserSummary,
} from './management.types'

const userSchema = z
  .object({
    username: z.string().trim().min(3, 'Mínimo 3 caracteres.'),
    password: z.string(),
    roleId: z.string().uuid('Selecciona un rol.'),
    status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED']),
    displayName: z.string(),
    email: z.string(),
    phone: z.string(),
  })
  .superRefine((value, context) => {
    if (value.password && value.password.length < 12) {
      context.addIssue({ code: 'custom', path: ['password'], message: 'Mínimo 12 caracteres.' })
    }
    if (value.email && !z.string().email().safeParse(value.email).success) {
      context.addIssue({ code: 'custom', path: ['email'], message: 'Email no válido.' })
    }
  })

type UserFormValues = z.infer<typeof userSchema>

interface UserFormProps {
  roles: RoleSummary[]
  user?: UserSummary
  onClose: () => void
}

export function UserForm({ roles, user, onClose }: UserFormProps) {
  const queryClient = useQueryClient()
  const form = useForm<UserFormValues>({
    defaultValues: {
      username: user?.username ?? '',
      password: '',
      roleId: user?.roleId ?? roles.find((role) => role.active)?.id ?? '',
      status: user?.status ?? 'INVITED',
      displayName: user?.displayName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    },
  })
  const mutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      const common = {
        username: values.username.trim(),
        roleId: values.roleId,
        status: values.status as UserStatus,
        ...(values.displayName.trim() ? { displayName: values.displayName.trim() } : {}),
        ...(values.email.trim() ? { email: values.email.trim() } : {}),
        ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
      }
      return user
        ? updateUser(user.id, common)
        : createUser({ ...common, password: values.password })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: managementQueryKeys.users })
    },
  })

  const submit = form.handleSubmit(async (values) => {
    const result = userSchema.safeParse(values)
    if (!result.success || (!user && values.password.length < 12)) {
      for (const issue of result.success ? [] : result.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && field in values) {
          form.setError(field as keyof UserFormValues, { message: issue.message })
        }
      }
      if (!user && values.password.length < 12) {
        form.setError('password', { message: 'Mínimo 12 caracteres.' })
      }
      return
    }
    await mutation.mutateAsync(result.data).catch(() => undefined)
  })

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
      <Field label="Usuario" error={form.formState.errors.username?.message}>
        <Input autoComplete="username" {...form.register('username')} />
      </Field>
      {!user && (
        <Field label="Contraseña" error={form.formState.errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
      )}
      <Field label="Rol" error={form.formState.errors.roleId?.message}>
        <select className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm" {...form.register('roleId')}>
          <option value="">Selecciona un rol</option>
          {roles.filter((role) => role.active || role.id === user?.roleId).map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Estado" error={form.formState.errors.status?.message}>
        <select className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm" {...form.register('status')}>
          <option value="INVITED">Invitado</option>
          <option value="ACTIVE">Activo</option>
          <option value="SUSPENDED">Suspendido</option>
          <option value="DISABLED">Deshabilitado</option>
        </select>
      </Field>
      <Field label="Nombre" error={form.formState.errors.displayName?.message}>
        <Input {...form.register('displayName')} />
      </Field>
      <Field label="Email" error={form.formState.errors.email?.message}>
        <Input type="email" {...form.register('email')} />
      </Field>
      <Field label="Teléfono" error={form.formState.errors.phone?.message}>
        <Input {...form.register('phone')} />
      </Field>
      <div className="flex items-end gap-2 md:col-span-2">
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar'}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        {mutation.isSuccess && <span className="text-sm text-emerald-700">Guardado correctamente.</span>}
      </div>
      {mutation.error && <p role="alert" className="text-sm text-destructive md:col-span-2">{managementErrorMessage(mutation.error)}</p>}
    </form>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  )
}
