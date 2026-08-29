import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createCustomer,
  customerQueryKeys,
  updateCustomer,
} from './customers.api'
import { customerErrorMessage } from './customers-error'
import type { Customer, SaveCustomerInput } from './customers.types'

const customerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200, 'Máximo 200 caracteres.'),
  phone: z.string().trim().min(1, 'El teléfono es obligatorio.').max(50, 'Máximo 50 caracteres.'),
  email: z.string().trim().max(320, 'Máximo 320 caracteres.').refine(
    (value) => !value || z.string().email().safeParse(value).success,
    'Email no válido.',
  ),
  notes: z.string(),
  active: z.boolean(),
})

type CustomerFormValues = z.infer<typeof customerSchema>

interface CustomerFormProps {
  customer?: Customer
  onClose: () => void
}

export function CustomerForm({ customer, onClose }: CustomerFormProps) {
  const queryClient = useQueryClient()
  const form = useForm<CustomerFormValues>({
    defaultValues: {
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      notes: customer?.notes ?? '',
      active: customer?.active ?? true,
    },
  })
  const mutation = useMutation({
    mutationFn: (values: CustomerFormValues) => {
      const input: SaveCustomerInput = {
        name: values.name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        notes: values.notes.trim(),
        active: values.active,
      }
      return customer
        ? updateCustomer(customer.id, input)
        : createCustomer(input)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() })
    },
  })

  const submit = form.handleSubmit(async (values) => {
    const result = customerSchema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && field in values) {
          form.setError(field as keyof CustomerFormValues, { message: issue.message })
        }
      }
      return
    }
    await mutation.mutateAsync(result.data).catch(() => undefined)
  })

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
      <Field label="Nombre" error={form.formState.errors.name?.message}>
        <Input autoFocus {...form.register('name')} />
      </Field>
      <Field label="Teléfono" error={form.formState.errors.phone?.message}>
        <Input type="tel" {...form.register('phone')} />
      </Field>
      <Field label="Email" error={form.formState.errors.email?.message}>
        <Input type="email" {...form.register('email')} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-1 text-sm font-medium">
        <input type="checkbox" className="size-4" {...form.register('active')} />
        Cliente activo
      </label>
      <Field label="Notas" error={form.formState.errors.notes?.message} className="md:col-span-2">
        <textarea
          className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          {...form.register('notes')}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        {mutation.isSuccess && <span className="text-sm text-emerald-700">Guardado correctamente.</span>}
      </div>
      {mutation.error && (
        <p role="alert" className="text-sm text-destructive md:col-span-2">
          {customerErrorMessage(mutation.error)}
        </p>
      )}
    </form>
  )
}

function Field({ label, error, children, className = '' }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`space-y-1.5 text-sm font-medium ${className}`}>
      <span>{label}</span>
      {children}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  )
}
