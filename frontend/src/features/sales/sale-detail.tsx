import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { PaymentForm } from './payment-form'
import { ReceiptView } from './receipt-view'
import { saleKeys, updateSale } from './sales-api'
import { saleError } from './sales-error'
import { statusLabel } from './sale-status'
import { useSalePayments } from './use-sales'
import type { Sale, SaleStatus } from './types'

export function SaleDetail({ sale, canManage }: { sale: Sale; canManage: boolean }) {
  const client = useQueryClient(), payments = useSalePayments(sale.id, true)
  const statusMutation = useMutation({ mutationFn: (status: SaleStatus) => updateSale(sale.id, { status }), onSuccess: async (saved) => { client.setQueryData(saleKeys.detail(saved.id), saved); await client.invalidateQueries({ queryKey: saleKeys.lists() }) } })
  return <div className="space-y-6"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="Estado" value={statusLabel(sale.status)} /><Info label="Cliente" value={sale.customer?.name ?? 'Consumidor final'} /><Info label="Sucursal" value={sale.branch.name} /><Info label="Empleado" value={sale.employee?.displayName ?? 'Sin empleado'} /></div><div className="overflow-x-auto"><table className="w-full min-w-150 text-sm"><thead><tr className="border-b text-left"><th className="p-2">Ítem</th><th className="p-2">Cantidad</th><th className="p-2">Precio</th><th className="p-2 text-right">Total</th></tr></thead><tbody>{sale.items.map((item) => <tr key={item.id} className="border-b"><td className="p-2">{item.description}</td><td className="p-2">{item.quantity}</td><td className="p-2">{item.unitPrice}</td><td className="p-2 text-right">{item.total}</td></tr>)}</tbody></table></div><div className="ml-auto grid max-w-sm gap-1 text-sm"><Total label="Subtotal" value={sale.subtotal} /><Total label="Descuento" value={sale.discountTotal} /><Total label="Impuestos" value={sale.taxTotal} /><Total label="Total" value={sale.total} strong /><Total label="Pagado" value={sale.amountPaid} /><Total label="Saldo" value={sale.balanceDue} strong /></div>
    {canManage && sale.status === 'DRAFT' && <div className="flex gap-2"><Button disabled={statusMutation.isPending} onClick={() => statusMutation.mutate('PENDING_PAYMENT')}>Abrir cobro</Button><Button variant="outline" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate('CANCELLED')}>Cancelar venta</Button></div>}{statusMutation.error && <p role="alert" className="text-sm text-destructive">{saleError(statusMutation.error)}</p>}
    <section className="space-y-3"><h3 className="font-medium">Pagos</h3>{payments.isPending && <p className="text-sm text-muted-foreground">Cargando pagos…</p>}{payments.error && <p className="text-sm text-destructive">{saleError(payments.error)}</p>}{payments.data?.length === 0 && <p className="text-sm text-muted-foreground">No hay pagos registrados.</p>}<div className="grid gap-2 sm:grid-cols-2">{payments.data?.map((payment) => <article key={payment.id} className="rounded-lg border p-3 text-sm"><div className="flex justify-between"><strong>{payment.amount}</strong><span>{payment.status === 'COMPLETED' ? 'Completado' : 'Pendiente'}</span></div><p className="text-muted-foreground">{payment.method} · {payment.externalReference || 'Sin referencia'}</p></article>)}</div>{canManage && ['PENDING_PAYMENT', 'PAID'].includes(sale.status) && <PaymentForm saleId={sale.id} balanceDue={sale.balanceDue} />}</section>
    <section className="space-y-3"><h3 className="font-medium">Recibo</h3><ReceiptView sale={sale} canManage={canManage} /></section>
  </div>
}
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div> }
function Total({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`flex justify-between ${strong ? 'font-semibold' : ''}`}><span>{label}</span><span>{value}</span></div> }
