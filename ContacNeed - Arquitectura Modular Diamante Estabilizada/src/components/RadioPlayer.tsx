import { ChevronDown, Pause, Play, Radio, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { RADIO_ALL_LABEL, formatGenreLabel } from '../lib/ecosystem-radio'
import { useRadio } from '../lib/radio-context'

export function RadioPlayer() {
  const {
    playing,
    volume,
    muted,
    trackTitle,
    showGenres,
    activeGenre,
    genres,
    setShowGenres,
    playAllRandom,
    playGenre,
    playNext,
    togglePlay,
    setVolume,
    toggleMuted,
  } = useRadio()

  return (
    <div className="cn-glass rounded-2xl border border-purple-500/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-amber-500 text-white shadow-lg shadow-purple-900/30">
          <Radio size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Radio IA VIAM</p>
          <p className="text-[11px] text-purple-200/70">Ecosistema CMS · Nexus · ContacNeed</p>
        </div>
        {playing && <span className="cn-pulse-dot shrink-0" aria-hidden />}
      </div>

      <p className="mb-3 line-clamp-2 text-[11px] font-medium text-amber-300/90" title={trackTitle}>
        {playing || activeGenre ? `▶ ${trackTitle}` : trackTitle}
      </p>

      <button
        type="button"
        onClick={() => setShowGenres((value) => !value)}
        className="mb-3 flex w-full items-center justify-between rounded-xl border border-purple-500/25 bg-slate-900/50 px-3 py-2 text-left text-xs font-semibold text-purple-100 transition hover:border-amber-400/40"
      >
        <span className="truncate">
          {activeGenre
            ? activeGenre === RADIO_ALL_LABEL
              ? activeGenre
              : formatGenreLabel(activeGenre)
            : 'Elegir género musical'}
        </span>
        <ChevronDown size={14} className={`shrink-0 transition ${showGenres ? 'rotate-180' : ''}`} />
      </button>

      {showGenres && (
        <div className="mb-3 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-purple-500/20 bg-slate-950/80 p-2">
          <button
            type="button"
            onClick={playAllRandom}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-amber-500 px-3 py-2 text-left text-xs font-bold text-white"
          >
            {RADIO_ALL_LABEL}
          </button>
          {genres.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => playGenre(genre)}
              className="w-full rounded-lg px-3 py-2 text-left text-xs text-purple-100 transition hover:bg-purple-900/50"
            >
              {formatGenreLabel(genre)}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void togglePlay()}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 transition hover:bg-amber-400"
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={playNext}
          aria-label="Siguiente pista"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-purple-500/30 text-purple-200 transition hover:border-amber-400/50 hover:text-amber-300"
        >
          <SkipForward size={16} />
        </button>

        <button
          type="button"
          onClick={toggleMuted}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          className="text-purple-200 hover:text-white"
        >
          {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onInput={(event) => setVolume(Number(event.currentTarget.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-purple-900/60 accent-amber-400"
          aria-label="Volumen"
        />
      </div>
    </div>
  )
}
