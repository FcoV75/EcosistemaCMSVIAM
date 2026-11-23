import { getActiveAdsFn, type AnuncioRow } from '../server/ads.functions'

export type { AnuncioRow }

export async function fetchActiveAds(estado?: string, tipo?: string): Promise<AnuncioRow[]> {
  return getActiveAdsFn({ data: { estado, tipo } })
}
