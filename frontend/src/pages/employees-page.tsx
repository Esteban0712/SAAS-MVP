import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useSession } from '@/features/auth/use-session'
import { AssignedServicesForm } from '@/features/employees/assigned-services-form'
import { EmployeeForm } from '@/features/employees/employee-form'
import { employeeErrorMessage } from '@/features/employees/employees-error'
import { useBranchesQuery, useEmployeesQuery } from '@/features/employees/employees.queries'
import type { Employee } from '@/features/employees/employees.types'
import { ScheduleForm } from '@/features/employees/schedule-form'
type Editor = { mode: 'create' } | { mode: 'edit'; employee: Employee; tab: 'data' | 'services' | 'schedule' } | null
const PAGE_SIZE = 20
export function EmployeesPage() {
  const { data: principal } = useSession(); const permissions = principal?.actorType === 'USER' ? principal.permissions : []; const canView = permissions.includes('employees.view'); const canManage = permissions.includes('employees.manage'); const canViewServices = permissions.includes('services.view')
  const [searchInput, setSearchInput] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [editor, setEditor] = useState<Editor>(null)
  const employees = useEmployeesQuery({ search, page, pageSize: PAGE_SIZE }, canView); const branches = useBranchesQuery(canView)
  if (!canView) return <Restricted text="No tienes permiso para consultar empleados." />
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1); setEditor(null) }
  const edit = editor?.mode === 'edit' ? editor : null
  return <main className="flex flex-1 flex-col gap-6 p-4 md:p-6"><section className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">Equipo</p><h1 className="text-2xl font-semibold md:text-3xl">Empleados</h1></div>{canManage && <Button onClick={() => setEditor({ mode: 'create' })}>Nuevo empleado</Button>}</section>
    {editor && canManage && <Card><CardHeader><CardTitle>{editor.mode === 'create' ? 'Crear empleado' : `Editar ${editor.employee.displayName}`}</CardTitle>{edit && <div className="flex flex-wrap gap-2 pt-2">{(['data', 'services', 'schedule'] as const).map((tab) => <Button key={tab} size="sm" variant={edit.tab === tab ? 'default' : 'outline'} onClick={() => setEditor({ ...edit, tab })}>{tab === 'data' ? 'Datos' : tab === 'services' ? 'Servicios' : 'Horario'}</Button>)}</div>}</CardHeader><CardContent>
      {branches.isPending && <p className="text-sm text-muted-foreground">Cargando sucursales…</p>}{branches.error && <p role="alert" className="text-sm text-destructive">{employeeErrorMessage(branches.error)}</p>}
      {branches.data && (!edit || edit.tab === 'data') && <EmployeeForm key={edit?.employee.id ?? 'new'} employee={edit?.employee} branches={branches.data} onClose={() => setEditor(null)} onSaved={(saved) => setEditor({ mode: 'edit', employee: saved, tab: 'data' })} />}
      {edit?.tab === 'services' && <AssignedServicesForm employeeId={edit.employee.id} canViewServices={canViewServices} />}{edit?.tab === 'schedule' && <ScheduleForm employeeId={edit.employee.id} />}
    </CardContent></Card>}
    <Card><CardHeader className="border-b"><CardTitle>Directorio de empleados</CardTitle><CardDescription>Busca por nombre o teléfono.</CardDescription><form className="flex max-w-xl flex-col gap-2 pt-2 sm:flex-row" onSubmit={submitSearch}><Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar empleados" /><Button type="submit" variant="outline">Buscar</Button></form></CardHeader><CardContent className="space-y-5">
      {employees.isPending && <p className="text-sm text-muted-foreground">Cargando…</p>}{employees.error && <p role="alert" className="text-sm text-destructive">{employeeErrorMessage(employees.error)}</p>}{employees.data?.items.length === 0 && <p className="text-sm text-muted-foreground">{search ? 'No hay coincidencias.' : 'Todavía no hay empleados.'}</p>}
      {employees.data && employees.data.items.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{employees.data.items.map((employee) => <article key={employee.id} className="flex min-w-0 flex-col gap-3 rounded-lg border p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate font-medium">{employee.displayName}</h2><p className="text-sm text-muted-foreground">{employee.branch.name}</p></div><span className="rounded-full bg-muted px-2 py-1 text-xs">{employee.active ? 'Activo' : 'Inactivo'}</span></div><p className="text-sm text-muted-foreground">{employee.phone || 'Sin teléfono'}</p>{canManage && <Button size="sm" variant="outline" className="mt-auto self-start" onClick={() => setEditor({ mode: 'edit', employee, tab: 'data' })}>Editar</Button>}</article>)}</div>}
      {employees.data && <Pagination page={page} total={employees.data.total} totalPages={employees.data.totalPages} busy={employees.isFetching} onPage={setPage} />}
    </CardContent></Card>
  </main>
}
function Restricted({ text }: { text: string }) { return <main className="flex flex-1 p-4 md:p-6"><Card className="w-full"><CardHeader><CardTitle>Acceso restringido</CardTitle><CardDescription>{text}</CardDescription></CardHeader></Card></main> }
function Pagination({ page, total, totalPages, busy, onPage }: { page: number; total: number; totalPages: number; busy: boolean; onPage: (page: number) => void }) { return <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{total} empleados · Página {page} de {Math.max(totalPages, 1)}</p><div className="flex gap-2"><Button variant="outline" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>Anterior</Button><Button variant="outline" disabled={page >= totalPages || busy} onClick={() => onPage(page + 1)}>Siguiente</Button></div></div> }
