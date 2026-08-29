import { NavLink, useLocation } from 'react-router'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { appNavigation } from '@/features/navigation/navigation-items'
import { useSession } from '@/features/auth/use-session'

export function AppSidebar() {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const { data: principal } = useSession()
  const navigation =
    principal?.actorType === 'USER'
      ? appNavigation.filter(
          (item) =>
            !item.permission || principal.permissions.includes(item.permission),
        )
      : []
  const identity =
    principal?.actorType === 'USER'
      ? principal.displayName || principal.username
      : ''

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            D
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">Deenova MVP</span>
            <span className="truncate text-xs text-muted-foreground">
              Espacio de trabajo
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <NavLink
                      to={item.href}
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-3">
        <div className="flex items-center gap-3 rounded-lg p-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
            {identity.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">{identity}</p>
            <p className="truncate text-xs text-muted-foreground">
              {principal?.actorType === 'USER' ? principal.username : ''}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
