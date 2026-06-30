import { MapPin, Navigation } from 'lucide-react'
import { useState } from 'react'
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsSearchUrl,
  hasBusinessLocation,
  isValidCoordinate,
} from '../lib/google-maps'

type BusinessLocationPanelProps = {
  initialAddress?: string | null
  initialLat?: number | null
  initialLng?: number | null
  onSave: (payload: { maps_address: string; lat: number; lng: number }) => Promise<void>
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
  const [lat, setLat] = useState(
    typeof initialLat === 'number' ? String(initialLat) : '',
  )
  const [lng, setLng] = useState(
    typeof initialLng === 'number' ? String(initialLng) : '',
  )
  const [saving, setSaving] = useState(false)

  const latNum = Number(lat)
  const lngNum = Number(lng)
  const canPreview = isValidCoordinate(latNum) && isValidCoordinate(lngNum)

  const handleSave = async () => {
    if (!address.trim() || !canPreview) {
      alert('Captura dirección y coordenadas válidas (latitud/longitud).')
      return
    }
    setSaving(true)
    try {
      await onSave({ maps_address: address.trim(), lat: latNum, lng: lngNum })
      alert('Ubicación GPS guardada en tu tienda PRO.')
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
    return (
      <div className="overflow-hidden rounded-xl border border-emerald-500/25 bg-emerald-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/15 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-100">
            <MapPin size={16} />
            Ubicación del negocio
          </p>
          <a
            href={buildGoogleMapsDirectionsUrl(initialLat!, initialLng!, initialAddress)}
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
          src={buildGoogleMapsEmbedUrl(initialLat!, initialLng!)}
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
        Ubicación GPS (Google Maps) · PRO
      </h3>
      <p className="mb-4 text-sm text-emerald-900/80">
        Los clientes verán tu mapa y el botón &quot;Cómo llegar&quot; en tu perfil y tienda.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2 block text-sm">
          <span className="mb-1 block font-medium text-emerald-950">Dirección del negocio</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Calle, número, colonia, ciudad..."
            className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-slate-900"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-emerald-950">Latitud</span>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="20.659698"
            className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-slate-900"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-emerald-950">Longitud</span>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="-103.349609"
            className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-slate-900"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar ubicación'}
        </button>
        {address.trim() && (
          <a
            href={buildGoogleMapsSearchUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-900"
          >
            Buscar en Google Maps
          </a>
        )}
      </div>

      {canPreview && (
        <iframe
          title="Vista previa mapa"
          src={buildGoogleMapsEmbedUrl(latNum, lngNum)}
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
