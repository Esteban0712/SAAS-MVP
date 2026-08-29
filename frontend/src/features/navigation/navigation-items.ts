import {
  CalendarDays,
  ChartNoAxesCombined,
  LayoutDashboard,
  Settings,
  UserRoundCog,
  Users,
  Wrench,
} from 'lucide-react'

import type { NavigationItem } from '@/types/navigation'

export const appNavigation: NavigationItem[] = [
  { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { label: 'Agenda', href: '/app/agenda', icon: CalendarDays, permission: 'appointments.view' },
  { label: 'Clientes', href: '/app/clientes', icon: Users, permission: 'customers.view' },
  { label: 'Empleados', href: '/app/empleados', icon: UserRoundCog, permission: 'employees.view' },
  { label: 'Servicios', href: '/app/servicios', icon: Wrench, permission: 'services.view' },
  { label: 'Ventas', href: '/app/ventas', icon: ChartNoAxesCombined, permission: 'sales.view' },
  { label: 'Usuarios', href: '/app/usuarios', icon: Users, permission: 'users.view' },
  { label: 'Configuración', href: '/app/configuracion', icon: Settings, permission: 'settings.view' },
]
