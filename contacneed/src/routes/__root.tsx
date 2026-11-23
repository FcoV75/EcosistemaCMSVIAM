import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { useMemo } from 'react'
import { BrowseProvider } from '../lib/browse-context'
import { IdentityProvider } from '../lib/identity-context'
import { OnboardingProvider } from '../lib/onboarding-context'
import { UserProvider } from '../store/userContext'
import { createAppQueryClient } from '../lib/query-client'
import { RootErrorBoundary, StayOnBoardFallback } from '../components/RootErrorBoundary'
import { getSessionContextFn } from '../server/auth.functions'
import appCss from '../styles.css?url'

function RootRouteError() {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>ContacNeed</title>
      </head>
      <body style={{ margin: 0, background: '#1e1b4b' }}>
        <StayOnBoardFallback onRetry={() => window.location.assign('/')} />
        <Scripts />
      </body>
    </html>
  )
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'ContacNeed | Red Social de Oficios' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  beforeLoad: async () => getSessionContextFn(),
  errorComponent: RootRouteError,
  component: RootLayout,
})

function RootLayout() {
  const queryClient = useMemo(() => createAppQueryClient(), [])
  const { user, profile, isAdmin } = Route.useRouteContext()

  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <RootErrorBoundary>
          <IdentityProvider user={user} profile={profile} isAdmin={isAdmin}>
            <OnboardingProvider>
              <UserProvider>
                <BrowseProvider>
                  <Outlet />
                </BrowseProvider>
              </UserProvider>
            </OnboardingProvider>
          </IdentityProvider>
          </RootErrorBoundary>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
