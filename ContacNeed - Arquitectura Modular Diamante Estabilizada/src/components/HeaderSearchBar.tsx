import { Search, X } from 'lucide-react'
import { useBrowseSearch } from '../lib/browse-context'

export function HeaderSearchBar() {
  const { searchQuery, setSearchQuery } = useBrowseSearch()

  return (
    <div className="relative w-full min-w-0 max-w-xl flex-1">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/70"
      />
      <input
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Buscar persona, oficio, profesión o publicación..."
        className="w-full rounded-xl border border-purple-500/25 bg-slate-900/50 py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-purple-300/40 focus:border-amber-400/50 focus:outline-none"
        aria-label="Buscar personas y publicaciones en ContacNeed"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-purple-300 hover:bg-white/10"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
