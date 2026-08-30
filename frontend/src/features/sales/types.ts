export type SaleStatus = 'DRAFT' | 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED'
export type SaleItemType = 'SERVICE' | 'PRODUCT' | 'OTHER'
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'
export type PaymentStatus = 'PENDING' | 'COMPLETED'

export interface SaleItem { id: string; serviceId: string | null; type: SaleItemType; description: string; quantity: number; unitPrice: string; total: string }
export interface Payment { id: string; method: PaymentMethod; amount: string; status: PaymentStatus; externalReference: string | null; paidAt: string | null; createdAt: string }
export interface Receipt { id: string; saleId: string; receiptNumber: string; status: 'PENDING' | 'GENERATED' | 'FAILED'; dataJson: unknown; generatedAt: string; pdfUrl: string | null; sentAt: string | null; createdAt: string }
export interface Sale {
  id: string; businessId: string; branchId: string; customerId: string | null; appointmentId: string | null; employeeId: string | null
  status: SaleStatus; subtotal: string; discountTotal: string; taxTotal: string; total: string; amountPaid: string; balanceDue: string; notes: string | null; createdAt: string; updatedAt: string
  branch: { id: string; name: string }; customer: { id: string; name: string; phone: string } | null; employee: { id: string; displayName: string } | null
  appointment: { id: string; startAt: string; status: string } | null; items: SaleItem[]; payments: Payment[]; receipt: Receipt | null
}
export interface SaleList { items: Sale[]; page: number; pageSize: number; total: number; totalPages: number }
export interface SaleListParams { search: string; status: SaleStatus | ''; page: number; pageSize: number }
export interface SaleItemInput { serviceId?: string; type: SaleItemType; description: string; quantity: number; unitPrice: string }
export interface CreateSaleInput { appointmentId?: string; branchId?: string; customerId?: string; employeeId?: string; items?: SaleItemInput[]; discountTotal?: string; taxTotal?: string; notes?: string }
export interface PaymentInput { method: PaymentMethod; amount: string; status: PaymentStatus; externalReference?: string }
export interface PaymentResult { payment: Payment; amountPaid: string; balanceDue: string; saleStatus: SaleStatus }
