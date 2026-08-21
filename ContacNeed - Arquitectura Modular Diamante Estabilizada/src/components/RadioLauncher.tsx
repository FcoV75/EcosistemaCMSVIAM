import { ExternalLink, Radio } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isAppleTouchDevice } from '../lib/device'
import { focusRadioPopup, isRadioPopupOpen, openRadioPopup } from '../lib/radio-popup'

export function RadioLauncher() {
  const [popupOpen, setPopupOpen] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    setIos(isAppleTouchDevice())
    const sync = () => setPopupOpen(isRadioPopupOpen())
    sync()
    const timer = window.setInterval(sync, 800)
    return () => window.clearInterval(timer)
  }, [])

  const handleOpen = () => {
    const opened = openRadioPopup()
    if (!opened) {
      alert(
        'Safari en iPhone a veces bloquea ventanas. Usa el enlace “Abrir radio” o permite ventanas emergentes; no te sacamos de la pizarra.',
      )
      return
    }
    setPopupOpen(true)
  }

  const handleFocus = () => {
    if (!focusRadioPopup()) {
      setPopupOpen(false)
    }
  }

  return (
    <div className="cn-glass rounded-2xl border border-purple-500/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-amber-500 text-white shadow-lg shadow-purple-900/30">
          <Radio size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Radio IA VIAM</p>
          <p className="text-[11px] text-purple-200/70">Ventana independiente · sin cortes</p>
        </div>
        {popupOpen && <span className="cn-pulse-dot shrink-0" aria-hidden />}
      </div>

      <p className="mb-3 text-[11px] leading-relaxed text-purple-100/80">
        {ios
          ? 'En iPhone la radio se abre en otra pestaña para no sacarte de la pizarra. Vuelve aquí con el botón Atrás cuando quieras.'
          : 'Abre la radio en una ventana pequeña aparte. Navega libremente por ContacNeed: el volumen, la estación y la reproducción no se interrumpen. Cierra la ventana para apagar.'}
      </p>

      {popupOpen ? (
        <button
          type="button"
          onClick={handleFocus}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-900/30 px-3 py-2.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-800/40"
        >
          <ExternalLink size={14} />
          Radio abierta · traer al frente
        </button>
      ) : ios ? (
        <a
          href="/radio"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-900/30 transition hover:brightness-110"
        >
          <ExternalLink size={14} />
          Abrir radio en otra pestaña
        </a>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-900/30 transition hover:brightness-110"
        >
          <ExternalLink size={14} />
          Abrir radio en ventana
        </button>
      )}
    </div>
  )
}
