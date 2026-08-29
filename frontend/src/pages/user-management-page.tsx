import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useSession } from '@/features/auth/use-session'
import { managementErrorMessage } from '@/features/user-management/management-error'
import {
  usePermissionsQuery,
  useRolesQuery,
  useUsersQuery,
} from '@/features/user-management/management.queries'
import type {
  RoleSummary,
  UserSummary,
} from '@/features/user-management/management.types'
import { RoleForm } from '@/features/user-management/role-form'
import { UserForm } from '@/features/user-management/user-form'

type Editor<T> = { mode: 'create' } | { mode: 'edit'; value: T } | null

export function UserManagementPage() {
  const { data: principal } = useSession()
  const permissions =
    principal?.actorType === 'USER' ? principal.permissions : []
  const canViewUsers = permissions.includes('users.view')
  const canManageUsers = permissions.includes('users.manage')
  const canViewRoles = permissions.includes('roles.view')
  const canManageRoles = permissions.includes('roles.manage')
  const users = useUsersQuery(canViewUsers)
  const roles = useRolesQuery(canViewRoles)
  const catalog = usePermissionsQuery(canViewRoles)
  const [userEditor, setUserEditor] = useState<Editor<UserSummary>>(null)
  const [roleEditor, setRoleEditor] = useState<Editor<RoleSummary>>(null)

  if (!canViewUsers && !canViewRoles) {
    return (
      <main className="flex flex-1 p-4 md:p-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
            <CardDescription>
              No tienes permisos para consultar usuarios o roles.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section>
        <p className="text-sm text-muted-foreground">Administración</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Usuarios y roles
        </h1>
      </section>

      {canViewUsers && (
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Usuarios</CardTitle>
                <CardDescription>
                  Miembros del negocio actual y su acceso.
                </CardDescription>
              </div>
              {canManageUsers && canViewRoles && (
                <Button onClick={() => setUserEditor({ mode: 'create' })}>
                  Nuevo usuario
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {userEditor && roles.data && (
              <div className="rounded-lg border bg-muted/20 p-4">
                <h2 className="mb-4 font-medium">
                  {userEditor.mode === 'create'
                    ? 'Crear usuario'
                    : `Editar ${userEditor.value.username}`}
                </h2>
                <UserForm
                  key={
                    userEditor.mode === 'create'
                      ? 'new-user'
                      : userEditor.value.id
                  }
                  roles={roles.data}
                  user={
                    userEditor.mode === 'edit' ? userEditor.value : undefined
                  }
                  onClose={() => setUserEditor(null)}
                />
              </div>
            )}
            <QueryState
              pending={users.isPending}
              error={users.error}
              empty={users.data?.length === 0}
              emptyText="Todavía no hay usuarios."
            />
            {users.data && users.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-2xl text-left text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Usuario</th>
                      <th className="px-3 py-2 font-medium">Rol</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 font-medium">Contacto</th>
                      <th className="px-3 py-2 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.data.map((user) => (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="px-3 py-3">
                          <span className="block font-medium">
                            {user.displayName || user.username}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {user.username}
                          </span>
                        </td>
                        <td className="px-3 py-3">{user.role.name}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={user.status} />
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {user.email || user.phone || '—'}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {canManageUsers && canViewRoles && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setUserEditor({ mode: 'edit', value: user })
                              }
                            >
                              Editar
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canViewRoles && (
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Roles y permisos</CardTitle>
                <CardDescription>
                  Roles del negocio sobre el catálogo global de permisos.
                </CardDescription>
              </div>
              {canManageRoles && (
                <Button onClick={() => setRoleEditor({ mode: 'create' })}>
                  Nuevo rol
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {roleEditor && catalog.data && (
              <div className="rounded-lg border bg-muted/20 p-4">
                <h2 className="mb-4 font-medium">
                  {roleEditor.mode === 'create'
                    ? 'Crear rol'
                    : `Editar ${roleEditor.value.name}`}
                </h2>
                <RoleForm
                  key={
                    roleEditor.mode === 'create'
                      ? 'new-role'
                      : roleEditor.value.id
                  }
                  permissions={catalog.data}
                  role={
                    roleEditor.mode === 'edit' ? roleEditor.value : undefined
                  }
                  onClose={() => setRoleEditor(null)}
                />
              </div>
            )}
            <QueryState
              pending={roles.isPending || catalog.isPending}
              error={roles.error || catalog.error}
              empty={roles.data?.length === 0}
              emptyText="Todavía no hay roles."
            />
            {roles.data && roles.data.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {roles.data.map((role) => (
                  <div key={role.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{role.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {role.active ? 'Activo' : 'Inactivo'} ·{' '}
                          {role.permissions.length} permisos
                        </p>
                      </div>
                      {canManageRoles && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setRoleEditor({ mode: 'edit', value: role })
                          }
                        >
                          Editar
                        </Button>
                      )}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {role.description || 'Sin descripción.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {role.permissions.map((permission) => (
                        <span
                          key={permission.id}
                          className="rounded bg-muted px-2 py-1 text-xs"
                        >
                          {permission.code}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}

function QueryState({ pending, error, empty, emptyText }: { pending: boolean; error: unknown; empty: boolean; emptyText: string }) {
  if (pending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{managementErrorMessage(error)}</p>
  if (empty) return <p className="text-sm text-muted-foreground">{emptyText}</p>
  return null
}

function StatusBadge({ status }: { status: UserSummary['status'] }) {
  const labels = { INVITED: 'Invitado', ACTIVE: 'Activo', SUSPENDED: 'Suspendido', DISABLED: 'Deshabilitado' }
  return <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{labels[status]}</span>
}
