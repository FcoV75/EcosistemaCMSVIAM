const AUDIO_ID = 'lyriq-radio-viam-audio'

let audioElement: HTMLAudioElement | null = null
let listenersBound = false

export type RadioAudioHandlers = {
  onPlay: () => void
  onPause: () => void
  onEnded: () => void
  onTimeUpdate: () => void
}

let handlers: RadioAudioHandlers = {
  onPlay: () => {},
  onPause: () => {},
  onEnded: () => {},
  onTimeUpdate: () => {},
}

export function getRadioAudio(): HTMLAudioElement | null {
  if (typeof document === 'undefined') return null

  if (audioElement && document.body.contains(audioElement)) {
    return audioElement
  }

  const existing = document.getElementById(AUDIO_ID)
  if (existing instanceof HTMLAudioElement) {
    audioElement = existing
    return audioElement
  }

  audioElement = document.createElement('audio')
  audioElement.id = AUDIO_ID
  audioElement.preload = 'none'
  audioElement.setAttribute('playsinline', 'true')
  audioElement.style.display = 'none'
  document.body.appendChild(audioElement)
  return audioElement
}

export function bindRadioAudioListeners(nextHandlers: RadioAudioHandlers) {
  handlers = nextHandlers
  const audio = getRadioAudio()
  if (!audio || listenersBound) return

  if ('controlsList' in audio) {
    audio.controlsList.add('nodownload')
  }

  audio.addEventListener('play', () => handlers.onPlay())
  audio.addEventListener('pause', () => handlers.onPause())
  audio.addEventListener('ended', () => handlers.onEnded())
  audio.addEventListener('timeupdate', () => handlers.onTimeUpdate())
  listenersBound = true
}

export function urlsMatch(stored: string, current: string): boolean {
  if (!stored || !current) return false
  if (stored === current) return true
  try {
    return new URL(stored).href === new URL(current, window.location.origin).href
  } catch {
    return stored === current
  }
}
