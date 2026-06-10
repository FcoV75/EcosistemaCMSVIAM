import { tracksData } from './ecosystem-radio-tracks'

export const RADIO_ALL_LABEL = 'Escuchemos un poco de Todo'

export function getGenreKeys(): string[] {
  return Object.keys(tracksData)
}

export function formatGenreLabel(key: string): string {
  return key.replace(/_/g, ' ')
}

export function trackTitleFromUrl(url: string): string {
  const parts = url.split('/')
  let name = parts[parts.length - 1].split('.')[0]
  name = decodeURIComponent(name).replace(/_/g, ' ')
  return name
}

export function getAllTracksShuffled(): string[] {
  const all: string[] = []
  for (const folder of getGenreKeys()) {
    all.push(...tracksData[folder])
  }
  return all.sort(() => Math.random() - 0.5)
}

export function getTracksByGenre(genre: string): string[] {
  return [...(tracksData[genre] ?? [])]
}

export function getRandomTrackUrl(): string {
  const all = getAllTracksShuffled()
  return all[Math.floor(Math.random() * all.length)] ?? ''
}
