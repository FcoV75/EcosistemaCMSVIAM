export function getGoogleMapsApiKey() {
  return String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim()
}

export function buildGoogleMapsDirectionsUrl(lat: number, lng: number, label?: string | null) {
  const destination = label?.trim()
    ? encodeURIComponent(label)
    : `${lat},${lng}`
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
}

export function buildGoogleMapsEmbedUrl(lat: number, lng: number) {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`
}

export function buildGoogleMapsEmbedFromAddress(address: string) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`
}

export function buildGoogleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function isValidCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function hasBusinessLocation(data: {
  lat?: number | null
  lng?: number | null
  maps_address?: string | null
}) {
  if (isValidCoordinate(data.lat) && isValidCoordinate(data.lng)) return true
  return Boolean(data.maps_address?.trim())
}
