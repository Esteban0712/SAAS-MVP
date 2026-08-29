import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  CalendarCheck,
  CircleEuro,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { HealthStatus } from '@/features/health/components/health-status'

interface DemoSummary {
  title: string
  value: string
  detail: string
  icon: LucideIcon
}

const demoSummaries: DemoSummary[] = [
  {
    title: 'Citas de hoy',
    value: '12',
    detail: '3 pendientes · dato ficticio',
    icon: CalendarCheck,
  },
  {
    title: 'Clientes',
    value: '248',
    detail: 'Total demo local',
    icon: UsersRound,
  },
  {
    title: 'Ventas de hoy',
    value: '€ 1.240',
    detail: 'Importe ficticio',
    icon: CircleEuro,
  },
  {
    title: 'Empleados activos',
    value: '8',
    detail: 'Equipo demo local',
    icon: UserRoundCheck,
  },
]

export function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Resumen</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Bienvenido a Deenova
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HealthStatus />
          <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Datos DEMO locales · No reales
          </span>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {demoSummaries.map((summary) => (
          <Card key={summary.title}>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardDescription>{summary.title}</CardDescription>
                <CardTitle className="mt-1 text-2xl">
                  {summary.value}
                </CardTitle>
              </div>
              <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                <summary.icon className="size-4" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {summary.detail}
            </CardContent>
          </Card>
        ))}
      </section>
      <Card className="min-h-64 overflow-hidden">
        <CardHeader>
          <CardTitle>Próxima actividad</CardTitle>
          <CardDescription>
            Vista local sin conexión a API ni datos reales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid min-h-36 place-items-center rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground sm:p-8">
            Shell responsive listo para integrar rutas y datos en bloques
            posteriores.
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
