import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { useMemo } from 'react'
import { IdentityProvider } from '../lib/identity-context'
import { UserProvider } from '../store/userContext'
import { createAppQueryClient } from '../lib/query-client'
import { getServerUser } from '../lib/auth'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'ContacNeed | Red Social de Oficios' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
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
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <IdentityProvider user={user}>
            <UserProvider>
              <Outlet />
            </UserProvider>
          </IdentityProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
