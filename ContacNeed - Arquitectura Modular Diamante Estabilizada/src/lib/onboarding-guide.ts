import type { LucideIcon } from 'lucide-react'
import {
  Crown,
  MapPin,
  MessageSquare,
  PenLine,
  Radio,
  Sparkles,
  Store,
  UserPlus,
} from 'lucide-react'

export const ONBOARDING_STORAGE_KEY = 'contacneed_onboarding_v2_dismissed'
export const ONBOARDING_STORAGE_KEY_LEGACY = 'contacneed_onboarding_v1_dismissed'
export const ONBOARDING_SESSION_KEY = 'contacneed_onboarding_session_seen'

export type OnboardingStep = {
  id: string
  title: string
  description: string
  icon: LucideIcon
  accent: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenido a ContacNeed',
    description:
      'La red social de oficios y profesiones en México. Aquí encuentras servicios, publicas tu trabajo y conectas con clientes de todo el país.',
    icon: Sparkles,
    accent: 'from-amber-500 to-orange-500',
  },
  {
    id: 'browse',
    title: 'Explora toda la pizarra',
    description:
      'Al entrar ves publicaciones de todos los estados. Usa el selector "Filtrar por estado" en el menú lateral para ver solo tu entidad o ciudad.',
    icon: MapPin,
    accent: 'from-purple-500 to-indigo-500',
  },
  {
    id: 'publish',
    title: 'Publica en la Pizarra',
    description:
      'Publica lo de tu oficio: foto de un trabajo reciente, un YouTube de tu proceso o material propio (catálogo, certificado, demo). El botón "Qué publicar" en la pizarra te da ideas concretas. Necesitas iniciar sesión para publicar y comentar.',
    icon: PenLine,
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'radio',
    title: 'Radio VIAM',
    description:
      'En el panel lateral puedes escuchar la radio mientras navegas la red. Ideal para acompañar tu jornada de trabajo.',
    icon: Radio,
    accent: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'profile',
    title: 'Tu perfil y tienda',
    description:
      'En Mi Perfil configuras tu oficio, foto y descripción. La tienda básica es gratis (banner + 2 productos); PRO desbloquea más.',
    icon: Store,
    accent: 'from-slate-500 to-slate-700',
  },
  {
    id: 'pro',
    title: 'Membresía PRO',
    description:
      'Con PRO ganas visibilidad, publicas tu anuncio en el Espacio PRO lateral y amplías tu tienda. Botón "Subir a PRO" en el menú.',
    icon: Crown,
    accent: 'from-amber-400 to-yellow-500',
  },
  {
    id: 'community',
    title: 'Comunidad y soporte',
    description:
      'Comenta publicaciones, busca oficios en la barra superior y usa el bot flotante de soporte si tienes dudas técnicas.',
    icon: MessageSquare,
    accent: 'from-violet-500 to-purple-600',
  },
  {
    id: 'register',
    title: '¿Listo para unirte?',
    description:
      'Regístrate gratis, confirma tu correo y completa tu perfil con estado y oficio para que te encuentren más fácil.',
    icon: UserPlus,
    accent: 'from-rose-500 to-pink-500',
  },
]

export function shouldShowOnboardingAuto(): boolean {
  if (typeof window === 'undefined') return false
  if (window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1') return false
  if (window.localStorage.getItem(ONBOARDING_STORAGE_KEY_LEGACY) === '1') return false
  if (window.sessionStorage.getItem(ONBOARDING_SESSION_KEY) === '1') return false
  return true
}

export function markOnboardingSeenThisSession() {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(ONBOARDING_SESSION_KEY, '1')
}

export function dismissOnboardingForever() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
  markOnboardingSeenThisSession()
}
