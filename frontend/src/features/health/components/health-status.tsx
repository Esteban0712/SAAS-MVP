import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'

import { useHealthQuery } from '@/features/health/hooks/use-health-query'
import { cn } from '@/lib/utils'

export function HealthStatus() {
  const health = useHealthQuery()
  const isHealthy = health.data?.status === 'ok' && health.data.database === 'ok'

  const label = health.isPending
    ? 'Comprobando servicios'
    : isHealthy
      ? 'Backend y base de datos disponibles'
      : 'Backend no disponible'
  const Icon = health.isPending
    ? LoaderCircle
    : isHealthy
      ? CircleCheck
      : CircleAlert

  return (
    <div
      className={cn(
        'inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        isHealthy && 'border-emerald-200 bg-emerald-50 text-emerald-700',
        health.isError && 'border-amber-200 bg-amber-50 text-amber-700',
      )}
      role="status"
    >
      <Icon
        className={cn('size-3.5', health.isPending && 'animate-spin')}
        aria-hidden="true"
      />
      {label}
    </div>
  )
}
