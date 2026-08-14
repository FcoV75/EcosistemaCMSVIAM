import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useBrowseSearch } from '../lib/browse-context'

/**
 * Input local + debounce: el valor en pantalla no depende del re-render del feed
 * (que puede ser pesado al filtrar / cargar personas). Así el buscador no se “atora”.
 */
export function HeaderSearchBar() {
  const { searchQuery, setSearchQuery } = useBrowseSearch()
  const [draft, setDraft] = useState(searchQuery)
  const lastEmitted = useRef(searchQuery)

  // Solo sincroniza si el contexto cambió desde fuera (p. ej. limpiar categoría)
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

  const clear = () => {
    lastEmitted.current = ''
    setDraft('')
    setSearchQuery('')
  }

  return (
    <div className="relative z-40 w-full max-w-xl">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/70"
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
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            clear()
            return
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            lastEmitted.current = draft
            setSearchQuery(draft)
          }
        }}
        placeholder="Buscar personas, oficios o publicaciones…"
        aria-label="Buscar personas, oficios o publicaciones"
        className="w-full rounded-xl border border-amber-500/25 bg-black/50 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-gray-500 outline-none transition focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/30"
      />
      {draft ? (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Limpiar búsqueda"
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  )
}
