import { ContacNeedLogo } from './ContacNeedLogo'
import { ProAdPanel } from './ProAdPanel'
import { RadioPlayer } from './RadioPlayer'
import { SidebarNav } from './SidebarNav'
import { StateSelector } from './StateSelector'
import { SupportBot } from './SupportBot'
import { StripeSubscriptionModal } from './StripeSubscriptionModal'
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
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white">
      <div
        className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-[0.07]"
        aria-hidden
      >
        <ContacNeedLogo className="h-[min(70vw,28rem)] w-[min(70vw,28rem)]" />
      </div>

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(168,85,247,0.15),_transparent_50%)]" />

      <header className="sticky top-0 z-30 border-b border-purple-500/20 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <ContacNeedLogo className="h-10 w-10 shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400">ContacNeed</p>
              <h1 className="text-lg font-black text-white sm:text-xl">La Red Social de Oficios</h1>
            </div>
          </div>
          <p className="hidden text-xs text-purple-200/60 sm:block">México · Profesionales · Servicios</p>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-[90rem] grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-12 lg:px-6">
        <aside className="space-y-4 lg:col-span-3 lg:sticky lg:top-24 lg:self-start">
          <SidebarNav onOpenStripe={onOpenStripe} />
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
