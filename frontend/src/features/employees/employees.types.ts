export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'
export interface BranchOption { id: string; name: string; isMain: boolean; active: boolean }
export interface Employee { id: string; branchId: string; userId: string | null; displayName: string; active: boolean; phone: string | null; notes: string | null; createdAt: string; updatedAt: string; branch: BranchOption }
export interface EmployeeList { items: Employee[]; page: number; pageSize: number; total: number; totalPages: number }
export interface EmployeeListParams { search: string; page: number; pageSize: number }
export interface SaveEmployeeInput { displayName: string; branchId: string; phone: string; notes: string; active: boolean }
export interface EmployeeSchedule { dayOfWeek: DayOfWeek; startTime: string; endTime: string; active: boolean }
