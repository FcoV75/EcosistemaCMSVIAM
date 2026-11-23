import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

/** Señal compacta junto al título de sección PRO. */
export function SectionHelpHint({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1.5 rounded-full p-0.5 text-amber-300/80 transition hover:bg-white/10 hover:text-amber-200"
        aria-label={`Ayuda: ${title}`}
        title={title}
      >
        <HelpCircle size={16} />
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-40 w-64 rounded-xl border border-amber-400/30 bg-slate-950/95 p-3 text-left shadow-xl sm:w-72">
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-amber-200">{title}</p>
            <button type="button" onClick={() => setOpen(false)} className="text-purple-300 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-purple-100/85">{text}</p>
        </div>
      )}
    </span>
  )
}
