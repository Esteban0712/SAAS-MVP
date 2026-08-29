import { createBrowserRouter, Navigate } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { EmployeeLayout } from '@/components/layout/employee-layout'
import { PlatformLayout } from '@/components/layout/platform-layout'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { DashboardPage } from '@/pages/dashboard-page'
import { CustomersPage } from '@/pages/customers-page'
import { LoginPage } from '@/pages/login-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { PlaceholderPage } from '@/pages/placeholder-page'
import { UserManagementPage } from '@/pages/user-management-page'

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
    element: (
      <ProtectedRoute actorType="USER">
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      {
        path: 'agenda',
        element: <PlaceholderPage eyebrow="Operación" title="Agenda" />,
      },
      {
        path: 'clientes',
        element: <CustomersPage />,
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
        element: <UserManagementPage />,
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
    element: (
      <ProtectedRoute actorType="USER">
        <EmployeeLayout />
      </ProtectedRoute>
    ),
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
    element: (
      <ProtectedRoute actorType="PLATFORM">
        <PlatformLayout />
      </ProtectedRoute>
    ),
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
