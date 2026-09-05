import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  platformBusinessQueryKeys,
  updatePlatformBusiness,
} from './platform-businesses.api'
import { platformBusinessErrorMessage } from './platform-businesses-error'
import type {
  PlatformBusinessDetail,
  UpdatePlatformBusinessInput,
} from './platform-businesses.types'

function isIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

const adminSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  timezone: z
    .string()
    .trim()
    .min(1, 'La zona horaria es obligatoria.')
    .max(100)
    .refine(isIanaTimezone, 'Introduce una zona horaria IANA válida.'),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Código de 3 letras.'),
  maxUsers: z.number().int().min(1).max(1_000_000),
  logoUrl: z
    .string()
    .trim()
    .max(2048)
    .refine(
      (value) => !value || z.url().safeParse(value).success,
      'URL no válida.',
    ),
  taxId: z.string().trim().max(100),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(50),
})

type AdminFormValues = z.infer<typeof adminSchema>

export function PlatformBusinessAdminForm({
  business,
}: {
  business: PlatformBusinessDetail
}) {
  const queryClient = useQueryClient()
  const form = useForm<AdminFormValues>({
    defaultValues: {
      name: business.name,
      timezone: business.timezone,
      currency: business.currency,
      maxUsers: business.maxUsers,
      logoUrl: business.logoUrl ?? '',
      taxId: business.taxId ?? '',
      address: business.address ?? '',
      phone: business.phone ?? '',
    },
  })
  const mutation = useMutation({
    mutationFn: (input: UpdatePlatformBusinessInput) =>
      updatePlatformBusiness(business.id, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(
        platformBusinessQueryKeys.detail(business.id),
        updated,
      )
      await queryClient.invalidateQueries({
        queryKey: platformBusinessQueryKeys.lists(),
      })
    },
  })

  const submit = form.handleSubmit(async (values) => {
    const result = adminSchema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && field in values) {
          form.setError(field as keyof AdminFormValues, {
            message: issue.message,
          })
        }
      }
      return
    }
    const data = result.data
    await mutation
      .mutateAsync({
        name: data.name,
        timezone: data.timezone,
        currency: data.currency.toUpperCase(),
        maxUsers: data.maxUsers,
        ...(data.logoUrl ? { logoUrl: data.logoUrl } : {}),
        taxId: data.taxId,
        address: data.address,
        phone: data.phone,
      })
      .catch(() => undefined)
  })

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
      <Field label="Nombre" error={form.formState.errors.name?.message}>
        <Input {...form.register('name')} />
      </Field>
      <Field label="Slug" hint="Identificador inmutable.">
        <Input value={business.slug} disabled />
      </Field>
      <Field
        label="Zona horaria IANA"
        error={form.formState.errors.timezone?.message}
      >
        <Input {...form.register('timezone')} />
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
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        {mutation.isSuccess && (
          <span role="status" className="text-sm text-emerald-700">
            Cambios guardados.
          </span>
        )}
      </div>
      {mutation.error && (
        <p role="alert" className="text-sm text-destructive md:col-span-2">
          {platformBusinessErrorMessage(mutation.error)}
        </p>
      )}
    </form>
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
