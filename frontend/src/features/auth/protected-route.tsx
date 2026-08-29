import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useSession } from './use-session'

interface ProtectedRouteProps {
  actorType: 'USER' | 'PLATFORM'
  children: ReactNode
}

export function ProtectedRoute({ actorType, children }: ProtectedRouteProps) {
  const session = useSession()
  const location = useLocation()

  if (session.isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Comprobando sesión…</p>
      </main>
    )
  }

  if (!session.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (session.data.actorType !== actorType) {
    return (
      <Navigate
        to={session.data.actorType === 'PLATFORM' ? '/platform' : '/app'}
        replace
      />
    )
  }

  return children
}
