import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ContacNeedLogo } from '../components/ContacNeedLogo'
import { RegistroForm } from '../components/RegistroForm'

export const Route = createFileRoute('/registro')({
  component: RegistroPage,
})

function RegistroPage() {
  const navigate = useNavigate()
  const [done, setDone] = useState(false)

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
          {done ? (
            <div className="space-y-4 text-center">
              <p className="text-emerald-200">¡Cuenta creada! Ya puedes iniciar sesión.</p>
              <Link to="/login" className="cn-btn-metallic inline-block rounded-xl px-6 py-3 text-sm font-bold text-slate-950">
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
            <RegistroForm
              onSuccess={() => setDone(true)}
              onSwitchToLogin={() => navigate({ to: '/login' })}
            />
          )}
        </div>

        <Link to="/" className="mt-4 block text-center text-xs text-purple-300/60 hover:text-white">
          ← Volver a la pizarra
        </Link>
      </div>
    </div>
  )
}
