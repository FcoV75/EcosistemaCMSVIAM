import { QueryClient } from '@tanstack/react-query'

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchInterval: false,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
      },
    },
  })
}
