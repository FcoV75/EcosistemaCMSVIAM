import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ContacNeedLogo } from '../components/ContacNeedLogo'
import { updatePasswordFromResetFn } from '../server/auth.functions'

export const Route = createFileRoute('/auth/reset')({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <div className="cn-metallic-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="cn-glass w-full max-w-md rounded-2xl border border-amber-500/20 p-6">
        <div className="mb-4 flex flex-col items-center text-center">
          <ContacNeedLogo className="mb-2 h-14 w-auto" />
          <h1 className="text-xl font-black text-white">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-purple-200/70">Elige una contraseña segura (mínimo 6 caracteres)</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (password !== confirm) {
              setError('Las contraseñas no coinciden.')
              return
            }
            setLoading(true)
            setError(null)
            try {
              const result = await updatePasswordFromResetFn({ data: { password } })
              setSuccess(result.message)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña')
            } finally {
              setLoading(false)
            }
          }}
        >
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nueva contraseña"
            className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
          />
          <input
            type="password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirmar contraseña"
            className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          {success && <p className="text-sm text-emerald-300">{success}</p>}
          <button
            type="submit"
            disabled={loading || !!success}
            className="cn-btn-metallic w-full rounded-xl py-3 text-sm font-bold disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-amber-300 hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
