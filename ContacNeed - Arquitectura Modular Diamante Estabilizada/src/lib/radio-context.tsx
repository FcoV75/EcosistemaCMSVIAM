import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  RADIO_ALL_LABEL,
  formatGenreLabel,
  getAllTracksShuffled,
  getGenreKeys,
  getTracksByGenre,
  trackTitleFromUrl,
} from './ecosystem-radio'
import { bindRadioAudioListeners, getRadioAudio, urlsMatch } from './radio-audio'

const STORAGE_KEY = 'lyriq-radio-viam-v1'

type PersistedRadio = {
  src: string
  currentTime: number
  playing: boolean
  volume: number
  muted: boolean
  activeGenre: string
  index: number
  playlist: string[]
  hasSelected: boolean
}

type RadioContextValue = {
  playing: boolean
  volume: number
  muted: boolean
  trackTitle: string
  showGenres: boolean
  activeGenre: string
  genres: string[]
  setShowGenres: (value: boolean | ((prev: boolean) => boolean)) => void
  playAllRandom: () => void
  playGenre: (genre: string) => void
  playNext: () => void
  togglePlay: () => Promise<void>
  setVolume: (value: number) => void
  toggleMuted: () => void
}

const RadioContext = createContext<RadioContextValue | null>(null)

let sessionRestored = false

function readPersisted(): Partial<PersistedRadio> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedRadio) : null
  } catch {
    return null
  }
}

function writePersisted(data: PersistedRadio) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* quota or private mode */
  }
}

