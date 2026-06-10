import { createContext, useContext, type ReactNode } from 'react'

export type IdentityUser = {
  id: string
  email?: string
}

type IdentityContextValue = {
  user: IdentityUser | null
  isAdmin: boolean
}

const IdentityContext = createContext<IdentityContextValue>({ user: null, isAdmin: false })

export function IdentityProvider({
  user,
  isAdmin = false,
  children,
}: {
  user: IdentityUser | null
  isAdmin?: boolean
  children: ReactNode
}) {
  return (
    <IdentityContext.Provider value={{ user, isAdmin }}>{children}</IdentityContext.Provider>
  )
}

export function useIdentity() {
  return useContext(IdentityContext)
}
