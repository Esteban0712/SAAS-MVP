export interface Service { id: string; name: string; durationMinutes: number; price: string; active: boolean; description: string | null; category: string | null; createdAt?: string; updatedAt?: string }
export interface ServiceList { items: Service[]; page: number; pageSize: number; total: number; totalPages: number }
export interface ServiceListParams { search: string; page: number; pageSize: number }
export interface SaveServiceInput { name: string; durationMinutes: number; price: string; description: string; category: string; active: boolean }
