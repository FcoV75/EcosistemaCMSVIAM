import { createFileRoute, Link } from '@tanstack/react-router'
import { ContacNeedLogo } from '../components/ContacNeedLogo'
import { clearGuestBrowseTimer } from '../components/GuestBrowseGate'
import { RegistroForm } from '../components/RegistroForm'

export const Route = createFileRoute('/registro')({
  component: RegistroPage,
})

function RegistroPage() {
  return (
    <div className="cn-metallic-bg relative min-h-screen px-4 py-10">
      <div
        className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-[0.08]"
        aria-hidden
      >
        <ContacNeedLogo className="h-[min(85vw,28rem)] w-auto" />
      </div>

      <div className="relative mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <ContacNeedLogo className="mx-auto mb-3 h-20 w-auto max-w-[240px]" />
          <h1 className="text-2xl font-black text-white">Únete a ContacNeed</h1>
          <p className="text-sm text-purple-200/70">Registro de miembros · Oficios · Profesiones · Especialidades</p>
        </div>

        <div className="cn-glass rounded-2xl border border-amber-500/20 p-6">
          <RegistroForm
            onSuccess={() => {
              clearGuestBrowseTimer()
              window.location.href = '/'
            }}
            onSwitchToLogin={() => {
              window.location.href = '/login'
            }}
          />
        </div>

        <Link to="/" className="mt-4 block text-center text-xs text-purple-300/60 hover:text-white">
          ← Volver a la pizarra
        </Link>
      </div>
    </div>
  )
}
