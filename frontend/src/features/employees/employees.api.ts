import { apiFetch } from '@/api/client'
import type { Service } from '@/features/services/services.types'
import type { BranchOption, Employee, EmployeeList, EmployeeListParams, EmployeeSchedule, SaveEmployeeInput } from './employees.types'
export const employeeQueryKeys = {
  all: ['employees'] as const,
  lists: () => ['employees', 'list'] as const,
  list: (params: EmployeeListParams) => ['employees', 'list', params] as const,
  detail: (id: string) => ['employees', 'detail', id] as const,
  services: (id: string) => ['employees', 'services', id] as const,
  schedules: (id: string) => ['employees', 'schedules', id] as const,
  branches: ['employees', 'branches'] as const,
}
export function getEmployees(params: EmployeeListParams) { const q = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) }); if (params.search) q.set('search', params.search); return apiFetch<EmployeeList>(`/employees?${q}`) }
export const getBranches = () => apiFetch<BranchOption[]>('/employees/branches')
export const getEmployee = (id: string) => apiFetch<Employee>(`/employees/${id}`)
export function createEmployee(input: SaveEmployeeInput) { return apiFetch<Employee>('/employees', { method: 'POST', body: JSON.stringify(input) }) }
export function updateEmployee(id: string, input: SaveEmployeeInput) { return apiFetch<Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export const getEmployeeServices = (id: string) => apiFetch<Service[]>(`/employees/${id}/services`)
export function replaceEmployeeServices(id: string, serviceIds: string[]) { return apiFetch<Service[]>(`/employees/${id}/services`, { method: 'PUT', body: JSON.stringify({ serviceIds }) }) }
export const getEmployeeSchedules = (id: string) => apiFetch<EmployeeSchedule[]>(`/employees/${id}/schedules`)
export function replaceEmployeeSchedules(id: string, schedules: EmployeeSchedule[]) { return apiFetch<EmployeeSchedule[]>(`/employees/${id}/schedules`, { method: 'PUT', body: JSON.stringify({ schedules }) }) }
