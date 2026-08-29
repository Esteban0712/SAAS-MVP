import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { logout } from './auth.api'
import { sessionQueryKey } from './use-session'

export function LogoutButton() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.setQueryData(sessionQueryKey, undefined)
      await queryClient.invalidateQueries()
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  })

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Cerrar sesión"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <LogOut />
    </Button>
  )
}
