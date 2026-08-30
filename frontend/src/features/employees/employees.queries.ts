import { useQuery } from '@tanstack/react-query'
import { employeeQueryKeys, getBranches, getEmployee, getEmployees, getEmployeeSchedules, getEmployeeServices } from './employees.api'
import type { EmployeeListParams } from './employees.types'
export const useEmployeesQuery = (params: EmployeeListParams, enabled: boolean) => useQuery({ queryKey: employeeQueryKeys.list(params), queryFn: () => getEmployees(params), enabled, retry: false })
export const useBranchesQuery = (enabled: boolean) => useQuery({ queryKey: employeeQueryKeys.branches, queryFn: getBranches, enabled, retry: false })
export const useEmployeeQuery = (id: string, enabled: boolean) => useQuery({ queryKey: employeeQueryKeys.detail(id), queryFn: () => getEmployee(id), enabled, retry: false })
export const useEmployeeServicesQuery = (id: string, enabled: boolean) => useQuery({ queryKey: employeeQueryKeys.services(id), queryFn: () => getEmployeeServices(id), enabled, retry: false })
export const useEmployeeSchedulesQuery = (id: string, enabled: boolean) => useQuery({ queryKey: employeeQueryKeys.schedules(id), queryFn: () => getEmployeeSchedules(id), enabled, retry: false })
