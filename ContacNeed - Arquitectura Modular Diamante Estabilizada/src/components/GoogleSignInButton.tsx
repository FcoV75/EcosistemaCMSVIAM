import { useState } from 'react'
import { getGoogleOAuthUrlFn } from '../server/auth.functions'

type GoogleSignInButtonProps = {
  label?: string
  next?: string
  className?: string
}

export function GoogleSignInButton({
  label = 'Continuar con Google',
  next = '/',
  className = '',
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true)
          setError(null)
          try {
            const { url } = await getGoogleOAuthUrlFn({ data: { next } })
            window.location.href = url
          } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo abrir Google')
            setLoading(false)
          }
        }}
        className={`inline-flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 ${className}`}
      >
        <GoogleGlyph />
        {loading ? 'Conectando con Google…' : label}
      </button>
      <p className="text-center text-[11px] text-purple-200/55">
        Usamos Google solo para entrar. Tu oficio o profesión lo defines tú después.
      </p>
      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.4 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 37.1 44 32.5 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  )
}
