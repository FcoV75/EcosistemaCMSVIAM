import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { NewUserGuide } from '../components/NewUserGuide'
import {
  dismissOnboardingForever,
  markOnboardingSeenThisSession,
  shouldShowOnboardingAuto,
} from './onboarding-guide'

type OnboardingContextValue = {
  open: boolean
  autoOpened: boolean
  openGuide: () => void
  closeGuide: (remember?: boolean) => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [autoOpened, setAutoOpened] = useState(false)

  useEffect(() => {
    try {
      if (shouldShowOnboardingAuto()) {
        setAutoOpened(true)
        setOpen(true)
      }
    } catch {
      /* Safari / almacenamiento bloqueado */
    }
  }, [])

  const openGuide = useCallback(() => {
    setAutoOpened(false)
    setOpen(true)
  }, [])

  const closeGuide = useCallback((remember = true) => {
    if (remember) dismissOnboardingForever()
    else markOnboardingSeenThisSession()
    setOpen(false)
  }, [])

  return (
    <OnboardingContext.Provider value={{ open, autoOpened, openGuide, closeGuide }}>
      {children}
      <NewUserGuide open={open} autoOpened={autoOpened} onClose={closeGuide} />
    </OnboardingContext.Provider>
  )
}

export function useOnboardingGuide() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboardingGuide debe usarse dentro de OnboardingProvider')
  }
  return context
}
