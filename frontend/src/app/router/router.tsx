import { createBrowserRouter, Navigate } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { EmployeeLayout } from '@/components/layout/employee-layout'
import { PlatformLayout } from '@/components/layout/platform-layout'
import { DashboardPage } from '@/pages/dashboard-page'
import { LoginPage } from '@/pages/login-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { PlaceholderPage } from '@/pages/placeholder-page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/app/dashboard" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      {
        path: 'agenda',
        element: <PlaceholderPage eyebrow="Operación" title="Agenda" />,
      },
      {
        path: 'clientes',
        element: <PlaceholderPage eyebrow="Directorio" title="Clientes" />,
      },
      {
        path: 'empleados',
        element: <PlaceholderPage eyebrow="Equipo" title="Empleados" />,
      },
      {
        path: 'servicios',
        element: <PlaceholderPage eyebrow="Catálogo" title="Servicios" />,
      },
      {
        path: 'ventas',
        element: <PlaceholderPage eyebrow="Operación" title="Ventas" />,
      },
      {
        path: 'usuarios',
        element: <PlaceholderPage eyebrow="Administración" title="Usuarios" />,
      },
      {
        path: 'configuracion',
        element: (
          <PlaceholderPage eyebrow="Administración" title="Configuración" />
        ),
      },
    ],
  },
  {
    path: '/employee',
    element: <EmployeeLayout />,
    children: [
      { index: true, element: <Navigate to="today" replace /> },
      {
        path: 'today',
        element: (
          <PlaceholderPage eyebrow="Mi jornada" title="Agenda de hoy" />
        ),
      },
      {
        path: 'appointments/:id',
        element: (
          <PlaceholderPage eyebrow="Mi jornada" title="Detalle de cita" />
        ),
      },
    ],
  },
  {
    path: '/platform',
    element: <PlatformLayout />,
    children: [
      { index: true, element: <Navigate to="businesses" replace /> },
      {
        path: 'businesses',
        element: (
          <PlaceholderPage eyebrow="Plataforma" title="Negocios" />
        ),
      },
      {
        path: 'businesses/new',
        element: (
          <PlaceholderPage eyebrow="Plataforma" title="Nuevo negocio" />
        ),
      },
      {
        path: 'businesses/:id',
        element: (
          <PlaceholderPage eyebrow="Plataforma" title="Detalle del negocio" />
        ),
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
