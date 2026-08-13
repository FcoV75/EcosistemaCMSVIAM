export type GeocodeResult = {
  lat: number
  lng: number
  formattedAddress?: string
}

function getMapsApiKey() {
  return String(
    process.env.GOOGLE_MAPS_API_KEY ??
      process.env.VITE_GOOGLE_MAPS_API_KEY ??
      '',
  ).trim()
}

async function geocodeWithGoogle(address: string): Promise<GeocodeResult | null> {
  const key = getMapsApiKey()
  if (!key) return null

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}&language=es&region=mx`

  const response = await fetch(url)
  if (!response.ok) return null
  const json = (await response.json()) as {
    status?: string
    results?: Array<{
      formatted_address?: string
      geometry?: { location?: { lat?: number; lng?: number } }
    }>
  }
  if (json.status !== 'OK' || !json.results?.[0]?.geometry?.location) return null

  const loc = json.results[0].geometry.location
  const lat = Number(loc.lat)
  const lng = Number(loc.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return {
    lat,
    lng,
    formattedAddress: json.results[0].formatted_address,
  }
}

/** Fallback sin API key (OpenStreetMap Nominatim). */
async function geocodeWithNominatim(address: string): Promise<GeocodeResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ContacNeed/1.0 (contacneed.com)',
    },
  })
  if (!response.ok) return null
  const json = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
  const row = json?.[0]
  if (!row) return null
  const lat = Number(row.lat)
  const lng = Number(row.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng, formattedAddress: row.display_name }
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const trimmed = address.trim()
  if (!trimmed) throw new Error('Captura la dirección del negocio.')

  const google = await geocodeWithGoogle(trimmed)
  if (google) return google

  const nominatim = await geocodeWithNominatim(trimmed)
  if (nominatim) return nominatim

  throw new Error(
    'No se pudo ubicar esa dirección en el mapa. Revisa calle, colonia, ciudad y estado.',
  )
}
