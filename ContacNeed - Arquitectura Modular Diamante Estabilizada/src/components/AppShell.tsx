import { Link } from '@tanstack/react-router'
import { ContacNeedLogo } from './ContacNeedLogo'
import { ProAdPanel } from './ProAdPanel'
import { RadioPlayer } from './RadioPlayer'
import { SidebarNav } from './SidebarNav'
import { StateSelector } from './StateSelector'
import { SupportBot } from './SupportBot'
import { StripeSubscriptionModal } from './StripeSubscriptionModal'
import { useIdentity } from '../lib/identity-context'
import type { MexicoState } from '../lib/mexico-states'

type AppShellProps = {
  children: React.ReactNode
  selectedState: MexicoState | ''
  onStateChange: (state: MexicoState | '') => void
  showStripeModal: boolean
  onOpenStripe: () => void
  onCloseStripe: () => void
}

export function AppShell({
  children,
  selectedState,
  onStateChange,
  showStripeModal,
  onOpenStripe,
  onCloseStripe,
}: AppShellProps) {
  const { user, isAdmin } = useIdentity()

  return (
    <div className="cn-metallic-bg relative min-h-screen overflow-x-hidden text-white">
      <div
        className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-[0.04]"
        aria-hidden
      >
        <ContacNeedLogo className="h-[min(75vw,32rem)] w-auto max-w-[90vw]" />
      </div>

      <header className="cn-metallic-header sticky top-0 z-30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <ContacNeedLogo className="h-11 w-auto max-w-[130px] shrink-0 sm:h-12 sm:max-w-[150px]" />
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300/90">
                La Red Social de Oficios
              </p>
              <p className="text-xs text-slate-400">México · Profesionales · Servicios</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="cn-btn-metallic-outline rounded-xl px-3 py-2 text-xs font-semibold text-amber-100 hover:text-white"
                >
                  Mi Perfil
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="rounded-xl border border-purple-400/40 bg-purple-900/40 px-3 py-2 text-xs font-semibold text-purple-100 hover:bg-purple-800/50"
                  >
                    Panel Admin
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="cn-btn-metallic-outline rounded-xl px-3 py-2 text-xs font-semibold text-amber-100"
                >
                  Iniciar sesión
                </Link>
                <Link to="/registro" className="cn-btn-metallic rounded-xl px-3 py-2 text-xs font-bold text-slate-950">
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-[90rem] grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-12 lg:px-6">
        <aside className="space-y-4 lg:col-span-3 lg:sticky lg:top-24 lg:self-start">
          <SidebarNav onOpenStripe={onOpenStripe} isLoggedIn={Boolean(user)} />
          <StateSelector value={selectedState} onChange={onStateChange} variant="sidebar" />
          <RadioPlayer />
        </aside>

        <main className="min-w-0 lg:col-span-6">{children}</main>

        <div className="hidden lg:col-span-3 lg:block lg:sticky lg:top-24 lg:self-start">
          <ProAdPanel onOpenStripe={onOpenStripe} />
        </div>
      </div>

      <div className="px-4 pb-8 lg:hidden">
        <ProAdPanel onOpenStripe={onOpenStripe} />
      </div>

      <SupportBot />
      <StripeSubscriptionModal open={showStripeModal} onClose={onCloseStripe} />
    </div>
  )
}
