import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { BadgeCheck, Crown, MapPin, MessageSquare, Phone, Store, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from '../../components/AppShell'
import { ProfileRating } from '../../components/ProfileRating'
import { BusinessLocationDisplay } from '../../components/BusinessLocationPanel'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../../lib/mexico-states'
import { useIdentity } from '../../lib/identity-context'
import { getPublicProfileFn, sendContactRequestFn } from '../../server/social.functions'

export const Route = createFileRoute('/u/$userId')({
  loader: async ({ params }) => getPublicProfileFn({ data: params.userId }),
  component: PublicProfilePage,
})

function PublicProfilePage() {
  const data = Route.useLoaderData()
  const { userId } = Route.useParams()
  const { user } = useIdentity()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [serviceNote, setServiceNote] = useState('')
  const [friendNote, setFriendNote] = useState('')

  const profile = data.profile
  const negocio = data.negocio
  const relacion = data.relacion
  const items = Array.isArray(negocio?.items) ? (negocio.items as string[]) : []

  const serviceMutation = useMutation({
    mutationFn: () =>
      sendContactRequestFn({
        data: {
          destinatarioId: userId,
          tipo: 'servicio',
          mensaje: serviceNote.trim(),
        },
      }),
    onSuccess: () => {
      alert('Solicitud de servicio enviada. Le llegará en Avisos y en su bandeja.')
      setServiceNote('')
    },
    onError: (error) => alert(error instanceof Error ? error.message : 'No se pudo enviar'),
  })

  const friendMutation = useMutation({
    mutationFn: () =>
      sendContactRequestFn({
        data: {
          destinatarioId: userId,
          tipo: 'amistad',
          mensaje: friendNote.trim() || undefined,
        },
      }),
    onSuccess: () => {
      alert('Solicitud de amistad enviada.')
      setFriendNote('')
    },
    onError: (error) => alert(error instanceof Error ? error.message : 'No se pudo enviar'),
  })

  const avatar = profile.avatar_url?.trim() || `https://i.pravatar.cc/150?u=${profile.id}`

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      <div className="cn-glass overflow-hidden rounded-2xl border border-purple-500/20">
        {negocio?.banner_url && (
          <img src={negocio.banner_url} alt="Banner" className="h-40 w-full object-cover" />
        )}

        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-start gap-4">
            <img src={avatar} alt={profile.nombre ?? ''} className="h-24 w-24 rounded-full border-2 border-amber-400/40 object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-white">{profile.nombre ?? 'Profesional'}</h1>
                {profile.verificado && <BadgeCheck className="text-blue-400" size={20} />}
                {profile.es_pro && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
                    <Crown size={12} /> PRO
                  </span>
                )}
                {profile.online && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                    En línea
                  </span>
                )}
              </div>
              <p className="mt-1 text-amber-200/90">{profile.habilidad_empirica ?? 'Profesional'}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-purple-200/70">
                <MapPin size={14} />
                {[profile.municipio, profile.estado].filter(Boolean).join(', ') || 'México'}
              </p>
              {profile.descripcion_profesion && (
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-purple-100/85">
                  {profile.descripcion_profesion}
                </p>
              )}
              {profile.celular && (
                <a
                  href={`tel:${profile.celular}`}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                >
                  <Phone size={14} /> {profile.celular}
                </a>
              )}
            </div>
          </div>

          <div className="mt-6">
            <ProfileRating
              userId={userId}
              promedio={profile.calificacion_promedio}
              total={profile.total_calificaciones}
            />
          </div>

          {user && user.id !== userId && (
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4">
                <h2 className="mb-2 flex items-center gap-2 font-bold text-white">
                  <MessageSquare size={18} className="text-emerald-400" />
                  Solicitar servicio
                </h2>
                <p className="mb-2 text-xs text-emerald-100/75">
                  Explica con claridad qué necesitas. Le llegará en su campanita de Avisos y podrá responderte.
                </p>
                <textarea
                  rows={4}
                  value={serviceNote}
                  onChange={(e) => setServiceNote(e.target.value)}
                  placeholder="Ej. Necesito plomería el sábado en la mañana, fuga en baño, colonia Centro..."
                  className="w-full rounded-xl border border-emerald-500/25 bg-slate-950/60 px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  disabled={serviceNote.trim().length < 20 || serviceMutation.isPending}
                  onClick={() => serviceMutation.mutate()}
                  className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {serviceMutation.isPending ? 'Enviando...' : 'Enviar solicitud de servicio'}
                </button>
                {relacion?.solicitudPendiente === 'servicio' && (
                  <p className="mt-2 text-xs text-amber-200/80">Ya tienes una solicitud de servicio pendiente.</p>
                )}
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-slate-900/40 p-4">
                <h2 className="mb-2 flex items-center gap-2 font-bold text-white">
                  <UserPlus size={18} className="text-amber-400" />
                  Amistad y chat
                </h2>
                {relacion?.esContacto ? (
                  <div className="space-y-3">
                    <p className="text-sm text-emerald-200/90">
                      Ya son contactos. Pueden escribirse en la bandeja
                      {profile.es_pro ? ' y usar chat en vivo si eres PRO.' : '.'}
                    </p>
                    <Link
                      to="/mensajes"
                      className="inline-flex rounded-xl border border-purple-400/40 bg-purple-950/30 px-4 py-2 text-sm font-bold text-purple-100 hover:bg-purple-900/40"
                    >
                      Ir a mensajes →
                    </Link>
                    {profile.es_pro && (
                      <Link
                        to="/mensajes/chat/$peerId"
                        params={{ peerId: userId }}
                        className="ml-2 inline-flex rounded-xl border border-emerald-400/40 bg-emerald-950/30 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-900/40"
                      >
                        Chat en vivo PRO →
                      </Link>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-purple-200/70">
                      El chat libre se habilita cuando acepten tu amistad o tu solicitud de servicio.
                    </p>
                    <textarea
                      rows={2}
                      value={friendNote}
                      onChange={(e) => setFriendNote(e.target.value)}
                      placeholder="Mensaje opcional de presentación..."
                      className="w-full rounded-xl border border-purple-500/25 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => friendMutation.mutate()}
                      disabled={friendMutation.isPending}
                      className="mt-3 rounded-xl border border-purple-400/40 px-4 py-2 text-xs font-bold text-purple-100"
                    >
                      {friendMutation.isPending ? 'Enviando...' : 'Solicitar amistad'}
                    </button>
                    {relacion?.solicitudPendiente === 'amistad' && (
                      <p className="mt-2 text-xs text-amber-200/80">Solicitud de amistad pendiente.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {!user && (
            <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
              <Link to="/login" className="font-bold underline">Inicia sesión</Link> para enviar mensajes o solicitar contacto.
            </p>
          )}

          {(negocio?.banner_url || items.length > 0 || (profile.es_pro && negocio)) && (
            <div className="mt-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                <Store size={18} className="text-amber-400" />
                Tienda / Portafolio
              </h2>
              {profile.es_pro && negocio && (
                <div className="mb-4">
                  <BusinessLocationDisplay
                    maps_address={negocio.maps_address as string | null | undefined}
                    lat={negocio.lat as number | null | undefined}
                    lng={negocio.lng as number | null | undefined}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((item, index) => (
                  <img
                    key={index}
                    src={item}
                    alt={`Trabajo ${index + 1}`}
                    className="aspect-square rounded-xl object-cover"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
