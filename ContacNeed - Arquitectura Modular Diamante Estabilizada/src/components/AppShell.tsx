import { Link } from '@tanstack/react-router'
import { LogOut, Mail } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AuthModal, type AuthTab } from './AuthModal'
import { ContacNeedLogo } from './ContacNeedLogo'
import { GuestBrowseGate } from './GuestBrowseGate'
import { HeaderSearchBar } from './HeaderSearchBar'
import { LastSeenPing } from './LastSeenPing'
import { LiveSocialBridge } from './LiveSocialBridge'
import { MemberOnboardingModal } from './MemberOnboardingModal'
import { NotificationsBell } from './NotificationsBell'
import { useOnboardingGuide } from '../lib/onboarding-context'
import { ProAdModal } from './ProAdModal'
import { ProAdPanel } from './ProAdPanel'
import { AmigosEnLinea } from './AmigosEnLinea'
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
  const { user, profile, isAdmin, isPro } = useIdentity()
  const [signingOut, setSigningOut] = useState(false)
  const [showProAdModal, setShowProAdModal] = useState(false)
  const [showMemberOnboarding, setShowMemberOnboarding] = useState(false)
  const [cedulaBannerDismissed, setCedulaBannerDismissed] = useState(false)
  const onboarding = useOnboardingGuide()
  const [authModal, setAuthModal] = useState<{ open: boolean; tab: AuthTab; required: boolean }>({
    open: false,
    tab: 'login',
    required: false,
  })

  useEffect(() => {
    if (user && profile?.needs_onboarding) {
      setShowMemberOnboarding(true)
    } else {
      setShowMemberOnboarding(false)
    }
  }, [user, profile?.needs_onboarding])

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
      <div className="cn-metallic-bg relative min-h-dvh text-white lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden">
        <div
          className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-[0.04]"
          aria-hidden
        >
          <ContacNeedLogo className="h-[min(75vw,32rem)] w-auto max-w-[90vw]" />
        </div>

        <header className="cn-metallic-header sticky top-0 z-40 lg:static lg:shrink-0">
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

        <div className="lg:shrink-0">
          <TopBannerBar selectedState={selectedState} />
        </div>

        <div className="relative mx-auto grid w-full max-w-[90rem] flex-1 grid-cols-1 gap-6 px-4 py-6 lg:min-h-0 lg:grid-cols-12 lg:overflow-hidden lg:px-6">
          <aside className="order-2 space-y-4 lg:order-none lg:col-span-3 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
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
            <AmigosEnLinea />
          </aside>

          <main className="order-1 min-w-0 lg:order-none lg:col-span-6 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:px-1">
            {user && profile?.needs_onboarding && !showMemberOnboarding && (
              <div className="mb-4 rounded-xl border border-amber-400/35 bg-amber-950/40 px-4 py-3 text-sm text-amber-50">
                <p className="font-semibold">Completa cómo quieres participar</p>
                <p className="mt-1 text-amber-100/80">
                  Sin oficio o profesión aún no destacamos tu perfil en búsquedas. Puedes observar la red
                  con normalidad.
                </p>
                <button
                  type="button"
                  onClick={() => setShowMemberOnboarding(true)}
                  className="mt-2 text-xs font-bold text-amber-200 underline hover:text-white"
                >
                  Completar ahora
                </button>
              </div>
            )}
            {user && profile?.needs_cedula_reminder && !cedulaBannerDismissed && !profile?.needs_onboarding && (
              <div className="mb-4 rounded-xl border border-purple-400/30 bg-purple-950/40 px-4 py-3 text-sm text-purple-50">
                <p className="font-semibold">Recordatorio de cédula profesional</p>
                <p className="mt-1 text-purple-100/80">
                  Cuando tengas tu cédula, regístrala en Mi Perfil. Si eres estudiante/pasante, puedes
                  seguir como Oficio hasta entonces.
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <Link
                    to="/profile"
                    className="text-xs font-bold text-amber-200 underline hover:text-white"
                  >
                    Ir a Mi Perfil
                  </Link>
                  <button
                    type="button"
                    onClick={() => setCedulaBannerDismissed(true)}
                    className="text-xs font-semibold text-purple-200/70 hover:text-white"
                  >
                    Ahora no
                  </button>
                </div>
              </div>
            )}
            {children}
          </main>

          <div className="hidden lg:col-span-3 lg:block lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pl-1">
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
        <MemberOnboardingModal
          open={Boolean(user && showMemberOnboarding && profile?.needs_onboarding)}
          forced
          pospuestos={Number(profile?.onboarding_pospuestos || 0)}
          onCompleted={() => {
            setShowMemberOnboarding(false)
            window.location.reload()
          }}
          onPostponed={() => {
            setShowMemberOnboarding(false)
            window.location.reload()
          }}
        />
        <GuestBrowseGate onAskAuth={handleGateOpen} />
        <LastSeenPing />
        <LiveSocialBridge />
      </div>
  )
}
