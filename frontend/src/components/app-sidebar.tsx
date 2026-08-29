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

export function AppSidebar() {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()

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
              {appNavigation.map((item) => (
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
            AD
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">Admin Demo</p>
            <p className="truncate text-xs text-muted-foreground">
              admin@demo.local
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
