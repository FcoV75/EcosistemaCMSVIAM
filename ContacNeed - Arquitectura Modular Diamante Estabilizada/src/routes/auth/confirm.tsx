import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ContacNeedLogo } from '../../components/ContacNeedLogo'
import { clearGuestBrowseTimer } from '../../components/GuestBrowseGate'
import { confirmEmailFromLinkFn } from '../../server/auth.functions'

export const Route = createFileRoute('/auth/confirm')({
  component: ConfirmEmailPage,
})

function ConfirmEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Validando tu correo...')

  useEffect(() => {
    let active = true

    confirmEmailFromLinkFn({ data: window.location.search })
      .then(() => {
        if (!active) return
        clearGuestBrowseTimer()
        setStatus('success')
        setMessage('Correo confirmado. Ya puedes usar ContacNeed con tu cuenta.')
      })
      .catch((error) => {
        if (!active) return
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'No se pudo confirmar el correo.')
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="cn-metallic-bg relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="cn-glass relative w-full max-w-md rounded-2xl border border-amber-500/20 p-6 text-center shadow-2xl">
        <ContacNeedLogo className="mx-auto mb-4 h-16 w-auto max-w-[200px]" />
        <h1 className="text-xl font-black text-white">Confirmación de correo</h1>
        <p
          className={`mt-4 text-sm ${
            status === 'success'
              ? 'text-emerald-200'
              : status === 'error'
                ? 'text-red-200'
                : 'text-purple-200/80'
          }`}
        >
          {message}
        </p>

        {status !== 'loading' && (
          <Link
            to={status === 'success' ? '/' : '/login'}
            className="cn-btn-metallic mt-6 inline-block rounded-xl px-6 py-3 text-sm font-bold text-slate-950"
          >
            {status === 'success' ? 'Ir a la pizarra' : 'Ir a iniciar sesión'}
          </Link>
        )}
      </div>
    </div>
  )
}
