import type { SaleStatus } from './types'
export function statusLabel(status: SaleStatus) { return ({ DRAFT: 'Borrador', PENDING_PAYMENT: 'Pendiente de pago', PAID: 'Pagada', CANCELLED: 'Cancelada' } as Record<SaleStatus, string>)[status] }
