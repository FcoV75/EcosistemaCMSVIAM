import { Link } from '@tanstack/react-router'
import {
  Bell,
  BookOpen,
  Building2,
  Crown,
  HelpCircle,
  Home,
  LogIn,
  LogOut,
  Mail,
  Sparkles,
  User,
  UserPlus,
  Users,
} from 'lucide-react'
import type { AuthTab } from './AuthModal'
import { SectionHelpHint } from './SectionHelpHint'

type SidebarNavProps = {
  onOpenStripe: () => void
  onPublishProAd?: () => void
  onOpenGuide?: () => void
  isPro?: boolean
  isLoggedIn?: boolean
  onSignOut?: () => void | Promise<void>
  signingOut?: boolean
  onOpenAuth: (tab: AuthTab) => void
}

export function SidebarNav({
  onOpenStripe,
  onPublishProAd,
  onOpenGuide,
  isPro,
  isLoggedIn,
  onSignOut,
  signingOut,
  onOpenAuth,
}: SidebarNavProps) {
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
        <li>
          <Link
            to="/escuela"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-white/10 [&.active]:bg-gradient-to-r [&.active]:from-amber-600/20 [&.active]:to-purple-600/20"
          >
            <BookOpen size={18} className="text-amber-400" />
            Escuela de principios
          </Link>
        </li>
        <li>
          <a
            href="https://centromultidisciplinarioags.com/nexus#organo-piloto"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-white/10"
          >
            <Sparkles size={18} className="text-amber-400" />
            Nexus Presencia
          </a>
        </li>
        {isLoggedIn ? (
          <>
            <li>
              <Link
                to="/avisos"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-white/10 [&.active]:bg-gradient-to-r [&.active]:from-amber-600/20 [&.active]:to-purple-600/20"
              >
                <Bell size={18} className="text-amber-400" />
                Avisos
              </Link>
            </li>
            <li>
              <Link
                to="/mensajes"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-white/10 [&.active]:bg-gradient-to-r [&.active]:from-amber-600/20 [&.active]:to-purple-600/20"
              >
                <Mail size={18} className="text-amber-400" />
                Mensajes
              </Link>
            </li>
            <li>
              <div className="flex items-center gap-1 rounded-xl px-3 py-2.5 transition hover:bg-white/10">
                <Link
                  to="/grupos"
                  className="flex flex-1 items-center gap-3 text-sm font-medium text-purple-100 [&.active]:text-amber-100"
                >
                  <Users size={18} className="text-amber-400" />
                  Grupos
                  <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
                    PRO
                  </span>
                </Link>
                <SectionHelpHint
                  title="Grupos"
                  text="Espacios tipo WhatsApp para familia, equipo o proveedores. Solo ContacNeed PRO."
                />
              </div>
            </li>
            <li>
              <div className="flex items-center gap-1 rounded-xl px-3 py-2.5 transition hover:bg-white/10">
                <Link
                  to="/mi-proyecto"
                  className="flex flex-1 items-center gap-3 text-sm font-medium text-purple-100 [&.active]:text-amber-100"
                >
                  <Building2 size={18} className="text-amber-400" />
                  Mi Proyecto
                  <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
                    PRO
                  </span>
                </Link>
                <SectionHelpHint
                  title="Mi Proyecto"
                  text="Proyectos serios con grupos estratégicos por rol. Quien inicia concluye la obra y elige el equipo de mantenimiento. PRO."
                />
              </div>
            </li>
            <li>
              <Link
                to="/profile"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-white/10 [&.active]:bg-gradient-to-r [&.active]:from-amber-600/20 [&.active]:to-purple-600/20"
              >
                <User size={18} className="text-amber-400" />
                Mi Perfil
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onSignOut?.()}
                disabled={signingOut}
                className="flex w-full items-center gap-3 rounded-xl border border-red-400/30 bg-red-950/30 px-3 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-900/40 disabled:opacity-50"
              >
                <LogOut size={18} />
                {signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-white/10"
              >
                <LogIn size={18} className="text-amber-400" />
                Iniciar sesión
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-amber-600/25 to-purple-600/25 px-3 py-2.5 text-sm font-bold text-amber-100 transition hover:from-amber-600/35 hover:to-purple-600/35"
              >
                <UserPlus size={18} className="text-amber-400" />
                Registrarse
              </button>
            </li>
          </>
        )}
      </ul>

      <button
        type="button"
        onClick={() => onOpenGuide?.()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-purple-400/30 bg-purple-900/25 px-4 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-purple-800/35"
      >
        <HelpCircle size={16} className="text-amber-400" />
        Guía de uso
      </button>

      {isPro ? (
        <button
          type="button"
          onClick={() => onPublishProAd?.()}
          className="cn-btn-metallic mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-950"
        >
          <Crown size={16} />
          Mi anuncio PRO
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenStripe}
          className="cn-btn-metallic mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-950"
        >
          <Crown size={16} />
          Subir a PRO
        </button>
      )}
    </nav>
  )
}
