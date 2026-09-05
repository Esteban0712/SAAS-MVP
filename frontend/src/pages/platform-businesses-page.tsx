import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { platformBusinessErrorMessage } from '@/features/platform-businesses/platform-businesses-error'
import { usePlatformBusinessesQuery } from '@/features/platform-businesses/platform-businesses.queries'
import type { BusinessStatus } from '@/features/platform-businesses/platform-businesses.types'

const PAGE_SIZE = 20
const statuses: Array<{ value: BusinessStatus | ''; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'TRIAL', label: 'Prueba' },
  { value: 'PAYMENT_PENDING', label: 'Pago pendiente' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'CANCELLED', label: 'Cancelado' },
]

export function PlatformBusinessesPage() {
  const location = useLocation()
  const createdBusiness = Boolean(
    (location.state as { createdBusiness?: boolean } | null)?.createdBusiness,
  )
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<BusinessStatus | ''>('')
  const [page, setPage] = useState(1)
  const businesses = usePlatformBusinessesQuery({
    search,
    status,
    page,
    pageSize: PAGE_SIZE,
  })

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Plataforma</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Negocios
          </h1>
        </div>
        <Button asChild>
          <Link to="/platform/businesses/new">Nuevo negocio</Link>
        </Button>
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Directorio de negocios</CardTitle>
          <CardDescription>
            Busca por nombre o slug y filtra por estado.
          </CardDescription>
          <form
            className="grid max-w-3xl gap-2 pt-2 sm:grid-cols-[1fr_12rem_auto]"
            onSubmit={submitSearch}
          >
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar negocios"
              aria-label="Buscar negocios"
            />
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as BusinessStatus | '')
                setPage(1)
              }}
              aria-label="Filtrar por estado"
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {statuses.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Buscar
            </Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-5">
          {createdBusiness && (
            <p role="status" className="text-sm text-emerald-700">
              Negocio creado correctamente.
            </p>
          )}
          {businesses.isPending && (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
          {businesses.error && (
            <p role="alert" className="text-sm text-destructive">
              {platformBusinessErrorMessage(businesses.error)}
            </p>
          )}
          {businesses.data?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {search || status
                ? 'No hay negocios que coincidan con los filtros.'
                : 'Todavía no hay negocios.'}
            </p>
          )}
          {businesses.data && businesses.data.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-3xl text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Negocio</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Zona horaria</th>
                    <th className="px-4 py-3 font-medium">Moneda</th>
                    <th className="px-4 py-3 font-medium">Usuarios máx.</th>
                    <th className="px-4 py-3 font-medium">Creado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {businesses.data.items.map((business) => (
                    <tr key={business.id}>
                      <td className="px-4 py-3">
                        <Link
                          className="font-medium underline-offset-4 hover:underline"
                          to={`/platform/businesses/${business.id}`}
                        >
                          {business.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {business.slug}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={business.status} />
                      </td>
                      <td className="px-4 py-3">{business.timezone}</td>
                      <td className="px-4 py-3">{business.currency}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {business.maxUsers}
                      </td>
                      <td className="px-4 py-3">
                        {new Intl.DateTimeFormat('es-ES', {
                          dateStyle: 'medium',
                        }).format(new Date(business.createdAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {businesses.data && (
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {businesses.data.total}{' '}
                {businesses.data.total === 1 ? 'negocio' : 'negocios'} · Página{' '}
                {businesses.data.page} de{' '}
                {Math.max(businesses.data.totalPages, 1)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1 || businesses.isFetching}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    page >= businesses.data.totalPages || businesses.isFetching
                  }
                  onClick={() => setPage((value) => value + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function StatusBadge({ status }: { status: BusinessStatus }) {
  const label =
    statuses.find((option) => option.value === status)?.label ?? status
  const tone =
    status === 'ACTIVE'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'SUSPENDED' || status === 'CANCELLED'
        ? 'bg-red-100 text-red-800'
        : 'bg-amber-100 text-amber-800'
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  )
}
