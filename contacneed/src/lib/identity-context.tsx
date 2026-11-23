import { createContext, useContext, type ReactNode } from 'react'

export type IdentityProfile = {
  nombre?: string | null
  estado?: string | null
  municipio?: string | null
  habilidad_empirica?: string | null
  descripcion_profesion?: string | null
  tipo_miembro?: string | null
  cedula?: string | null
  es_estudiante?: boolean
  cedula_pendiente?: boolean
  onboarding_pospuestos?: number
  onboarding_pospuesto_hasta?: string | null
  onboarding_completado_at?: string | null
  needs_onboarding?: boolean
  needs_cedula_reminder?: boolean
  es_pro?: boolean
  verificado?: boolean
  es_fundador?: boolean
  avatar_url?: string | null
  bloqueado?: boolean
}

export type IdentityUser = {
  id: string
  email?: string
}

type IdentityContextValue = {
  user: IdentityUser | null
  profile: IdentityProfile | null
  isAdmin: boolean
  isPro: boolean
}

const IdentityContext = createContext<IdentityContextValue>({
  user: null,
  profile: null,
  isAdmin: false,
  isPro: false,
})

export function IdentityProvider({
  user,
  profile,
  isAdmin = false,
  children,
}: {
  user: IdentityUser | null
  profile?: IdentityProfile | null
  isAdmin?: boolean
  children: ReactNode
}) {
  const normalizedProfile = profile ?? null
  return (
    <IdentityContext.Provider
      value={{
        user,
        profile: normalizedProfile,
        isAdmin,
        isPro: Boolean(normalizedProfile?.es_pro),
      }}
    >
      {children}
    </IdentityContext.Provider>
  )
}

export function useIdentity() {
  return useContext(IdentityContext)
}
