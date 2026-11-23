import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ContacNeedLogo } from '../../components/ContacNeedLogo'
import { clearGuestBrowseTimer } from '../../components/GuestBrowseGate'
import { completeOAuthCallbackFn } from '../../server/auth.functions'

export const Route = createFileRoute('/auth/callback')({
  component: OAuthCallbackPage,
})

function OAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const search = `${window.location.search || ''}${window.location.hash || ''}`
        await completeOAuthCallbackFn({ data: search })
        if (cancelled) return
        clearGuestBrowseTimer()
        const params = new URLSearchParams(window.location.search)
        const nextRaw = params.get('next') || '/'
        const next = nextRaw.startsWith('/') ? nextRaw : '/'
        window.location.replace(next)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'No se pudo completar el acceso con Google')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="cn-metallic-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="cn-glass w-full max-w-md rounded-2xl border border-amber-500/20 p-6 text-center shadow-2xl">
        <ContacNeedLogo className="mx-auto mb-4 h-14 w-auto max-w-[180px]" />
        {error ? (
          <>
            <h1 className="text-lg font-black text-white">No se pudo entrar con Google</h1>
            <p className="mt-3 rounded-xl border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
            <Link
              to="/login"
              className="mt-4 inline-block text-sm font-semibold text-amber-300 hover:text-amber-200"
            >
              Volver a iniciar sesión
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-black text-white">Conectando con Google…</h1>
            <p className="mt-2 text-sm text-purple-200/70">Un momento, estamos abriendo tu sesión.</p>
          </>
        )}
      </div>
    </div>
  )
}
