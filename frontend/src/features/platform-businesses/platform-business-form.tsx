import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createPlatformBusiness,
  platformBusinessQueryKeys,
} from './platform-businesses.api'
import { platformBusinessErrorMessage } from './platform-businesses-error'
import type { CreatePlatformBusinessInput } from './platform-businesses.types'

function isIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

function optionalUrl(value: string) {
  return !value || z.url().safeParse(value).success
}

const businessSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  slug: z
    .string()
    .trim()
    .min(1, 'El slug es obligatorio.')
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Usa minúsculas, números y guiones simples.',
    ),
  timezone: z
    .string()
    .trim()
    .min(1, 'La zona horaria es obligatoria.')
    .max(100)
    .refine(isIanaTimezone, 'Introduce una zona horaria IANA válida.'),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Introduce un código de moneda de 3 letras.'),
  maxUsers: z.number().int().min(1).max(1_000_000),
  logoUrl: z.string().trim().max(2048).refine(optionalUrl, 'URL no válida.'),
  taxId: z.string().trim().max(100),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(50),
  branchName: z
    .string()
    .trim()
    .min(1, 'El nombre de sucursal es obligatorio.')
    .max(200),
  branchAddress: z.string().trim().max(500),
  branchPhone: z.string().trim().max(50),
  adminUsername: z.string().trim().min(3, 'Mínimo 3 caracteres.').max(100),
  adminPassword: z
    .string()
    .min(12, 'Mínimo 12 caracteres.')
    .max(200)
    .regex(/[a-z]/, 'Debe incluir una minúscula.')
    .regex(/[A-Z]/, 'Debe incluir una mayúscula.')
    .regex(/\d/, 'Debe incluir un número.')
    .regex(/[^A-Za-z0-9]/, 'Debe incluir un símbolo.'),
  adminEmail: z
    .string()
    .trim()
    .max(320)
    .refine(
      (value) => !value || z.email().safeParse(value).success,
      'Email no válido.',
    ),
  adminDisplayName: z.string().trim().max(200),
  adminPhone: z.string().trim().max(50),
})

type BusinessFormValues = z.infer<typeof businessSchema>

function optional(value: string) {
  const normalized = value.trim()
  return normalized || undefined
}

