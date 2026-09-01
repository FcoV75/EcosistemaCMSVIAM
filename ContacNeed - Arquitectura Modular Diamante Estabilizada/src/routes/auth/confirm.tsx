import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ContacNeedLogo } from '../../components/ContacNeedLogo'
import { clearGuestBrowseTimer } from '../../components/GuestBrowseGate'
import {
  confirmEmailFromLinkFn,
  resendSignupConfirmFn,
} from '../../server/auth.functions'

export const Route = createFileRoute('/auth/confirm')({
  component: ConfirmEmailPage,
})

function parseLinkParams() {
  const raw = `${window.location.search || ''}${window.location.hash || ''}`
  const normalized = raw.replace(/^\?/, '').replace(/#/, '&').replace(/^&/, '')
  return new URLSearchParams(normalized)
}

function friendlyLinkError(params: URLSearchParams) {
  const code = (params.get('error_code') || params.get('error') || '').toLowerCase()
  const description = (params.get('error_description') || '').replace(/\+/g, ' ')
  if (
    code.includes('otp_expired') ||
    description.toLowerCase().includes('invalid or has expired') ||
    description.toLowerCase().includes('expired')
  ) {
    return 'Este enlace ya expiró o se usó (a veces un filtro antispam lo abre antes que tú). Pide uno nuevo abajo.'
  }
  if (code || description) {
    return description || 'No se pudo validar el enlace. Pide uno nuevo abajo.'
  }
  return null
}

function hasConfirmPayload(params: URLSearchParams) {
  if (params.get('error') || params.get('error_code')) return false
  return Boolean(
    params.get('code') ||
      (params.get('token_hash') && params.get('type')) ||
      (params.get('access_token') && params.get('refresh_token')),
  )
}

function ConfirmEmailPage() {
  const initial = useMemo(() => {
    if (typeof window === 'undefined') {
      return { status: 'loading' as const, message: 'Validando tu correo...', canConfirm: false }
    }
    const params = parseLinkParams()
    const err = friendlyLinkError(params)
    if (err) {
      return { status: 'error' as const, message: err, canConfirm: false }
    }
    if (hasConfirmPayload(params)) {
      return {
        status: 'ready' as const,
        message: 'Pulsa el botón para activar tu cuenta. Así evitamos que un filtro de correo gaste el enlace solo.',
        canConfirm: true,
      }
    }
    return {
      status: 'error' as const,
      message: 'No encontramos un enlace válido en esta página. Pide uno nuevo con tu correo.',
      canConfirm: false,
    }
  }, [])

  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>(initial.status)
  const [message, setMessage] = useState(initial.message)
  const [confirming, setConfirming] = useState(false)
  const [email, setEmail] = useState('')
  const [resendMsg, setResendMsg] = useState<string | null>(null)
  const [resendLoading, setResendLoading] = useState(false)

  async function confirmNow() {
    setConfirming(true)
    setStatus('loading')
    setMessage('Confirmando tu correo...')
    setResendMsg(null)
    try {
      const linkPayload = `${window.location.search}${window.location.hash || ''}`
      await confirmEmailFromLinkFn({ data: linkPayload })
      clearGuestBrowseTimer()
      setStatus('success')
      setMessage('Correo confirmado. Ya puedes usar ContacNeed con tu cuenta.')
      if (window.location.hash || window.location.search) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'No se pudo confirmar el correo.')
    } finally {
      setConfirming(false)
    }
  }

  async function resendLink() {
    setResendLoading(true)
    setResendMsg(null)
    try {
      const result = await resendSignupConfirmFn({ data: { email } })
      setResendMsg(result.message)
    } catch (error) {
      setResendMsg(error instanceof Error ? error.message : 'No se pudo reenviar el correo.')
    } finally {
      setResendLoading(false)
    }
  }

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

        {status === 'ready' && (
          <button
            type="button"
            disabled={confirming}
            onClick={() => void confirmNow()}
            className="cn-btn-metallic mt-6 w-full rounded-xl px-6 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            {confirming ? 'Confirmando...' : 'Confirmar mi correo'}
          </button>
        )}

        {status === 'success' && (
          <Link
            to="/"
            className="cn-btn-metallic mt-6 inline-block rounded-xl px-6 py-3 text-sm font-bold text-slate-950"
          >
            Ir a la pizarra
          </Link>
        )}

        {(status === 'error' || status === 'ready') && (
          <div className="mt-6 space-y-3 text-left">
            <p className="text-xs text-purple-200/70">
              ¿El enlace falló o expiró? Escribe el mismo correo del registro y te mandamos uno nuevo.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block text-purple-200/80">Correo electrónico</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
                placeholder="tu@correo.com"
              />
            </label>
            <button
              type="button"
              disabled={resendLoading || !email.trim()}
              onClick={() => void resendLink()}
              className="w-full rounded-xl border border-amber-400/40 px-4 py-2.5 text-sm font-semibold text-amber-100 disabled:opacity-50"
            >
              {resendLoading ? 'Enviando...' : 'Reenviar correo de confirmación'}
            </button>
            {resendMsg && (
              <p className="rounded-xl border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
                {resendMsg}
              </p>
            )}
            <p className="text-center text-sm text-purple-200/70">
              <Link to="/login" className="font-semibold text-amber-300 hover:text-amber-200">
                Ir a iniciar sesión
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
