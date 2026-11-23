import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Building2,
  Crown,
  Gem,
  MapPin,
  MessageSquare,
  PenLine,
  Radio,
  Sparkles,
  Stethoscope,
  Store,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { storageGet, storageSet } from './safe-storage'

export const ONBOARDING_STORAGE_KEY = 'contacneed_onboarding_v3_dismissed'
export const ONBOARDING_STORAGE_KEY_LEGACY = 'contacneed_onboarding_v2_dismissed'
export const ONBOARDING_STORAGE_KEY_LEGACY_V1 = 'contacneed_onboarding_v1_dismissed'
export const ONBOARDING_SESSION_KEY = 'contacneed_onboarding_session_seen'

export type OnboardingStep = {
  id: string
  title: string
  description: string
  highlights?: string[]
  icon: LucideIcon
  accent: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'ContacNeed: tu red de oficio en México',
    description:
      'Aquí no vendes “likes”: vendes confianza. Publicas tu trabajo, te encuentran por estado y cierras tratos con gente real que necesita tu oficio o profesión.',
    highlights: [
      'Gratis para empezar',
      '32 estados de México',
      'Oficios, profesiones y especialidades',
    ],
    icon: Sparkles,
    accent: 'from-amber-500 to-orange-500',
  },
  {
    id: 'browse',
    title: 'Pizarra nacional, filtro local',
    description:
      'Entras y ves lo que pasa en todo el país. Con un toque filtras tu estado y te quedas con la demanda cercana: clientes, colegas y oportunidades a tu alrededor.',
    highlights: [
      'Feed de toda la República',
      'Filtrar por estado en el menú',
      'Buscador de personas y oficios',
    ],
    icon: MapPin,
    accent: 'from-purple-500 to-indigo-500',
  },
  {
    id: 'publish',
    title: 'Publica y que te encuentren',
    description:
      'Sube foto de un trabajo reciente, un video de YouTube o tu catálogo. El botón «Qué publicar» te da ideas listas según tu oficio. Sin cuenta no hay publicación: regístrate y empieza.',
    highlights: [
      'Fotos, video y texto',
      'Ideas con «Qué publicar»',
      'Comentarios, likes y compartir',
    ],
    icon: PenLine,
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'profile',
    title: 'Perfil + tienda que venden por ti',
    description:
      'Completa oficio, foto y zona. Arma tu tienda con banner y productos. De día trabajas; de noche tu perfil sigue atrayendo clientes.',
    highlights: [
      'Tienda gratis (banner + productos)',
      'PRO amplía galería y Maps GPS',
      'Estrellas y reseñas de confianza',
    ],
    icon: Store,
    accent: 'from-slate-500 to-slate-700',
  },
  {
    id: 'pro',
    title: 'PRO: de existir a cerrar',
    description:
      'Gratis te deja existir. PRO te deja cerrar: más posts, tienda amplia, chat en vivo, anuncio destacado, Maps e informes de tendencias.',
    highlights: [
      '$300 MXN/mes o $3,000/año',
      'Chat en vivo + Espacio PRO',
      'Informes de mercado',
    ],
    icon: Crown,
    accent: 'from-amber-400 to-yellow-500',
  },
  {
    id: 'grupos-pro',
    title: 'Grupos: tu WhatsApp profesional',
    description:
      'Crea grupos privados para familia, equipo o proveedores. Solo entran quienes invites. Coordinación clara, sin perder mensajes en el celular personal.',
    highlights: ['Solo PRO', 'Invitaciones controladas', 'Chat de equipo'],
    icon: Users,
    accent: 'from-sky-500 to-indigo-500',
  },
  {
    id: 'mi-proyecto-pro',
    title: 'Mi Proyecto: obras serias',
    description:
      'Edificio, escuela, hospital o cualquier obra: grupos por oficio, presupuesto e imprevistos. Tú concluyes y dejas el equipo de mantenimiento.',
    highlights: ['Roles por especialidad', 'Finanzas de obra', 'Cierre y mantenimiento'],
    icon: Building2,
    accent: 'from-orange-500 to-amber-600',
  },
  {
    id: 'tu-contador-privado',
    title: 'Tu Contador Privado',
    description:
      'Para oficios con tienda: ingresos, egresos y saldo mes a mes, con checklist SAT educativo. Ordena tu negocio aunque no tengas contador a diario.',
    highlights: [
      'Control mensual simple',
      'Fotos de tickets',
      'Exportación anual',
    ],
    icon: Wallet,
    accent: 'from-emerald-500 to-lime-500',
  },
  {
    id: 'expediente-clinico',
    title: 'Expediente clínico normativo',
    description:
      'Médicos y paramédicos: historia clínica NOM-004, notas selladas, audio de consulta y separación Miembros / No miembros. Cada profesional en su cuenta.',
    highlights: ['NOM-004 / NOM-024', 'Audio de consulta', 'Cuota según CMS-Plus'],
    icon: Stethoscope,
    accent: 'from-cyan-500 to-emerald-500',
  },
  {
    id: 'cms-plus',
    title: 'Círculo CMS-Plus',
    description:
      'Salud + ContacNeed + Nexus + IA VIAM + Video Diamante en una membresía. Créditos de consulta, beneficiarios con descuento y cuatro niveles: Plata, Oro, Platino, Diamante.',
    highlights: [
      'Desde $499 MXN/mes',
      'Créditos de salud',
      'Curso en Escuela de principios',
    ],
    icon: Gem,
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    id: 'escuela',
    title: 'Escuela de principios',
    description:
      'Cursos vivos de vida, salud y prosperidad. Asiste, recupera los que ya se dieron y pide temas nuevos en el muro de la escuela.',
    highlights: [
      'Aula en /escuela',
      'Recuperación 200 MXN/curso',
      'Incluye curso CMS-Plus Membresías',
    ],
    icon: BookOpen,
    accent: 'from-indigo-500 to-blue-500',
  },
  {
    id: 'radio',
    title: 'Radio VIAM mientras trabajas',
    description:
      'Escucha la radio del ecosistema en el panel lateral. Acompaña tu jornada sin salir de ContacNeed.',
    highlights: ['Música del ecosistema', 'Sin cambiar de pestaña'],
    icon: Radio,
    accent: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'community',
    title: 'Mensajes, avisos y soporte',
    description:
      'Bandeja de mensajes, avisos y un bot flotante que responde dudas de registro, PRO, escuela y publicación. Nunca estás solo en la red.',
    highlights: ['Mensajes y avisos', 'Bot de soporte 24/7', 'Guía de uso siempre en el menú'],
    icon: MessageSquare,
    accent: 'from-violet-500 to-purple-600',
  },
  {
    id: 'register',
    title: 'Únete gratis hoy',
    description:
      'Crea tu cuenta, confirma el correo y completa estado + oficio. En minutos ya puedes publicar, armar tienda y empezar a que te encuentren.',
    highlights: [
      'Registro gratis',
      'Confirma tu correo',
      'Perfil listo = más clientes',
    ],
    icon: UserPlus,
    accent: 'from-rose-500 to-pink-500',
  },
]

export function shouldShowOnboardingAuto(): boolean {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname
  if (
    path === '/login' ||
    path === '/registro' ||
    path === '/privacidad' ||
    path === '/terminos' ||
    path.startsWith('/auth/')
  )
    return false
  if (storageGet('local', ONBOARDING_STORAGE_KEY) === '1') return false
  if (storageGet('local', ONBOARDING_STORAGE_KEY_LEGACY) === '1') return false
  if (storageGet('local', ONBOARDING_STORAGE_KEY_LEGACY_V1) === '1') return false
  if (storageGet('session', ONBOARDING_SESSION_KEY) === '1') return false
  return true
}

export function markOnboardingSeenThisSession() {
  if (typeof window === 'undefined') return
  storageSet('session', ONBOARDING_SESSION_KEY, '1')
}

export function dismissOnboardingForever() {
  if (typeof window === 'undefined') return
  storageSet('local', ONBOARDING_STORAGE_KEY, '1')
  markOnboardingSeenThisSession()
}
