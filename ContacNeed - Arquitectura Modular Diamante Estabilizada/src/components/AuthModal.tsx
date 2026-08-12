import { Shield, UserPlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ContacNeedLogo } from './ContacNeedLogo'
import { RegistroForm } from './RegistroForm'
import { requestPasswordResetFn, signInFn } from '../server/auth.functions'

export type AuthTab = 'login' | 'register' | 'admin'

type AuthModalProps = {
  open: boolean
  onClose: () => void
  initialTab?: AuthTab
  required?: boolean
}

import { clearGuestBrowseTimer } from './GuestBrowseGate'

export function AuthModal({ open, onClose, initialTab = 'login', required = false }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>(initialTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [registerDone, setRegisterDone] = useState(false)

  useEffect(() => {
    if (open) {
      setTab(initialTab)
      setError(null)
      setResetMsg(null)
      setRegisterDone(false)
    }
  }, [open, initialTab])

  if (!open) return null

  const handleClose = () => {
    if (required) return
    onClose()
  }

  const handleLogin = async (redirectAdmin: boolean) => {
    setLoading(true)
    setError(null)
    try {
      await signInFn({ data: { email: email.trim(), password } })
      clearGuestBrowseTimer()
      if (redirectAdmin) {
        window.location.href = '/admin'
        return
      }
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
      setLoading(false)
    }
  }

  const titles: Record<AuthTab, string> = {
    login: 'Iniciar sesión',
    register: 'Crear cuenta',
    admin: 'Acceso administrador',
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className={`cn-glass relative flex w-full flex-col rounded-2xl border border-amber-500/25 shadow-2xl ${
          tab === 'register' ? 'max-h-[92vh] max-w-2xl' : 'max-w-md'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-amber-500/15 px-5 py-4">
          <div className="flex items-center gap-3">
            <ContacNeedLogo className="h-10 w-auto max-w-[120px]" />
            <div>
              <h2 className="text-lg font-black text-white">{titles[tab]}</h2>
              <p className="text-xs text-purple-200/60">ContacNeed · Red de oficios</p>
            </div>
          </div>
          {!required && (
            <button
              type="button"
              onClick={handleClose}
              aria-label="Cerrar"
              className="rounded-lg p-1 text-purple-200 hover:bg-white/10"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {tab !== 'admin' && (
          <div className="flex shrink-0 gap-1 border-b border-purple-500/15 px-5 pt-3">
            <TabButton active={tab === 'login'} onClick={() => setTab('login')}>
              Entrar
            </TabButton>
            <TabButton active={tab === 'register'} onClick={() => setTab('register')}>
              <UserPlus size={14} className="inline mr-1" />
              Registrarse
            </TabButton>
          </div>
        )}

        <div className="overflow-y-auto px-5 py-5">
          {tab === 'register' ? (
            registerDone ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-emerald-200">
                  ¡Cuenta creada! Revisa tu correo si se requiere confirmación e inicia sesión.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRegisterDone(false)
                    setTab('login')
                  }}
                  className="cn-btn-metallic w-full rounded-xl py-3 text-sm font-bold text-slate-950"
                >
                  Ir a iniciar sesión
                </button>
              </div>
            ) : (
              <RegistroForm
                compact
                onSuccess={() => setRegisterDone(true)}
                onSwitchToLogin={() => setTab('login')}
              />
            )
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                handleLogin(tab === 'admin')
              }}
            >
              {tab === 'admin' && (
                <p className="rounded-xl border border-purple-400/30 bg-purple-950/40 px-3 py-2 text-xs text-purple-100">
                  Solo personal autorizado. Tras entrar, irás al Panel Admin si tu cuenta tiene permisos.
                </p>
              )}

              <label className="block text-sm">
                <span className="mb-1 block text-purple-200/80">Correo electrónico</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-purple-200/80">Contraseña</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
                />
              </label>

              {error && (
                <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="cn-btn-metallic w-full rounded-xl py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                {loading ? 'Entrando...' : tab === 'admin' ? 'Entrar al Panel Admin' : 'Entrar'}
              </button>

              {(tab === 'login' || tab === 'admin') && (
                <p className="text-center text-sm text-purple-200/70">
                  <button
                    type="button"
                    className="font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-50"
                    disabled={resetLoading || !email.trim()}
                    onClick={async () => {
                      setResetLoading(true)
                      setResetMsg(null)
                      setError(null)
                      try {
                        const r = await requestPasswordResetFn({ data: { email: email.trim() } })
                        setResetMsg(r.message)
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'No se pudo enviar el enlace')
                      } finally {
                        setResetLoading(false)
                      }
                    }}
                  >
                    {resetLoading ? 'Enviando enlace...' : '¿Olvidaste tu contraseña?'}
                  </button>
                </p>
              )}

              {resetMsg && (
                <p className="rounded-xl border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-center text-sm text-emerald-200">
                  {resetMsg}
                </p>
              )}

              {tab === 'login' && (
                <p className="text-center text-xs text-purple-300/50">
                  <button
                    type="button"
                    onClick={() => setTab('admin')}
                    className="inline-flex items-center gap-1 text-purple-300/70 hover:text-amber-300"
                  >
                    <Shield size={12} />
                    Acceso administrador
                  </button>
                </p>
              )}

              {tab === 'admin' && (
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="w-full text-center text-xs text-purple-300/60 hover:text-white"
                >
                  ← Volver a inicio de sesión de usuario
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'border-b-2 border-amber-400 text-amber-200'
          : 'text-purple-300/60 hover:text-purple-100'
      }`}
    >
      {children}
    </button>
  )
}
