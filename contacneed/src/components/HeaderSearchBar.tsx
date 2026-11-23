import { useEffect, useRef, useState } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { useBrowseSearch } from '../lib/browse-context'
import type { MexicoState } from '../lib/mexico-states'
import { PeopleSearchResults } from './PeopleSearchResults'

type HeaderSearchBarProps = {
  selectedState: MexicoState | ''
}

/**
 * Draft local + resultados en el header: la búsqueda funciona en cualquier ruta
 * (perfil, mensajes, etc.), no solo en la pizarra.
 */
export function HeaderSearchBar({ selectedState }: HeaderSearchBarProps) {
  const { searchQuery, setSearchQuery } = useBrowseSearch()
  const [draft, setDraft] = useState(searchQuery)
  const [open, setOpen] = useState(false)
  const lastEmitted = useRef(searchQuery)
  const rootRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (searchQuery !== lastEmitted.current) {
      lastEmitted.current = searchQuery
      setDraft(searchQuery)
    }
  }, [searchQuery])

  useEffect(() => {
    if (draft === lastEmitted.current) return
    const t = window.setTimeout(() => {
      lastEmitted.current = draft
      setSearchQuery(draft)
    }, 280)
    return () => window.clearTimeout(t)
  }, [draft, setSearchQuery])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (target && rootRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  const clear = () => {
    lastEmitted.current = ''
    setDraft('')
    setSearchQuery('')
    setOpen(false)
  }

  const commitAndShowBoard = () => {
    lastEmitted.current = draft
    setSearchQuery(draft)
    setOpen(false)
    if (pathname !== '/') {
      void navigate({ to: '/' })
    }
  }

  const showPanel = open && draft.trim().length >= 2

  return (
    <div ref={rootRef} className="relative z-50 w-full max-w-xl">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-amber-400/70"
        aria-hidden
      />
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            if (showPanel) {
              setOpen(false)
              return
            }
            clear()
            return
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            commitAndShowBoard()
          }
        }}
        placeholder="Buscar personas, oficios o publicaciones…"
        aria-label="Buscar personas, oficios o publicaciones"
        aria-expanded={showPanel}
        aria-controls="header-search-results"
        className="w-full rounded-xl border border-amber-500/25 bg-black/50 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-gray-500 outline-none transition focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/30"
      />
      {draft ? (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Limpiar búsqueda"
        >
          <X size={16} />
        </button>
      ) : null}

      {showPanel ? (
        <div
          id="header-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-amber-500/25 bg-slate-950/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <PeopleSearchResults
            query={draft}
            selectedState={selectedState}
            variant="dropdown"
            onPick={() => setOpen(false)}
          />
          <button
            type="button"
            onClick={commitAndShowBoard}
            className="mt-2 w-full rounded-lg border border-purple-500/30 bg-purple-950/40 px-3 py-2 text-xs font-semibold text-purple-100 transition hover:border-amber-400/40 hover:bg-purple-900/50"
          >
            Ver publicaciones en la pizarra
          </button>
        </div>
      ) : null}
    </div>
  )
}
