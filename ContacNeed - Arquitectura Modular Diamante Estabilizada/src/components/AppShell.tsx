import { Link } from '@tanstack/react-router'
import { LogOut, Mail } from 'lucide-react'
import { useCallback, useState } from 'react'
import { AuthModal, type AuthTab } from './AuthModal'
import { ContacNeedLogo } from './ContacNeedLogo'
import { GuestBrowseGate } from './GuestBrowseGate'
import { HeaderSearchBar } from './HeaderSearchBar'
import { LastSeenPing } from './LastSeenPing'
import { LiveSocialBridge } from './LiveSocialBridge'
import { NotificationsBell } from './NotificationsBell'
import { useOnboardingGuide } from '../lib/onboarding-context'
import { ProAdModal } from './ProAdModal'
import { ProAdPanel } from './ProAdPanel'
import { RadioLauncher } from './RadioLauncher'
import { SidebarNav } from './SidebarNav'
import { StateSelector } from './StateSelector'
import { SupportBot } from './SupportBot'
import { TopBannerBar } from './TopBannerBar'
import { StripeSubscriptionModal } from './StripeSubscriptionModal'
import { useIdentity } from '../lib/identity-context'
import { signOutFn } from '../server/auth.functions'
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
  const { user, isAdmin, isPro } = useIdentity()
  const [signingOut, setSigningOut] = useState(false)
  const [showProAdModal, setShowProAdModal] = useState(false)
  const onboarding = useOnboardingGuide()
  const [authModal, setAuthModal] = useState<{ open: boolean; tab: AuthTab; required: boolean }>({
    open: false,
    tab: 'login',
    required: false,
  })

  const openAuth = (tab: AuthTab, required = false) => {
    setAuthModal({ open: true, tab, required })
  }

  const handleGateOpen = useCallback(() => {
    openAuth('login', false)
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOutFn()
      window.location.href = '/'
    } catch {
      setSigningOut(false)
      alert('No se pudo cerrar la sesión. Intenta de nuevo.')
    }
  }

  return (
      <div className="cn-metallic-bg relative min-h-dvh text-white">
        <div
          className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-[0.04]"
          aria-hidden
        >
          <ContacNeedLogo className="h-[min(75vw,32rem)] w-auto max-w-[90vw]" />
        </div>

        <header className="cn-metallic-header sticky top-0 z-40">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-3 px-4 py-3 lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link to="/" className="flex min-w-0 shrink-0 items-center gap-3">
                <ContacNeedLogo className="h-11 w-auto max-w-[130px] shrink-0 sm:h-12 sm:max-w-[150px]" />
                <div className="hidden min-w-0 lg:block">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300/90">
                    La Red Social de Oficios
                  </p>
                  <p className="text-xs text-slate-400">México · Profesionales · Servicios</p>
                </div>
              </Link>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {user ? (
                  <>
                    <span className="hidden max-w-[160px] truncate text-xs text-purple-200/70 xl:inline">
                      {user.email}
                    </span>
                    <NotificationsBell />
                    <Link
                      to="/mensajes"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-purple-400/40 bg-purple-900/40 px-3 py-2 text-xs font-semibold text-purple-100 hover:bg-purple-800/50"
                    >
                      <Mail size={14} />
                      Mensajes
                    </Link>
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
                    <a
                      href="https://centromultidisciplinarioags.com/mi-ecosistema"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-amber-400/40 bg-amber-900/30 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-800/40"
                    >
                      Mi Ecosistema CMS
                    </a>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/45 bg-red-900/50 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-800/60 disabled:opacity-50"
                    >
                      <LogOut size={14} />
                      {signingOut ? 'Saliendo...' : 'Cerrar sesión'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openAuth('login')}
                      className="cn-btn-metallic-outline rounded-xl px-4 py-2.5 text-xs font-bold text-amber-100 sm:text-sm"
                    >
                      Iniciar sesión
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuth('register')}
                      className="cn-btn-metallic rounded-xl px-4 py-2.5 text-xs font-bold text-slate-950 sm:text-sm"
                    >
                      Registrarse
                    </button>
                  </>
                )}
              </div>
            </div>

            <HeaderSearchBar selectedState={selectedState} />
          </div>
        </header>

        <TopBannerBar selectedState={selectedState} />

        <div className="relative mx-auto grid max-w-[90rem] grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-12 lg:px-6">
          <aside className="order-2 space-y-4 lg:order-none lg:col-span-3 lg:sticky lg:top-28 lg:self-start">
            <SidebarNav
              onOpenStripe={onOpenStripe}
              onPublishProAd={() => setShowProAdModal(true)}
              onOpenGuide={onboarding.openGuide}
              isPro={isPro}
              isLoggedIn={Boolean(user)}
              onSignOut={user ? handleSignOut : undefined}
              signingOut={signingOut}
              onOpenAuth={openAuth}
            />
            <StateSelector value={selectedState} onChange={onStateChange} variant="sidebar" />
            <RadioLauncher />
          </aside>

          <main className="order-1 min-w-0 lg:order-none lg:col-span-6">{children}</main>

          <div className="hidden lg:col-span-3 lg:block lg:sticky lg:top-28 lg:self-start">
            <ProAdPanel
              selectedState={selectedState}
              onOpenStripe={onOpenStripe}
              onPublishProAd={() => setShowProAdModal(true)}
            />
          </div>
        </div>

        <div className="px-4 pb-8 lg:hidden">
          <ProAdPanel
            selectedState={selectedState}
            onOpenStripe={onOpenStripe}
            onPublishProAd={() => setShowProAdModal(true)}
          />
        </div>

        <SupportBot selectedState={selectedState} />
        <StripeSubscriptionModal
          open={showStripeModal}
          onClose={onCloseStripe}
          onOpenAuth={(tab) => openAuth(tab)}
        />
        <ProAdModal open={showProAdModal} onClose={() => setShowProAdModal(false)} />
        <AuthModal
          open={authModal.open}
          initialTab={authModal.tab}
          required={authModal.required}
          onClose={() => setAuthModal((prev) => ({ ...prev, open: false, required: false }))}
        />
        <GuestBrowseGate onAskAuth={handleGateOpen} />
        <LastSeenPing />
        <LiveSocialBridge />
      </div>
  )
}
