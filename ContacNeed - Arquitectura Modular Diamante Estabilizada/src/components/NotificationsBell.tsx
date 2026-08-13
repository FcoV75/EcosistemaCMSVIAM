import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  getNotificacionesFn,
  markNotificacionReadFn,
} from '../server/notificaciones.functions'

export function NotificationsBell() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const notifQuery = useQuery({
    queryKey: ['notificaciones'],
    queryFn: () => getNotificacionesFn(),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  })

  const markMutation = useMutation({
    mutationFn: (payload: { id?: string; all?: boolean }) =>
      markNotificacionReadFn({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  })

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const unread = notifQuery.data?.unread ?? 0
  const items = notifQuery.data?.items ?? []

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center gap-1.5 rounded-xl border border-purple-400/40 bg-purple-900/40 px-3 py-2 text-xs font-semibold text-purple-100 hover:bg-purple-800/50"
        aria-label="Notificaciones"
      >
        <Bell size={14} />
        <span className="hidden sm:inline">Avisos</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-amber-500 px-1 text-center text-[10px] font-black text-slate-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-purple-500/30 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-purple-500/20 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-200">Notificaciones</p>
            {unread > 0 && (
              <button
                type="button"
                className="text-[11px] font-semibold text-purple-200 hover:text-white"
                onClick={() => markMutation.mutate({ all: true })}
              >
                Marcar todas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-purple-200/60">
                Sin avisos por ahora.
              </p>
            )}
            {items.map((item) => (
              <Link
                key={item.id}
                to="/mensajes"
                className={`block border-b border-purple-500/10 px-3 py-3 transition hover:bg-white/5 ${
                  item.leida ? 'opacity-70' : 'bg-amber-500/5'
                }`}
                onClick={() => {
                  if (!item.leida) markMutation.mutate({ id: item.id })
                  setOpen(false)
                }}
              >
                <p className="text-sm font-semibold text-white">{item.titulo}</p>
                {item.cuerpo && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-purple-100/75">{item.cuerpo}</p>
                )}
                <p className="mt-1 text-[10px] text-purple-300/50">
                  {new Date(item.created_at).toLocaleString('es-MX')}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
