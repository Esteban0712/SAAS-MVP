import { NavLink } from 'react-router'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6 text-center">
      <section>
        <p className="text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Página no encontrada
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          La ruta solicitada no existe en el frontend.
        </p>
        <Button asChild className="mt-6">
          <NavLink to="/app/dashboard">Volver al dashboard</NavLink>
        </Button>
      </section>
    </main>
  )
}
