import { useEffect, useState } from 'react'
import { useIdentity } from '../lib/identity-context'
import { storageGet, storageRemove, storageSet } from '../lib/safe-storage'

const GUEST_LIMIT_MS = 5 * 60 * 1000
/** Si Safari congeló la pestaña mucho rato, no bloqueamos: empezamos visita nueva. */
const GUEST_STALE_MS = 2 * 60 * 60 * 1000
const GUEST_STORAGE_KEY = 'cn_guest_visit_start'
const GUEST_DISMISS_KEY = 'cn_guest_gate_dismissed'

type GuestBrowseGateProps = {
  onAskAuth: () => void
}

export function GuestBrowseGate({ onAskAuth }: GuestBrowseGateProps) {
  const { user } = useIdentity()
  const [gateOpen, setGateOpen] = useState(false)
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null)

  useEffect(() => {
    if (user) {
      storageRemove('session', GUEST_STORAGE_KEY)
      storageRemove('session', GUEST_DISMISS_KEY)
      setGateOpen(false)
      return
    }

    const dismissed = storageGet('session', GUEST_DISMISS_KEY) === '1'
    let start = storageGet('session', GUEST_STORAGE_KEY)
    const startTime = start ? Number(start) : NaN
    const age = Number.isFinite(startTime) ? Date.now() - startTime : 0

    if (!start || !Number.isFinite(startTime) || age > GUEST_STALE_MS) {
      start = String(Date.now())
      storageSet('session', GUEST_STORAGE_KEY, start)
    }

    const origin = Number(start)

    const tick = () => {
      const remaining = GUEST_LIMIT_MS - (Date.now() - origin)
      if (remaining <= 0) {
        setMinutesLeft(0)
        if (!dismissed) setGateOpen(true)
        return false
      }
      setMinutesLeft(Math.ceil(remaining / 60000))
      return true
    }

    if (!tick()) return

    const interval = setInterval(() => {
      if (!tick()) clearInterval(interval)
    }, 15000)

    const wait = Math.max(0, GUEST_LIMIT_MS - (Date.now() - origin))
    const timer = setTimeout(() => {
      if (storageGet('session', GUEST_DISMISS_KEY) === '1') return
      setGateOpen(true)
      setMinutesLeft(0)
    }, wait)

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) tick()
    }
    window.addEventListener('pageshow', onPageShow)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [user])

  const dismiss = () => {
    storageSet('session', GUEST_DISMISS_KEY, '1')
    setGateOpen(false)
  }

  if (user) return null

  if (!gateOpen) {
    if (minutesLeft === null || minutesLeft <= 0) return null
    return (
      <div className="fixed bottom-24 left-4 z-40 max-w-xs rounded-xl border border-amber-400/30 bg-slate-950/90 px-4 py-3 text-xs text-amber-100 shadow-lg">
        Explora libremente. Regístrate para publicar y seguir sin límites.
        {minutesLeft <= 2 && (
          <span className="mt-1 block font-semibold text-amber-300">
            Quedan ~{minutesLeft} min de vista previa — no te sacamos de la pizarra.
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-[55] mx-auto max-w-lg px-4">
      <div className="rounded-2xl border border-amber-400/40 bg-slate-950/95 px-5 py-4 text-center shadow-2xl">
        <p className="text-sm font-bold text-white">¿Quieres seguir con todo el potencial?</p>
        <p className="mt-2 text-sm text-purple-200/80">
          Puedes seguir viendo la pizarra. Inicia sesión o regístrate para publicar, mensajes y tienda.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onAskAuth}
            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950"
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl border border-purple-400/40 px-4 py-2 text-xs font-semibold text-purple-100"
          >
            Seguir viendo
          </button>
        </div>
      </div>
    </div>
  )
}

export function clearGuestBrowseTimer() {
  storageRemove('session', GUEST_STORAGE_KEY)
  storageRemove('session', GUEST_DISMISS_KEY)
}
