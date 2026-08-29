import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CustomerForm } from '@/features/customers/customer-form'
import { customerErrorMessage } from '@/features/customers/customers-error'
import { useCustomersQuery } from '@/features/customers/customers.queries'
import type { Customer } from '@/features/customers/customers.types'
import { useSession } from '@/features/auth/use-session'

type Editor = { mode: 'create' } | { mode: 'edit'; customer: Customer } | null
const PAGE_SIZE = 20

export function CustomersPage() {
  const { data: principal } = useSession()
  const permissions = principal?.actorType === 'USER' ? principal.permissions : []
  const canView = permissions.includes('customers.view')
  const canManage = permissions.includes('customers.manage')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState<Editor>(null)
  const customers = useCustomersQuery({ search, page, pageSize: PAGE_SIZE }, canView)

  if (!canView) {
    return (
      <main className="flex flex-1 p-4 md:p-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
            <CardDescription>No tienes permiso para consultar clientes.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
    setEditor(null)
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Directorio</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Clientes</h1>
        </div>
        {canManage && <Button onClick={() => setEditor({ mode: 'create' })}>Nuevo cliente</Button>}
      </section>

      {editor && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>{editor.mode === 'create' ? 'Crear cliente' : `Editar ${editor.customer.name}`}</CardTitle>
            <CardDescription>Los datos se guardarán en el negocio actual.</CardDescription>
          </CardHeader>
          <CardContent>
            <CustomerForm
              key={editor.mode === 'create' ? 'new-customer' : editor.customer.id}
              customer={editor.mode === 'edit' ? editor.customer : undefined}
              onClose={() => setEditor(null)}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Directorio de clientes</CardTitle>
          <CardDescription>Busca por nombre, teléfono o email.</CardDescription>
          <form className="flex max-w-xl flex-col gap-2 pt-2 sm:flex-row" onSubmit={submitSearch}>
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar clientes"
              aria-label="Buscar clientes"
            />
            <Button type="submit" variant="outline">Buscar</Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-5">
          {customers.isPending && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {customers.error && <p role="alert" className="text-sm text-destructive">{customerErrorMessage(customers.error)}</p>}
          {customers.data?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {search ? 'No hay clientes que coincidan con la búsqueda.' : 'Todavía no hay clientes.'}
            </p>
          )}
          {customers.data && customers.data.items.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {customers.data.items.map((customer) => (
                <article key={customer.id} className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-medium">{customer.name}</h2>
                      <p className="break-all text-sm text-muted-foreground">{customer.phone}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium">
                      {customer.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="min-h-5 break-all text-sm text-muted-foreground">{customer.email || 'Sin email'}</p>
                  {canManage && (
                    <Button size="sm" variant="outline" className="mt-auto self-start" onClick={() => setEditor({ mode: 'edit', customer })}>
                      Editar
                    </Button>
                  )}
                </article>
              ))}
            </div>
          )}
          {customers.data && (
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {customers.data.total} {customers.data.total === 1 ? 'cliente' : 'clientes'} · Página {customers.data.page} de {Math.max(customers.data.totalPages, 1)}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1 || customers.isFetching} onClick={() => setPage((value) => value - 1)}>Anterior</Button>
                <Button variant="outline" disabled={page >= customers.data.totalPages || customers.isFetching} onClick={() => setPage((value) => value + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
