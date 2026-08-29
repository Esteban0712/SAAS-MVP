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
  { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Agenda', href: '/app/agenda', icon: CalendarDays },
  { label: 'Clientes', href: '/app/clientes', icon: Users },
  { label: 'Empleados', href: '/app/empleados', icon: UserRoundCog },
  { label: 'Servicios', href: '/app/servicios', icon: Wrench },
  { label: 'Ventas', href: '/app/ventas', icon: ChartNoAxesCombined },
  { label: 'Usuarios', href: '/app/usuarios', icon: Users },
  { label: 'Configuración', href: '/app/configuracion', icon: Settings },
]
