import { MapPin, Navigation } from 'lucide-react'
import { useState } from 'react'
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsEmbedFromAddress,
  buildGoogleMapsSearchUrl,
  hasBusinessLocation,
  isValidCoordinate,
} from '../lib/google-maps'

type BusinessLocationPanelProps = {
  initialAddress?: string | null
  initialLat?: number | null
  initialLng?: number | null
  onSave: (payload: { maps_address: string; lat?: number | null; lng?: number | null }) => Promise<void>
  readOnly?: boolean
}

export function BusinessLocationPanel({
  initialAddress,
  initialLat,
  initialLng,
  onSave,
  readOnly,
}: BusinessLocationPanelProps) {
  const [address, setAddress] = useState(initialAddress ?? '')
  const [saving, setSaving] = useState(false)
  const [previewLat, setPreviewLat] = useState(
    typeof initialLat === 'number' ? initialLat : null,
  )
  const [previewLng, setPreviewLng] = useState(
    typeof initialLng === 'number' ? initialLng : null,
  )

  const canCoords =
    isValidCoordinate(previewLat) && isValidCoordinate(previewLng)
  const hasAddress = Boolean(address.trim() || initialAddress?.trim())

  const handleSave = async () => {
    if (!address.trim()) {
      alert('Captura la dirección del negocio. Google Maps la ubicará automáticamente.')
      return
    }
    setSaving(true)
    try {
      await onSave({ maps_address: address.trim() })
      alert('Ubicación guardada. Google Maps ubicó tu dirección en el mapa.')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo guardar la ubicación')
    } finally {
      setSaving(false)
    }
  }

  if (readOnly) {
    if (!hasBusinessLocation({ lat: initialLat, lng: initialLng, maps_address: initialAddress })) {
      return null
    }
    const embedSrc =
      isValidCoordinate(initialLat) && isValidCoordinate(initialLng)
        ? buildGoogleMapsEmbedUrl(initialLat!, initialLng!)
        : buildGoogleMapsEmbedFromAddress(initialAddress || '')
    const directionsHref =
      isValidCoordinate(initialLat) && isValidCoordinate(initialLng)
        ? buildGoogleMapsDirectionsUrl(initialLat!, initialLng!, initialAddress)
        : buildGoogleMapsSearchUrl(initialAddress || '')

    return (
      <div className="overflow-hidden rounded-xl border border-emerald-500/25 bg-emerald-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/15 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-100">
            <MapPin size={16} />
            Ubicación del negocio
          </p>
          <a
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
          >
            <Navigation size={14} />
            Cómo llegar
          </a>
        </div>
        {initialAddress && <p className="px-4 py-2 text-sm text-emerald-100/85">{initialAddress}</p>}
        <iframe
          title="Mapa del negocio"
          src={embedSrc}
          className="h-56 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <h3 className="mb-2 flex items-center gap-2 font-bold text-emerald-950">
        <MapPin size={18} />
        Ubicación (Google Maps) · PRO
      </h3>
      <p className="mb-4 text-sm text-emerald-900/80">
        Solo necesitas la dirección. ContacNeed la ubica en Google Maps para tus clientes.
      </p>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-emerald-950">Dirección del negocio</span>
        <input
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
            setPreviewLat(null)
            setPreviewLng(null)
          }}
          placeholder="Calle, número, colonia, ciudad, estado..."
          className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-slate-900"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? 'Ubicando y guardando...' : 'Guardar ubicación'}
        </button>
        {address.trim() && (
          <a
            href={buildGoogleMapsSearchUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-900"
          >
            Ver en Google Maps
          </a>
        )}
      </div>

      {(canCoords || hasAddress) && (
        <iframe
          title="Vista previa mapa"
          src={
            canCoords
              ? buildGoogleMapsEmbedUrl(previewLat!, previewLng!)
              : buildGoogleMapsEmbedFromAddress(address.trim() || initialAddress || '')
          }
          className="mt-4 h-48 w-full rounded-lg border border-emerald-200"
          loading="lazy"
        />
      )}
    </div>
  )
}

export function BusinessLocationDisplay(props: {
  maps_address?: string | null
  lat?: number | null
  lng?: number | null
}) {
  return (
    <BusinessLocationPanel
      initialAddress={props.maps_address}
      initialLat={props.lat}
      initialLng={props.lng}
      onSave={async () => {}}
      readOnly
    />
  )
}
