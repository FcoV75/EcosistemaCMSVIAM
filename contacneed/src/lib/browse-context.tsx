import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type BrowseContextValue = {
  searchQuery: string
  setSearchQuery: (query: string) => void
}

const BrowseContext = createContext<BrowseContextValue>({
  searchQuery: '',
  setSearchQuery: () => {},
})

export function BrowseProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQueryState] = useState('')
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query)
  }, [])
  const value = useMemo(() => ({ searchQuery, setSearchQuery }), [searchQuery, setSearchQuery])
  return <BrowseContext.Provider value={value}>{children}</BrowseContext.Provider>
}

export function useBrowseSearch() {
  return useContext(BrowseContext)
}
