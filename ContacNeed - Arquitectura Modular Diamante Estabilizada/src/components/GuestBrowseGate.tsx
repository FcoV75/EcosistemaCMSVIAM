import { useEffect, useState } from 'react'
import { useIdentity } from '../lib/identity-context'

const GUEST_LIMIT_MS = 5 * 60 * 1000
const GUEST_STORAGE_KEY = 'cn_guest_visit_start'

type GuestBrowseGateProps = {
  onGateOpen: () => void
}

export function GuestBrowseGate({ onGateOpen }: GuestBrowseGateProps) {
  const { user } = useIdentity()
  const [gateOpen, setGateOpen] = useState(false)
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null)

  useEffect(() => {
    if (user) {
      sessionStorage.removeItem(GUEST_STORAGE_KEY)
      setGateOpen(false)
      return
    }

    let start = sessionStorage.getItem(GUEST_STORAGE_KEY)
    if (!start) {
      start = String(Date.now())
      sessionStorage.setItem(GUEST_STORAGE_KEY, start)
    }

    const startTime = Number(start)
    const tick = () => {
      const remaining = GUEST_LIMIT_MS - (Date.now() - startTime)
      if (remaining <= 0) {
        setGateOpen(true)
        setMinutesLeft(0)
        onGateOpen()
        return false
      }
      setMinutesLeft(Math.ceil(remaining / 60000))
      return true
    }

    if (!tick()) return

    const interval = setInterval(() => {
      if (!tick()) clearInterval(interval)
    }, 15000)

    const timer = setTimeout(() => {
      setGateOpen(true)
      setMinutesLeft(0)
      onGateOpen()
    }, GUEST_LIMIT_MS - (Date.now() - startTime))

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [user, onGateOpen])

  if (user || !gateOpen) {
    if (user || minutesLeft === null || minutesLeft <= 0) return null

    return (
      <div className="fixed bottom-24 left-4 z-40 max-w-xs rounded-xl border border-amber-400/30 bg-slate-950/90 px-4 py-3 text-xs text-amber-100 shadow-lg backdrop-blur-sm">
        Explora libremente unos minutos. Regístrate para publicar y seguir sin límites.
        {minutesLeft <= 2 && (
          <span className="mt-1 block font-semibold text-amber-300">
            Quedan ~{minutesLeft} min — después deberás registrarte.
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 top-20 z-[55] mx-auto max-w-lg px-4">
      <div className="rounded-2xl border border-amber-400/40 bg-slate-950/95 px-5 py-4 text-center shadow-2xl">
        <p className="text-sm font-bold text-white">Tu vista previa ha terminado</p>
        <p className="mt-2 text-sm text-purple-200/80">
          Para seguir navegando en ContacNeed, inscríbete gratis o inicia sesión con tu cuenta.
        </p>
      </div>
    </div>
  )
}

export function clearGuestBrowseTimer() {
  sessionStorage.removeItem(GUEST_STORAGE_KEY)
}
