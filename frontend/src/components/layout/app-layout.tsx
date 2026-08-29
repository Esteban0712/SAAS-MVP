import { Outlet, useLocation } from 'react-router'

import { AppSidebar } from '@/components/app-sidebar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { appNavigation } from '@/features/navigation/navigation-items'
import { LogoutButton } from '@/features/auth/logout-button'
import { useSession } from '@/features/auth/use-session'

export function AppLayout() {
  const { pathname } = useLocation()
  const { data: principal } = useSession()
  const currentPage = appNavigation.find((item) => item.href === pathname)
  const identity =
    principal?.actorType === 'USER'
      ? principal.displayName || principal.username
      : principal?.username

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {currentPage?.label ?? 'Deenova'}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Panel de administración
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="hidden sm:inline-flex">
                Nueva cita
              </Button>
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
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
