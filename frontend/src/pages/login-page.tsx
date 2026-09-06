import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { loginPlatform, loginTenant } from '@/features/auth/auth.api'
import type { AuthenticatedPrincipal } from '@/features/auth/auth.types'
import { sessionQueryKey, useSession } from '@/features/auth/use-session'

const loginSchema = z
  .object({
    mode: z.enum(['tenant', 'platform']),
    businessSlug: z.string(),
    username: z.string().min(1, 'Introduce tu usuario.'),
    password: z.string().min(1, 'Introduce tu contraseña.'),
  })
  .superRefine((value, context) => {
    if (value.mode === 'tenant' && !value.businessSlug.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['businessSlug'],
        message: 'Introduce el identificador del negocio.',
      })
    }
  })

type LoginForm = z.infer<typeof loginSchema>

function destination(principal: AuthenticatedPrincipal): string {
  return principal.actorType === 'PLATFORM' ? '/platform' : '/app'
}

export function LoginPage() {
  const session = useSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<LoginForm['mode']>('tenant')
  const form = useForm<LoginForm>({
    defaultValues: {
      mode: 'tenant',
      businessSlug: '',
      username: '',
      password: '',
    },
  })
  const mutation = useMutation({
    mutationFn: async (values: LoginForm) =>
      values.mode === 'tenant'
        ? loginTenant({
            businessSlug: values.businessSlug.trim(),
            username: values.username.trim(),
            password: values.password,
          })
        : loginPlatform({
            username: values.username.trim(),
            password: values.password,
          }),
    onSuccess: (principal) => {
      // Never carry cached data across tenant/platform identities.
      queryClient.clear()
      queryClient.setQueryData(sessionQueryKey, principal)
      const requested = (location.state as { from?: string } | null)?.from
      const safeRequested =
        principal.actorType === 'PLATFORM'
          ? requested?.startsWith('/platform')
          : requested?.startsWith('/app') || requested?.startsWith('/employee')
      navigate(safeRequested && requested ? requested : destination(principal), {
        replace: true,
      })
    },
  })

  const changeMode = (nextMode: LoginForm['mode']) => {
    setMode(nextMode)
    form.setValue('mode', nextMode)
    mutation.reset()
    form.clearErrors()
  }

  if (session.data) {
    return <Navigate to={destination(session.data)} replace />
  }

  const submit = form.handleSubmit(async (values) => {
    const result = loginSchema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (
          field === 'businessSlug' ||
          field === 'username' ||
          field === 'password'
        ) {
          form.setError(field, { message: issue.message })
        }
      }
      return
    }
    await mutation.mutateAsync(result.data).catch(() => undefined)
  })

  const errorMessage =
    mutation.error instanceof ApiError && mutation.error.status === 401
      ? 'Credenciales incorrectas.'
      : mutation.error
        ? 'No se pudo iniciar sesión. Inténtalo de nuevo.'
        : null

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardDescription>Deenova MVP</CardDescription>
          <CardTitle className="text-2xl">Acceso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1">
            <Button type="button" variant={mode === 'tenant' ? 'secondary' : 'ghost'} onClick={() => changeMode('tenant')}>
              Negocio
            </Button>
            <Button type="button" variant={mode === 'platform' ? 'secondary' : 'ghost'} onClick={() => changeMode('platform')}>
              Plataforma
            </Button>
          </div>

          <form className="space-y-4" onSubmit={submit} noValidate>
            {mode === 'tenant' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="businessSlug">Identificador del negocio</label>
                <Input id="businessSlug" autoComplete="organization" aria-invalid={Boolean(form.formState.errors.businessSlug)} {...form.register('businessSlug')} />
                <p className="text-xs text-destructive">{form.formState.errors.businessSlug?.message}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="username">Usuario</label>
              <Input id="username" autoComplete="username" aria-invalid={Boolean(form.formState.errors.username)} {...form.register('username')} />
              <p className="text-xs text-destructive">{form.formState.errors.username?.message}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="password">Contraseña</label>
              <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(form.formState.errors.password)} {...form.register('password')} />
              <p className="text-xs text-destructive">{form.formState.errors.password?.message}</p>
            </div>
            {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? 'Accediendo…' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
