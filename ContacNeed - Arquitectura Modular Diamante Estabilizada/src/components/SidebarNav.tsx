import { Link } from '@tanstack/react-router'
import { Crown, Home, Shield, User } from 'lucide-react'

type SidebarNavProps = {
  onOpenStripe: () => void
}

const links = [
  { to: '/', label: 'Pizarra', icon: Home },
  { to: '/profile', label: 'Mi Perfil', icon: User },
  { to: '/admin', label: 'Admin', icon: Shield },
] as const

export function SidebarNav({ onOpenStripe }: SidebarNavProps) {
  return (
    <nav className="cn-glass rounded-2xl border border-purple-500/20 p-3">
      <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-300/80">
        Navegación
      </p>
      <ul className="space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-white/10 hover:text-white [&.active]:bg-gradient-to-r [&.active]:from-purple-600/40 [&.active]:to-amber-500/20 [&.active]:text-white"
            >
              <Icon size={18} className="text-amber-400" />
              {label}
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onOpenStripe}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition hover:brightness-110"
      >
        <Crown size={16} />
        Subir a PRO
      </button>
    </nav>
  )
}
