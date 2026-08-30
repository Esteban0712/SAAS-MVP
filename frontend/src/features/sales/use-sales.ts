import { useQuery } from '@tanstack/react-query'
import { getPayments, getReceipt, getSale, getSales, saleKeys } from './sales-api'
import type { SaleListParams } from './types'
export const useSales = (params: SaleListParams, enabled: boolean) => useQuery({ queryKey: saleKeys.list(params), queryFn: () => getSales(params), enabled, retry: false })
export const useSale = (id: string, enabled: boolean) => useQuery({ queryKey: saleKeys.detail(id), queryFn: () => getSale(id), enabled, retry: false })
export const useSalePayments = (id: string, enabled: boolean) => useQuery({ queryKey: saleKeys.payments(id), queryFn: () => getPayments(id), enabled, retry: false })
export const useSaleReceipt = (id: string, enabled: boolean) => useQuery({ queryKey: saleKeys.receipt(id), queryFn: () => getReceipt(id), enabled, retry: false })
