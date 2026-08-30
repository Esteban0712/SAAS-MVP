import { apiFetch } from '@/api/client'
import type { CreateSaleInput, Payment, PaymentInput, PaymentResult, Receipt, Sale, SaleList, SaleListParams, SaleStatus } from './types'

export const saleKeys = {
  all: ['sales'] as const,
  lists: () => ['sales', 'list'] as const,
  list: (params: SaleListParams) => ['sales', 'list', params] as const,
  detail: (id: string) => ['sales', 'detail', id] as const,
  payments: (id: string) => ['sales', 'payments', id] as const,
  receipt: (id: string) => ['sales', 'receipt', id] as const,
}
export function getSales(params: SaleListParams) { const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) }); if (params.search) query.set('search', params.search); if (params.status) query.set('status', params.status); return apiFetch<SaleList>(`/sales?${query}`) }
export const getSale = (id: string) => apiFetch<Sale>(`/sales/${id}`)
export function createSale(input: CreateSaleInput) { return apiFetch<Sale>('/sales', { method: 'POST', body: JSON.stringify(input) }) }
export function updateSale(id: string, input: { status?: SaleStatus; notes?: string }) { return apiFetch<Sale>(`/sales/${id}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export const getPayments = (id: string) => apiFetch<Payment[]>(`/sales/${id}/payments`)
export function addPayment(id: string, input: PaymentInput) { return apiFetch<PaymentResult>(`/sales/${id}/payments`, { method: 'POST', body: JSON.stringify(input) }) }
export const getReceipt = (id: string) => apiFetch<Receipt>(`/sales/${id}/receipt`)
export const generateReceipt = (id: string) => apiFetch<Receipt>(`/sales/${id}/receipt`, { method: 'POST' })
