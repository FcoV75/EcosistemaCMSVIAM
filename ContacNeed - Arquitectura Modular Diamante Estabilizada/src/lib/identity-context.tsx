import { createContext, useContext, type ReactNode } from 'react'

export type IdentityUser = {
  id: string
  email?: string
}

type IdentityContextValue = {
  user: IdentityUser | null
}

const IdentityContext = createContext<IdentityContextValue>({ user: null })

export function IdentityProvider({
  user,
  children,
}: {
  user: IdentityUser | null
  children: ReactNode
}) {
  return <IdentityContext.Provider value={{ user }}>{children}</IdentityContext.Provider>
}

export function useIdentity() {
  return useContext(IdentityContext)
}