export function PlatformBusinessForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const form = useForm<BusinessFormValues>({
    defaultValues: {
      name: '',
      slug: '',
      timezone: 'Europe/Malta',
      currency: 'EUR',
      maxUsers: 10,
      logoUrl: '',
      taxId: '',
      address: '',
      phone: '',
      branchName: 'Principal',
      branchAddress: '',
      branchPhone: '',
      adminUsername: 'admin',
      adminPassword: '',
      adminEmail: '',
      adminDisplayName: '',
      adminPhone: '',
    },
  })
  const mutation = useMutation({
    mutationFn: createPlatformBusiness,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: platformBusinessQueryKeys.lists(),
      })
      navigate('/platform/businesses', {
        replace: true,
        state: { createdBusiness: true },
      })
    },
  })

  const submit = form.handleSubmit(async (values) => {
    const result = businessSchema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && field in values) {
          form.setError(field as keyof BusinessFormValues, {
            message: issue.message,
          })
        }
      }
      return
    }
    const data = result.data
    const input: CreatePlatformBusinessInput = {
      name: data.name,
      slug: data.slug,
      timezone: data.timezone,
      currency: data.currency.toUpperCase(),
      maxUsers: data.maxUsers,
      logoUrl: optional(data.logoUrl),
      taxId: optional(data.taxId),
      address: optional(data.address),
      phone: optional(data.phone),
      branch: {
        name: data.branchName,
        address: optional(data.branchAddress),
        phone: optional(data.branchPhone),
      },
      admin: {
        username: data.adminUsername,
        password: data.adminPassword,
        email: optional(data.adminEmail),
        displayName: optional(data.adminDisplayName),
        phone: optional(data.adminPhone),
      },
    }
    await mutation.mutateAsync(input).catch(() => undefined)
  })

  return (
    <form className="space-y-6" onSubmit={submit} noValidate>
      <FormSection
        title="Negocio"
        description="Identidad y configuración operativa del tenant."
      >
        <Field label="Nombre" error={form.formState.errors.name?.message}>
          <Input autoFocus {...form.register('name')} />
        </Field>
        <Field
          label="Slug"
          error={form.formState.errors.slug?.message}
          hint="Se usará para iniciar sesión y no podrá cambiarse."
        >
          <Input
            placeholder="mi-negocio"
            autoCapitalize="none"
            {...form.register('slug')}
          />
        </Field>
        <Field
          label="Zona horaria IANA"
          error={form.formState.errors.timezone?.message}
        >
          <Input placeholder="Europe/Malta" {...form.register('timezone')} />
        </Field>
        <Field label="Moneda" error={form.formState.errors.currency?.message}>
          <Input
            maxLength={3}
            className="uppercase"
            {...form.register('currency')}
          />
        </Field>
        <Field
          label="Máximo de usuarios"
          error={form.formState.errors.maxUsers?.message}
        >
          <Input
            type="number"
            min={1}
            {...form.register('maxUsers', { valueAsNumber: true })}
          />
        </Field>
        <Field
          label="URL del logo"
          error={form.formState.errors.logoUrl?.message}
        >
          <Input type="url" {...form.register('logoUrl')} />
        </Field>
        <Field
          label="Identificador fiscal"
          error={form.formState.errors.taxId?.message}
        >
          <Input {...form.register('taxId')} />
        </Field>
        <Field label="Teléfono" error={form.formState.errors.phone?.message}>
          <Input type="tel" {...form.register('phone')} />
        </Field>
        <Field
          label="Dirección"
          error={form.formState.errors.address?.message}
          className="md:col-span-2"
        >
          <Input {...form.register('address')} />
        </Field>
      </FormSection>

      <FormSection
        title="Sucursal principal"
        description="Se crea activa y queda asociada al nuevo negocio."
      >
        <Field label="Nombre" error={form.formState.errors.branchName?.message}>
          <Input {...form.register('branchName')} />
        </Field>
        <Field
          label="Teléfono"
          error={form.formState.errors.branchPhone?.message}
        >
          <Input type="tel" {...form.register('branchPhone')} />
        </Field>
        <Field
          label="Dirección"
          error={form.formState.errors.branchAddress?.message}
          className="md:col-span-2"
        >
          <Input {...form.register('branchAddress')} />
        </Field>
      </FormSection>

      <FormSection
        title="Administrador inicial"
        description="Usuario owner del tenant con rol ADMIN. Deberá cambiar la contraseña."
      >
        <Field
          label="Usuario"
          error={form.formState.errors.adminUsername?.message}
        >
          <Input autoCapitalize="none" {...form.register('adminUsername')} />
        </Field>
        <Field
          label="Contraseña inicial"
          error={form.formState.errors.adminPassword?.message}
          hint="12+ caracteres, mayúscula, minúscula, número y símbolo."
        >
          <Input
            type="password"
            autoComplete="new-password"
            {...form.register('adminPassword')}
          />
        </Field>
        <Field
          label="Nombre visible"
          error={form.formState.errors.adminDisplayName?.message}
        >
          <Input {...form.register('adminDisplayName')} />
        </Field>
        <Field label="Email" error={form.formState.errors.adminEmail?.message}>
          <Input type="email" {...form.register('adminEmail')} />
        </Field>
        <Field
          label="Teléfono"
          error={form.formState.errors.adminPhone?.message}
        >
          <Input type="tel" {...form.register('adminPhone')} />
        </Field>
      </FormSection>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creando…' : 'Crear negocio'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => navigate('/platform/businesses')}
        >
          Cancelar
        </Button>
      </div>
      {mutation.error && (
        <p role="alert" className="text-sm text-destructive">
          {platformBusinessErrorMessage(mutation.error)}
        </p>
      )}
    </form>
  )
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="grid gap-4 rounded-xl border p-4 md:grid-cols-2">
      <legend className="px-2 font-medium">{title}</legend>
      <p className="text-sm text-muted-foreground md:col-span-2">
        {description}
      </p>
      {children}
    </fieldset>
  )
}

function Field({
  label,
  error,
  hint,
  children,
  className = '',
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`space-y-1.5 text-sm font-medium ${className}`}>
      <span>{label}</span>
      {children}
      {hint && !error && (
        <span className="block text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      )}
      {error && (
        <span className="block text-xs font-normal text-destructive">
          {error}
        </span>
      )}
    </label>
  )
}
