import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ContacNeedLogo } from '../components/ContacNeedLogo'
import { clearGuestBrowseTimer } from '../components/GuestBrowseGate'
import { signInFn } from '../server/auth.functions'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <div className="cn-metallic-bg relative flex min-h-screen items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.08]"
        aria-hidden
      >
        <ContacNeedLogo className="h-[min(80vw,24rem)] w-auto" />
      </div>

      <div className="cn-glass relative w-full max-w-md rounded-2xl border border-amber-500/20 p-6 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <ContacNeedLogo className="mb-3 h-16 w-auto max-w-[200px]" />
          <h1 className="text-xl font-black text-white">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-purple-200/70">Accede a tu cuenta ContacNeed</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            setLoading(true)
            setError(null)
            try {
              await signInFn({ data: { email, password } })
              clearGuestBrowseTimer()
              window.location.href = '/'
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
            } finally {
              setLoading(false)
            }
          }}
        >
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
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-purple-200/70">
          ¿Eres nuevo?{' '}
          <Link to="/registro" className="font-semibold text-amber-300 hover:text-amber-200">
            Regístrate aquí
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-purple-300/50">
          ¿Eres administrador? Usa tus mismas credenciales y entra; si tienes permisos verás el Panel Admin.
        </p>

        <Link to="/" className="mt-4 block text-center text-xs text-purple-300/60 hover:text-white">
          ← Volver a la pizarra
        </Link>
      </div>
    </div>
  )
}
