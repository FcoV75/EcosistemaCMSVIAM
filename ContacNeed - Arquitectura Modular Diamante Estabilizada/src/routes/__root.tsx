import { createRootRoute, Outlet } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { useMemo } from 'react'
import { IdentityProvider } from '../lib/identity-context'
import { UserProvider } from '../store/userContext'
import { createAppQueryClient } from '../lib/query-client'
import { getServerUser } from '../lib/auth'

export const Route = createRootRoute({
  beforeLoad: async () => {
    const user = await getServerUser()
    return {
      user: user
        ? {
            id: user.id,
            email: user.email,
          }
        : null,
    }
  },
  component: RootLayout,
})

function RootLayout() {
  const queryClient = useMemo(() => createAppQueryClient(), [])
  const { user } = Route.useRouteContext()

  return (
    <QueryClientProvider client={queryClient}>
      <IdentityProvider user={user}>
        <UserProvider>
          <Outlet />
        </UserProvider>
      </IdentityProvider>
    </QueryClientProvider>
  )
}
