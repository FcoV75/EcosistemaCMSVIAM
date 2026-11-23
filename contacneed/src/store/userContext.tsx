import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useIdentity } from '../lib/identity-context'
import { isPlaceholderAvatarUrl, resolveAvatarUrl } from '../lib/default-avatar'
import { updateProfileFn } from '../server/auth.functions'
type ProfileData = {
  name: string
  title: string
  location: string
  description: string
  avatar: string
}

type UserContextValue = {
  profileData: ProfileData
  setProfileData: (data: ProfileData) => void
  saveProfileData: (data: ProfileData) => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

const emptyProfile: ProfileData = {
  name: '',
  title: '',
  location: '',
  description: '',
  avatar: '',
}

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, profile } = useIdentity()
  const [profileData, setProfileData] = useState<ProfileData>(emptyProfile)

  useEffect(() => {
    if (!user || !profile) {
      setProfileData(emptyProfile)
      return
    }

    setProfileData({
      name: profile.nombre?.trim() || user.email?.split('@')[0] || 'Usuario',
      title: profile.habilidad_empirica?.trim() || '',
      location: [profile.municipio, profile.estado].filter(Boolean).join(', '),
      description: profile.descripcion_profesion?.trim() || '',
      avatar: resolveAvatarUrl(profile.avatar_url, user.id, profile.nombre),
    })
  }, [user, profile])

  const saveProfileData = async (data: ProfileData) => {
    const locationParts = data.location.split(',').map((part) => part.trim()).filter(Boolean)
    const estado = locationParts.length > 1 ? locationParts.at(-1) : locationParts[0]
    const municipio = locationParts.length > 1 ? locationParts.slice(0, -1).join(', ') : undefined

    await updateProfileFn({
      data: {
        nombre: data.name,
        habilidad_empirica: data.title,
        descripcion_profesion: data.description,
        estado: estado || profile?.estado || undefined,
        municipio: municipio || profile?.municipio || undefined,
        avatar_url: !isPlaceholderAvatarUrl(data.avatar) ? data.avatar.trim() : profile?.avatar_url || undefined,
      },
    })
    setProfileData(data)
    await router.invalidate()
  }

  return (
    <UserContext.Provider value={{ profileData, setProfileData, saveProfileData }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser debe usarse dentro de UserProvider')
  return context
}
