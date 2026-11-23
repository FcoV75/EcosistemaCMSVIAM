import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Circle, MessageCircle } from 'lucide-react'
import { useIdentity } from '../lib/identity-context'
import { getAmigosEnLineaFn } from '../server/social.functions'

export function AmigosEnLinea() {
  const { user, isPro } = useIdentity()
  const query = useQuery({
    queryKey: ['amigos-en-linea', user?.id],
    queryFn: () => getAmigosEnLineaFn(),
    enabled: Boolean(user),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  })

  const amigos = query.data?.amigos ?? []

  return (
    <div className="cn-glass rounded-2xl border border-emerald-500/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Circle size={10} className="fill-emerald-400 text-emerald-400" />
        <div>
          <p className="text-sm font-bold text-white">Amigos en línea</p>
          <p className="text-[11px] text-emerald-200/70">Quienes ya aceptaron tu amistad</p>
        </div>
      </div>

      {!user && (
        <p className="text-[11px] leading-relaxed text-purple-100/80">
          Inicia sesión para ver aquí, en la pizarra, a tus amigos conectados y escribirles al momento.
        </p>
      )}

      {user && amigos.length === 0 && (
        <p className="text-[11px] leading-relaxed text-purple-100/80">
          Nadie de tu lista de amistad está en línea ahora. Cuando un amigo acepte y entre, aparece aquí
          para que lo contactes sin ir a Mensajes.
        </p>
      )}

      {user && amigos.length > 0 && (
        <ul className="space-y-2">
          {amigos.map((amigo) => (
            <li key={amigo.id} className="flex items-center gap-2">
              <Link
                to="/u/$userId"
                params={{ userId: amigo.id }}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1 py-1 hover:bg-emerald-950/40"
              >
                <span className="relative shrink-0">
                  <img
                    src={amigo.avatar_url || `https://i.pravatar.cc/80?u=${amigo.id}`}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-white">{amigo.nombre}</span>
                  <span className="block truncate text-[10px] text-emerald-200/70">
                    {amigo.habilidad_empirica || 'En ContacNeed'}
                  </span>
                </span>
              </Link>
              {isPro ? (
                <Link
                  to="/mensajes/chat/$peerId"
                  params={{ peerId: amigo.id }}
                  className="shrink-0 rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-bold text-slate-950"
                  title="Escribir ahora"
                >
                  <MessageCircle size={12} />
                </Link>
              ) : (
                <Link
                  to="/u/$userId"
                  params={{ userId: amigo.id }}
                  className="shrink-0 rounded-lg border border-amber-400/40 px-2 py-1 text-[10px] font-bold text-amber-100"
                >
                  Ver
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
