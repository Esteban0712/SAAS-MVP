import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'

import { Button } from '@/components/ui/button'
import { LogoutButton } from '@/features/auth/logout-button'
import { useSession } from '@/features/auth/use-session'

interface SectionLayoutProps {
  area: string
  title: string
  navigation: Array<{ label: string; href: string }>
  actions?: ReactNode
}

export function SectionLayout({
  area,
  title,
  navigation,
  actions,
}: SectionLayoutProps) {
  const { data: principal } = useSession()
  const identity =
    principal?.actorType === 'USER'
      ? principal.displayName || principal.username
      : principal?.username

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:gap-4 md:px-6 md:py-4">
          <div className="grid size-9 place-items-center rounded-lg bg-primary font-semibold text-primary-foreground">
            D
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {area}
            </p>
            <p className="font-semibold">{title}</p>
          </div>
          <div className="flex items-center gap-2">
            {actions ?? (
              <Button asChild variant="outline" size="sm">
                <NavLink to="/app/dashboard">
                  <span className="sm:hidden">Panel</span>
                  <span className="hidden sm:inline">Panel principal</span>
                </NavLink>
              </Button>
            )}
            <span className="hidden text-sm font-medium sm:inline">
              {identity}
            </span>
            <div
              className="grid size-8 place-items-center rounded-full bg-muted text-xs font-semibold"
              aria-label={`Usuario: ${identity ?? ''}`}
            >
              {identity?.slice(0, 2).toUpperCase()}
            </div>
            <LogoutButton />
          </div>
        </div>
        <nav
          className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 md:px-6"
          aria-label={`Navegación de ${area}`}
        >
          {navigation.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end
              className={({ isActive }) =>
                `border-b-2 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-6xl">
        <Outlet />
      </main>
    </div>
  )
}
