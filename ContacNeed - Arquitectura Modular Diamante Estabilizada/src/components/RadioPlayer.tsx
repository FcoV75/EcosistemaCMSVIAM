import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Radio, Volume2, VolumeX } from 'lucide-react'

const DEFAULT_STREAM =
  String(import.meta.env.VITE_RADIO_STREAM_URL ?? '').trim() ||
  'https://playerservices.streamtheworld.com/api/livestream-redirect/XHIMER_FM.mp3'

export function RadioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    const audio = new Audio(DEFAULT_STREAM)
    audio.preload = 'none'
    audio.volume = volume
    audioRef.current = audio

    const onEnded = () => setPlaying(false)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('ended', onEnded)
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = muted ? 0 : volume
  }, [volume, muted])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }

    try {
      await audio.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  return (
    <div className="cn-glass rounded-2xl border border-purple-500/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-amber-500 text-white shadow-lg shadow-purple-900/30">
          <Radio size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Radio ContacNeed</p>
          <p className="text-[11px] text-purple-200/70">Música mientras trabajas</p>
        </div>
        {playing && <span className="cn-pulse-dot ml-auto" aria-hidden />}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pausar radio' : 'Reproducir radio'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 transition hover:bg-amber-400"
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          className="text-purple-200 hover:text-white"
        >
          {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(event) => {
            setMuted(false)
            setVolume(Number(event.target.value))
          }}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-purple-900/60 accent-amber-400"
          aria-label="Volumen"
        />
      </div>
    </div>
  )
}