export function RadioProvider({ children }: { children: ReactNode }) {
  const saved = useMemo(() => readPersisted(), [])

  const playlistRef = useRef<string[]>([])
  const indexRef = useRef(0)
  const selectionRef = useRef('')
  const hasSelectedRef = useRef(false)
  const currentUrlRef = useRef('')
  const persistTimerRef = useRef<number | null>(null)

  const volumeRef = useRef(saved?.volume ?? 0.7)
  const mutedRef = useRef(saved?.muted ?? false)
  const activeGenreRef = useRef(saved?.activeGenre ?? '')

  const [playing, setPlaying] = useState(Boolean(saved?.playing))
  const [volume, setVolumeState] = useState(volumeRef.current)
  const [muted, setMuted] = useState(mutedRef.current)
  const [trackTitle, setTrackTitle] = useState(
    saved?.src ? trackTitleFromUrl(saved.src) : 'Selecciona un género para comenzar',
  )
  const [showGenres, setShowGenres] = useState(!saved?.hasSelected)
  const [activeGenre, setActiveGenre] = useState(activeGenreRef.current)

  const genres = getGenreKeys()

  const persistNowRef = useRef<() => void>(() => {})
  const handleEndedRef = useRef<() => void>(() => {})
  const schedulePersistRef = useRef<() => void>(() => {})

  const persistNow = useCallback(() => {
    const audio = getRadioAudio()
    if (!audio?.src) return
    writePersisted({
      src: audio.currentSrc || audio.src,
      currentTime: audio.currentTime,
      playing: !audio.paused,
      volume: volumeRef.current,
      muted: mutedRef.current,
      activeGenre: activeGenreRef.current,
      index: indexRef.current,
      playlist: playlistRef.current,
      hasSelected: hasSelectedRef.current,
    })
  }, [])

  persistNowRef.current = persistNow

  const schedulePersist = useCallback(() => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current)
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistNowRef.current()
      persistTimerRef.current = null
    }, 400)
  }, [])

  schedulePersistRef.current = schedulePersist

  const loadTrack = useCallback((index: number, autoplay = false) => {
    const playlist = playlistRef.current
    if (playlist.length === 0) return

    const url = playlist[index]
    const audio = getRadioAudio()
    if (!audio) return

    if (currentUrlRef.current !== url) {
      currentUrlRef.current = url
      audio.src = url
      audio.load()
    }

    setTrackTitle(trackTitleFromUrl(url))
    schedulePersistRef.current()

    if (autoplay) {
      void audio.play().catch(() => setPlaying(false))
    }
  }, [])

  const playAllRandom = useCallback(() => {
    selectionRef.current = RADIO_ALL_LABEL
    activeGenreRef.current = RADIO_ALL_LABEL
    setActiveGenre(RADIO_ALL_LABEL)
    playlistRef.current = getAllTracksShuffled()
    indexRef.current = 0
    hasSelectedRef.current = true
    loadTrack(0, true)
    setPlaying(true)
    setShowGenres(false)
    schedulePersistRef.current()
  }, [loadTrack])

  const playGenre = useCallback(
    (genre: string) => {
      selectionRef.current = genre
      activeGenreRef.current = genre
      setActiveGenre(genre)
      playlistRef.current = getTracksByGenre(genre)
      indexRef.current = 0
      hasSelectedRef.current = true
      loadTrack(0, true)
      setPlaying(true)
      setShowGenres(false)
      schedulePersistRef.current()
    },
    [loadTrack],
  )

  const playNext = useCallback(() => {
    if (!hasSelectedRef.current) {
      setShowGenres(true)
      return
    }
    const playlist = playlistRef.current
    if (playlist.length === 0) return
    indexRef.current = (indexRef.current + 1) % playlist.length
    loadTrack(indexRef.current, true)
    setPlaying(true)
  }, [loadTrack])

  const handleEnded = useCallback(() => {
    const playlist = playlistRef.current
    indexRef.current += 1

    if (indexRef.current >= playlist.length) {
      if (selectionRef.current === RADIO_ALL_LABEL) {
        playAllRandom()
        return
      }
      const label = formatGenreLabel(selectionRef.current)
      const repeat = window.confirm(
        `Has terminado la estación "${label}". ¿Volver a escucharla? Si cancelas, se mezclarán todos los géneros.`,
      )
      if (repeat) {
        playGenre(selectionRef.current)
      } else {
        playAllRandom()
      }
      return
    }

    loadTrack(indexRef.current, true)
    setPlaying(true)
  }, [loadTrack, playAllRandom, playGenre])

  handleEndedRef.current = handleEnded

  useEffect(() => {
    const audio = getRadioAudio()
    if (!audio) return

    audio.volume = mutedRef.current ? 0 : volumeRef.current

    bindRadioAudioListeners({
      onPlay: () => {
        setPlaying(true)
        schedulePersistRef.current()
      },
      onPause: () => {
        setPlaying(false)
        schedulePersistRef.current()
      },
      onEnded: () => handleEndedRef.current(),
      onTimeUpdate: () => schedulePersistRef.current(),
    })

    if (sessionRestored) {
      if (audio.src) {
        currentUrlRef.current = audio.currentSrc || audio.src
        setTrackTitle(trackTitleFromUrl(currentUrlRef.current))
        setPlaying(!audio.paused)
      }
    } else {
      sessionRestored = true

      if (saved?.hasSelected && saved.src && saved.playlist?.length) {
        playlistRef.current = saved.playlist
        indexRef.current = saved.index ?? 0
        selectionRef.current = saved.activeGenre ?? ''
        activeGenreRef.current = saved.activeGenre ?? ''
        hasSelectedRef.current = true
        setActiveGenre(saved.activeGenre ?? '')
        setShowGenres(false)
        currentUrlRef.current = saved.src

        const alreadySameTrack =
          urlsMatch(saved.src, audio.currentSrc || audio.src) && audio.readyState >= 1

        if (!alreadySameTrack) {
          audio.src = saved.src
          audio.load()
        }

        setTrackTitle(trackTitleFromUrl(saved.src))

        const resume = () => {
          if (saved.currentTime && saved.currentTime > 0) {
            audio.currentTime = saved.currentTime
          }
          if (saved.playing && audio.paused) {
            void audio.play().catch(() => setPlaying(false))
          } else {
            setPlaying(!audio.paused)
          }
        }

        if (alreadySameTrack) {
          resume()
        } else {
          audio.addEventListener('loadedmetadata', resume, { once: true })
        }
      }
    }

    const onBeforeUnload = () => persistNowRef.current()
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current)
      }
    }
  }, [saved])

  const togglePlay = useCallback(async () => {
    const audio = getRadioAudio()
    if (!audio) return

    if (!hasSelectedRef.current) {
      setShowGenres(true)
      return
    }

    if (!audio.paused) {
      audio.pause()
      return
    }

    try {
      await audio.play()
    } catch {
      setPlaying(false)
    }
  }, [])

  const setVolume = useCallback((value: number) => {
    const clamped = Math.min(1, Math.max(0, value))
    mutedRef.current = false
    volumeRef.current = clamped
    setMuted(false)
    setVolumeState(clamped)

    const audio = getRadioAudio()
    if (audio) {
      audio.volume = clamped
    }
  }, [])

  const toggleMuted = useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)

    const audio = getRadioAudio()
    if (audio) {
      audio.volume = next ? 0 : volumeRef.current
    }
  }, [])

  const value: RadioContextValue = {
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
  }

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>
}

export function useRadio() {
  const ctx = useContext(RadioContext)
  if (!ctx) {
    throw new Error('useRadio debe usarse dentro de RadioProvider')
  }
  return ctx
}
