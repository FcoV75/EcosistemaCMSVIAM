import { createContext, useContext, useState, type ReactNode } from 'react'

type ProfileData = {
  name: string
  title: string
  location: string
  description: string
  avatar: string
}

type UserContextValue = {
  userType: 'free' | 'pro'
  setUserType: (type: 'free' | 'pro') => void
  profileData: ProfileData
  setProfileData: (data: ProfileData) => void
  saveProfileData: (data: ProfileData) => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [userType, setUserType] = useState<'free' | 'pro'>('free')
  const [profileData, setProfileData] = useState<ProfileData>({
    name: 'Usuario ContacNeed',
    title: '',
    location: '',
    description: '',
    avatar: '',
  })

  const saveProfileData = async (data: ProfileData) => {
    setProfileData(data)
  }

  return (
    <UserContext.Provider
      value={{
        userType,
        setUserType,
        profileData,
        setProfileData,
        saveProfileData,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser debe usarse dentro de UserProvider')
  return context
}
