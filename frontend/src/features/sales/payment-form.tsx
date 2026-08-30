import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addPayment, saleKeys } from './sales-api'
import { saleError } from './sales-error'
import type { PaymentInput } from './types'

const schema = z.object({ amount: z.string().regex(/^(?:(?:[1-9]\d{0,9})(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/, 'El importe debe ser un decimal positivo.'), method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']), externalReference: z.string().max(500), status: z.enum(['PENDING', 'COMPLETED']) })
type Values = z.infer<typeof schema>
export function PaymentForm({ saleId, balanceDue }: { saleId: string; balanceDue: string }) {
  const client = useQueryClient(), form = useForm<Values>({ defaultValues: { amount: balanceDue, method: 'CASH', externalReference: '', status: 'COMPLETED' } })
  const mutation = useMutation({ mutationFn: (values: Values) => addPayment(saleId, { ...values, externalReference: values.externalReference.trim() } as PaymentInput), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: saleKeys.detail(saleId) }), client.invalidateQueries({ queryKey: saleKeys.payments(saleId) }), client.invalidateQueries({ queryKey: saleKeys.lists() })]); form.reset({ amount: '0.00', method: 'CASH', externalReference: '', status: 'COMPLETED' }) } })
  const submit = form.handleSubmit(async (raw) => { const parsed = schema.safeParse(raw); if (!parsed.success) { for (const issue of parsed.error.issues) { const field = issue.path[0]; if (typeof field === 'string') form.setError(field as keyof Values, { message: issue.message }) } return } await mutation.mutateAsync(parsed.data).catch(() => undefined) })
  return <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-4" onSubmit={submit}><label className="space-y-1 text-sm font-medium">Monto<Input inputMode="decimal" {...form.register('amount')} />{form.formState.errors.amount && <span className="text-xs text-destructive">{form.formState.errors.amount.message}</span>}</label><label className="space-y-1 text-sm font-medium">Método<select className={selectClass} {...form.register('method')}><option value="CASH">Efectivo</option><option value="CARD">Tarjeta</option><option value="TRANSFER">Transferencia</option><option value="OTHER">Otro</option></select></label><label className="space-y-1 text-sm font-medium">Referencia<Input {...form.register('externalReference')} /></label><label className="space-y-1 text-sm font-medium">Estado<select className={selectClass} {...form.register('status')}><option value="COMPLETED">Completado</option><option value="PENDING">Pendiente</option></select></label><div className="flex items-center gap-2 md:col-span-4"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Registrando…' : 'Registrar pago'}</Button>{mutation.isSuccess && <span className="text-sm text-emerald-700">Pago registrado.</span>}</div>{mutation.error && <p role="alert" className="text-sm text-destructive md:col-span-4">{saleError(mutation.error)}</p>}</form>
}
const selectClass = 'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm'
