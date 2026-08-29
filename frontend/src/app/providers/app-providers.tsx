import type { PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/api/query-client'
import { TooltipProvider } from '@/components/ui/tooltip'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  )
}
