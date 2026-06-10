import { Link } from '@tanstack/react-router'
import { Crown, Home, User } from 'lucide-react'

type SidebarNavProps = {
  onOpenStripe: () => void
  isLoggedIn?: boolean
}

export function SidebarNav({ onOpenStripe, isLoggedIn }: SidebarNavProps) {
  return (
    <nav className="cn-glass rounded-2xl border border-amber-500/15 p-3">
      <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/70">
        Menú
      </p>
      <ul className="space-y-1">
        <li>
          <Link
            to="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-white/10 [&.active]:bg-gradient-to-r [&.active]:from-amber-600/20 [&.active]:to-purple-600/20"
          >
            <Home size={18} className="text-amber-400" />
            Pizarra
          </Link>
        </li>
        {isLoggedIn && (
          <li>
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-white/10 [&.active]:bg-gradient-to-r [&.active]:from-amber-600/20 [&.active]:to-purple-600/20"
            >
              <User size={18} className="text-amber-400" />
              Mi Perfil
            </Link>
          </li>
        )}
      </ul>

      <button
        type="button"
        onClick={onOpenStripe}
        className="cn-btn-metallic mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-950"
      >
        <Crown size={16} />
        Subir a PRO
      </button>
    </nav>
  )
}
