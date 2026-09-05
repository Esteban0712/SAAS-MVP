import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PlatformBusinessAdminForm } from '@/features/platform-businesses/platform-business-admin-form'
import {
  platformBusinessQueryKeys,
  reactivatePlatformBusiness,
  suspendPlatformBusiness,
} from '@/features/platform-businesses/platform-businesses.api'
import { platformBusinessErrorMessage } from '@/features/platform-businesses/platform-businesses-error'
import { usePlatformBusinessQuery } from '@/features/platform-businesses/platform-businesses.queries'

const countLabels: Record<string, string> = {
  branches: 'Sucursales',
  users: 'Usuarios',
  customers: 'Clientes',
  employees: 'Empleados',
  services: 'Servicios',
  appointments: 'Citas',
  sales: 'Ventas',
}

export function PlatformBusinessDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const business = usePlatformBusinessQuery(id)
  const statusMutation = useMutation({
    mutationFn: async (action: 'suspend' | 'reactivate') =>
      action === 'suspend'
        ? suspendPlatformBusiness(id)
        : reactivatePlatformBusiness(id),
    onSuccess: async (updated) => {
      queryClient.setQueryData(platformBusinessQueryKeys.detail(id), updated)
      await queryClient.invalidateQueries({
        queryKey: platformBusinessQueryKeys.lists(),
      })
    },
  })

  const changeStatus = (action: 'suspend' | 'reactivate') => {
    const verb = action === 'suspend' ? 'suspender' : 'reactivar'
    if (!window.confirm(`¿Confirmas que quieres ${verb} este negocio?`)) return
    statusMutation.mutate(action)
  }

  if (business.isPending) {
    return (
      <main className="flex flex-1 p-4 md:p-6">
        <p className="text-sm text-muted-foreground">Cargando negocio…</p>
      </main>
    )
  }
  if (business.error || !business.data) {
    return (
      <main className="flex flex-1 p-4 md:p-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>No se pudo cargar el negocio</CardTitle>
            <CardDescription>
              {platformBusinessErrorMessage(business.error)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/platform/businesses">Volver al listado</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  const detail = business.data
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{detail.slug}</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {detail.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creado {formatTimestamp(detail.createdAt)} · Actualizado{' '}
            {formatTimestamp(detail.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/platform/businesses">Volver</Link>
          </Button>
          {detail.status === 'ACTIVE' && (
            <Button
              variant="destructive"
              disabled={statusMutation.isPending}
              onClick={() => changeStatus('suspend')}
            >
              Suspender
            </Button>
          )}
          {detail.status === 'SUSPENDED' && (
            <Button
              disabled={statusMutation.isPending}
              onClick={() => changeStatus('reactivate')}
            >
              Reactivar
            </Button>
          )}
        </div>
      </section>

      {statusMutation.isSuccess && (
        <p role="status" className="text-sm text-emerald-700">
          Estado actualizado correctamente.
        </p>
      )}
      {statusMutation.error && (
        <p role="alert" className="text-sm text-destructive">
          {platformBusinessErrorMessage(statusMutation.error)}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(detail.summary).map(([key, value]) => (
          <Card key={key} size="sm">
            <CardHeader>
              <CardDescription>{countLabels[key] ?? key}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Configuración administrativa</CardTitle>
          <CardDescription>
            El estado se gestiona mediante las acciones superiores; slug y
            settings no son editables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlatformBusinessAdminForm key={detail.updatedAt} business={detail} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Sucursales</CardTitle>
            <CardDescription>
              {detail.branches.length
                ? 'Sucursales asociadas al negocio.'
                : 'No hay sucursales.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.branches.map((branch) => (
              <article key={branch.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium">{branch.name}</h2>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs">
                    {branch.isMain
                      ? 'Principal'
                      : branch.active
                        ? 'Activa'
                        : 'Inactiva'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {branch.address || 'Sin dirección'} ·{' '}
                  {branch.phone || 'Sin teléfono'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Creada {formatTimestamp(branch.createdAt)} · Actualizada{' '}
                  {formatTimestamp(branch.updatedAt)}
                </p>
              </article>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Settings JSON</CardTitle>
            <CardDescription>Solo lectura.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(detail.settingsJson, null, 2) ?? 'null'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
