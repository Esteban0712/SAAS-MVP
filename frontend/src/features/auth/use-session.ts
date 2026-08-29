import { useQuery } from '@tanstack/react-query'
import { getMe } from './auth.api'

export const sessionQueryKey = ['auth', 'session'] as const

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: getMe,
    retry: false,
  })
}
