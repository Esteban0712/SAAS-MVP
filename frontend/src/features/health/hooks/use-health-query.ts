import { useQuery } from '@tanstack/react-query'

import { getHealth } from '@/features/health/api/get-health'

export function useHealthQuery() {
  return useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: (query) => (query.state.status === 'error' ? 3_000 : 30_000),
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 10_000,
  })
}
