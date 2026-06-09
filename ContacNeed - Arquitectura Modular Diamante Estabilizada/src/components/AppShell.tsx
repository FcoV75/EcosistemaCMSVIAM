import { Link } from '@tanstack/react-router'
import { Crown, Shield } from 'lucide-react'
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
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-amber-50">
      <header className="sticky top-0 z-30 border-b border-purple-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-700">ContacNeed</p>
              <h1 className="text-2xl font-black text-slate-900">La Red Social de Oficios</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenStripe}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-600"
              >
                <Crown size={16} />
                Subir de nivel
              </button>
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 rounded-xl border border-purple-200 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50"
              >
                <Shield size={16} />
                Admin
              </Link>
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-gray-50"
              >
                Mi Perfil
              </Link>
            </div>
          </div>

          <StateSelector value={selectedState} onChange={onStateChange} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <SupportBot />
      <StripeSubscriptionModal open={showStripeModal} onClose={onCloseStripe} />
    </div>
  )
}
