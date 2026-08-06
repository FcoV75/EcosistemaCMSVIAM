import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Camera, Settings, HelpCircle, Store, Image as ImageIcon, Sparkles, X, Plus, LogOut, Crown, BarChart3, BookOpen } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { BusinessLocationPanel } from '../components/BusinessLocationPanel'
import { PlanComparison } from '../components/PlanComparison'
import { SmartGuidePanel } from '../components/NewUserGuide'
import { useUser } from '../store/userContext'
import { useIdentity } from '../lib/identity-context'
import { buildCursoPromotoresUrl } from '../lib/curso-promotores-url'
import { uploadFileToCloudinary } from '../lib/cloudinary-upload'
import { DEFAULT_BROWSE_FILTER, type MexicoState } from '../lib/mexico-states'
import { FREE_TIENDA_MAX_ITEMS } from '../lib/plan-limits'
import { getServerUserFn, signOutFn } from '../server/auth.functions'
import { getNegocioFn, updateNegocioFn } from '../server/negocios.functions'
import { getPlanUsageFn, requestProExtraAdsFn } from '../server/plan.functions'
import { canjearPuntosMensualidadFn, getMiGamificacionFn } from '../server/gamificacion.functions'
import { generateProMarketReportFn } from '../server/pro-reports.functions'
import { getCursoPromotoresAccessFn } from '../server/promotores.functions'

export const Route = createFileRoute('/profile')({
  beforeLoad: async () => {
    const user = await getServerUserFn()
    if (!user) throw redirect({ to: '/' })
    return { user }
  },
  loader: async ({ context }) => {
    const negocio = await getNegocioFn({ data: context.user.id })
    return { negocio }
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { negocio } = Route.useLoaderData()
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_BROWSE_FILTER)
  const [showStripeModal, setShowStripeModal] = useState(false)

  return (
    <AppShell
      selectedState={selectedState}
      onStateChange={setSelectedState}
      showStripeModal={showStripeModal}
      onOpenStripe={() => setShowStripeModal(true)}
      onCloseStripe={() => setShowStripeModal(false)}
    >
      <ProfileContent negocio={negocio} onOpenStripe={() => setShowStripeModal(true)} />
    </AppShell>
  )
}

function ProfileContent({
  negocio,
  onOpenStripe,
}: {
  negocio: Awaited<ReturnType<typeof getNegocioFn>>
  onOpenStripe: () => void
}) {
  const { profileData, setProfileData, saveProfileData } = useUser()
  const { isPro } = useIdentity()
  const planQuery = useQuery({ queryKey: ['plan-usage'], queryFn: () => getPlanUsageFn() })
  const cursoPromotoresQuery = useQuery({
    queryKey: ['curso-promotores-access'],
    queryFn: () => getCursoPromotoresAccessFn(),
    retry: false,
  })
  const gamificacionQuery = useQuery({
    queryKey: ['mi-gamificacion'],
    queryFn: () => getMiGamificacionFn(),
  })
  const [openingCurso, setOpeningCurso] = useState(false)
  const openCursoPromotores = async () => {
    setOpeningCurso(true)
    try {
      const url = await buildCursoPromotoresUrl()
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo abrir el curso')
    } finally {
      setOpeningCurso(false)
    }
  }
  const canjeMutation = useMutation({
    mutationFn: () => canjearPuntosMensualidadFn(),
    onSuccess: (r) => {
      alert(`¡Mensualidad PRO activada! Te quedan ${r.puntosRestantes} puntos.`)
      gamificacionQuery.refetch()
      planQuery.refetch()
    },
    onError: (e) => alert(e instanceof Error ? e.message : 'No se pudo canjear'),
  })
  const reportMutation = useMutation({
    mutationFn: () => generateProMarketReportFn(),
    onSuccess: (result) => {
      alert(`${result.preview}...\n\nInforme completo enviado a tu bandeja en Mensajes.`)
    },
    onError: (error) => alert(error instanceof Error ? error.message : 'No se pudo generar el informe'),
  })
  const extraAdsMutation = useMutation({
    mutationFn: () => requestProExtraAdsFn(),
    onSuccess: (result) => alert(result.message),
    onError: (error) => alert(error instanceof Error ? error.message : 'No se pudo solicitar'),
  })
  const [activeTab, setActiveTab] = useState<'perfil' | 'negocio' | 'guia'>('perfil')
  const [storePrompt, setStorePrompt] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingStore, setIsSavingStore] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingItem, setUploadingItem] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const bannerInputRef = useRef<HTMLInputElement>(null)
  const itemInputRef = useRef<HTMLInputElement>(null)

  const [bannerUrl, setBannerUrl] = useState(negocio?.banner_url || '')
  const [items, setItems] = useState<string[]>(Array.isArray(negocio?.items) ? (negocio.items as string[]) : [])
  const [mapsAddress, setMapsAddress] = useState(negocio?.maps_address || '')
  const [mapsLat, setMapsLat] = useState(
    typeof negocio?.lat === 'number' ? negocio.lat : null,
  )
  const [mapsLng, setMapsLng] = useState(
    typeof negocio?.lng === 'number' ? negocio.lng : null,
  )

  const handleUpdateNegocio = async (newBanner: string, newItems: string[]) => {
    setIsSavingStore(true)
    try {
      await updateNegocioFn({ data: { banner_url: newBanner, items: newItems } })
    } catch (e) {
      console.error('Error saving negocio:', e)
      alert(e instanceof Error ? e.message : 'No se pudo guardar la tienda. Intenta de nuevo.')
    } finally {
      setIsSavingStore(false)
    }
  }

  const handleBannerFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingBanner(true)
    try {
      const url = await uploadFileToCloudinary(file)
      setBannerUrl(url)
      await handleUpdateNegocio(url, items)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo subir el banner')
    } finally {
      setUploadingBanner(false)
      if (bannerInputRef.current) bannerInputRef.current.value = ''
    }
  }

  const handleItemFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingItem(true)
    try {
      const url = await uploadFileToCloudinary(file)
      const newItems = [...items, url]
      setItems(newItems)
      await handleUpdateNegocio(bannerUrl, newItems)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo subir la imagen')
    } finally {
      setUploadingItem(false)
      if (itemInputRef.current) itemInputRef.current.value = ''
    }
  }

  const handleBannerUpload = () => {
    bannerInputRef.current?.click()
  }

  const handleAddItem = () => {
    if (!isPro && items.length >= FREE_TIENDA_MAX_ITEMS) {
      alert(
        `Plan gratuito: máximo ${FREE_TIENDA_MAX_ITEMS} productos. Activa PRO para una tienda completa.`,
      )
      return
    }
    itemInputRef.current?.click()
  }

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    handleUpdateNegocio(bannerUrl, newItems);
  }

  const handleGenerateStoreIdeas = async () => {
    if (!storePrompt) return
    setIsGenerating(true)
    setTimeout(() => {
      setAiSuggestions(`
        <div class="space-y-4">
          <h4 class="font-bold text-lg text-slate-900">Sugerencias para tu Tienda:</h4>
          <ul class="list-disc pl-5 space-y-2 text-slate-700">
            <li><strong>Colores:</strong> Usa tonos azules y grises para transmitir confianza.</li>
            <li><strong>Sección Destacada:</strong> Agrega fotos de antes/después de tus trabajos.</li>
            <li><strong>Llamado a la acción:</strong> "Cotización gratis por ContacNeed".</li>
          </ul>
        </div>
      `)
      setIsGenerating(false)
    }, 1500)

  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const url = await uploadFileToCloudinary(file)
      const next = { ...profileData, avatar: url }
      setProfileData(next)
      await saveProfileData(next)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo subir el avatar')
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  return (
    <>
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBannerFile}
      />
      <input
        ref={itemInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleItemFile}
      />

    <div className="flex flex-col gap-6 md:flex-row">
      {/* Menú Lateral */}
      <div className="md:w-64 flex-shrink-0">
        <div className="sticky top-24 overflow-hidden rounded-2xl border border-gray-100 bg-white text-slate-900 shadow-sm">
          <div className="p-6 flex flex-col items-center border-b border-gray-100">
            <div className="relative mb-4">
              <img src={profileData.avatar || "https://i.pravatar.cc/150?u=current"} alt="Mi Perfil" className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover" />
              <label className="absolute bottom-0 right-0 bg-amber-500 text-slate-950 p-1.5 rounded-full shadow-lg hover:bg-amber-600 transition-colors cursor-pointer">
                <Camera size={16} />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
              </label>
              {uploadingAvatar && (
                <p className="absolute -bottom-6 left-0 right-0 text-center text-[10px] text-gray-500">Subiendo...</p>
              )}
            </div>
            <h3 className="font-bold text-lg text-slate-900">{profileData.name}</h3>
            <p className="text-sm text-gray-500">
              {isPro ? 'Usuario PRO' : 'Plan gratuito'}
            </p>
            {!isPro && (
              <button
                type="button"
                onClick={onOpenStripe}
                className="mt-2 rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-amber-600"
              >
                Activar PRO
              </button>
            )}
          </div>
          <div className="p-2 space-y-1">
            <button 
              onClick={() => setActiveTab('perfil')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'perfil' ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <Settings size={18} /> Configurar Perfil
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('negocio')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'negocio' ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <Store size={18} /> Mi Negocio / Tienda
            </button>
            <button 
              onClick={() => setActiveTab('guia')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'guia' ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <HelpCircle size={18} /> Guía de Uso (IA)
            </button>
            {cursoPromotoresQuery.data?.ok && (
              <button
                type="button"
                onClick={openCursoPromotores}
                disabled={openingCurso}
                className="flex w-full items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
              >
                <BookOpen size={18} />
                {openingCurso ? 'Abriendo curso...' : 'Curso Promotores'}
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                setSigningOut(true)
                try {
                  await signOutFn()
                  window.location.href = '/'
                } catch {
                  setSigningOut(false)
                  alert('No se pudo cerrar la sesión')
                }
              }}
              disabled={signingOut}
              className="mt-2 flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <LogOut size={18} />
              {signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 rounded-2xl border border-gray-100 bg-white text-slate-900 shadow-sm min-h-[600px] overflow-hidden">
        {activeTab === 'perfil' && (
          <div className="p-6 md:p-8 animate-in fade-in">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Perfil Personal</h2>
              <p className="text-gray-500">Actualiza tu información para que la comunidad te encuentre más fácil.</p>
            </div>

            {cursoPromotoresQuery.data?.ok && (
              <div className="mb-8 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-amber-50 p-5">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <BookOpen size={18} className="text-sky-700" />
                  Acceso Promotor VIAM
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Estás matriculado como{' '}
                  <strong>
                    {cursoPromotoresQuery.data.rol === 'fundador'
                      ? 'fundador'
                      : cursoPromotoresQuery.data.rol === 'admin'
                        ? 'admin'
                        : 'promotor'}
                  </strong>
                  . Entra al curso intensivo desde tu perfil activo.
                </p>
                <button
                  type="button"
                  onClick={openCursoPromotores}
                  disabled={openingCurso}
                  className="mt-3 rounded-lg bg-sky-700 px-4 py-2 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {openingCurso ? 'Abriendo...' : 'Abrir Curso Promotores'}
                </button>
              </div>
            )}

            {gamificacionQuery.data && (
              <div className="mb-8 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-purple-50 p-5">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <Sparkles size={18} className="text-amber-600" />
                  Programa de puntos ecosistema
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Comparte tu enlace y gana puntos por registros. Con <strong>100 puntos</strong> obtienes 1 mes PRO gratis.
                </p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${gamificacionQuery.data.progresoMensualidad}%` }}
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-amber-800">
                  {gamificacionQuery.data.puntos} / {gamificacionQuery.data.puntosParaMensualidad} puntos
                </p>
                <p className="mt-2 break-all text-xs text-slate-600">
                  Tu código: <strong>{gamificacionQuery.data.codigoReferido}</strong>
                </p>
                <p className="mt-1 break-all text-xs text-slate-500">{gamificacionQuery.data.enlaceRegistro}</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(gamificacionQuery.data.enlaceRegistro)
                    alert('Enlace copiado. Compártelo en redes para invitar profesionales.')
                  }}
                  className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Copiar enlace de invitación
                </button>
                {gamificacionQuery.data.puntos >= gamificacionQuery.data.puntosParaMensualidad && !isPro && (
                  <button
                    type="button"
                    disabled={canjeMutation.isPending}
                    onClick={() => canjeMutation.mutate()}
                    className="ml-2 mt-3 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
                  >
                    Canjear 1 mes PRO
                  </button>
                )}
              </div>
            )}

            <form className="space-y-6 max-w-2xl" onSubmit={async (e) => {
              e.preventDefault();
              setIsSaving(true);
              try {
                await saveProfileData(profileData);
                alert('Perfil actualizado con éxito');
              } catch (e) {
                console.error('Error detallado capturado en el frontend:', e)
                alert(e instanceof Error ? e.message : 'Error al actualizar el perfil')
              } finally {
                setIsSaving(false);
              }
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                  <input type="text" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título o Especialidad</label>
                  <input type="text" value={profileData.title} onChange={e => setProfileData({...profileData, title: e.target.value})} placeholder="Ej. Maestro Plomero" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación (Ciudad, Estado)</label>
                  <input type="text" value={profileData.location} onChange={e => setProfileData({...profileData, location: e.target.value})} placeholder="Ej. Guadalajara, Jalisco" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-amber-500 focus:ring-amber-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción Breve</label>
                  <textarea rows={4} value={profileData.description} onChange={e => setProfileData({...profileData, description: e.target.value})} placeholder="Describe tus habilidades..." className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-amber-500 focus:ring-amber-500"></textarea>
                </div>
              </div>
              <button type="submit" disabled={isSaving} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'negocio' && (
          <div className="p-6 md:p-8 animate-in fade-in">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Diseña tu Tienda / Negocio</h2>
                <p className="text-gray-500">
                  {isPro
                    ? 'Tienda PRO ampliada, ubicación GPS en Maps, informes de mercado y más visibilidad.'
                    : `Plan gratuito: 1 banner, hasta ${FREE_TIENDA_MAX_ITEMS} imágenes, IA de tienda, 15 posts/día y bandeja de mensajes.`}
                </p>
              </div>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                  isPro ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {isPro ? 'Pro' : 'Gratis'}
              </span>
            </div>

            {!isPro && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-900">
                  Tu plan gratuito incluye tienda básica, IA de sugerencias, mensajes y 15 publicaciones diarias.
                  PRO desbloquea chat en vivo, Maps GPS, 30 posts/día e informes de mercado.
                </p>
                <button
                  type="button"
                  onClick={onOpenStripe}
                  className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-600"
                >
                  Activar PRO
                </button>
              </div>
            )}

            {planQuery.data && (
              <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p>{planQuery.data.posts.label}</p>
                <p className="mt-1">
                  Tienda: {planQuery.data.store.used}/{planQuery.data.store.limit} imágenes
                  {planQuery.data.isPro
                    ? ` · Anuncios PRO: ${planQuery.data.proAds.active}/${planQuery.data.proAds.max}`
                    : ''}
                </p>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3">
                <Sparkles className="text-amber-500" size={20} /> Asistente de Diseño IA
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Describe tu negocio y recibe sugerencias de colores, secciones y textos (incluido en plan gratuito).
              </p>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={storePrompt}
                  onChange={(e) => setStorePrompt(e.target.value)}
                  placeholder="Ej. Soy carpintero y quiero destacar mis servicios 24/7..." 
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-500 focus:ring-amber-500"
                />
                <button 
                  onClick={handleGenerateStoreIdeas}
                  disabled={isGenerating || !storePrompt}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isGenerating ? 'Generando...' : 'Recomendar'}
                </button>
              </div>
              {aiSuggestions && (
                <div className="mt-6 bg-white p-4 rounded-lg border border-amber-100 shadow-sm" dangerouslySetInnerHTML={{ __html: aiSuggestions }}></div>
              )}
            </div>

            {isPro && (
              <>
                <BusinessLocationPanel
                  initialAddress={mapsAddress}
                  initialLat={mapsLat}
                  initialLng={mapsLng}
                  onSave={async (payload) => {
                    await updateNegocioFn({
                      data: {
                        banner_url: bannerUrl,
                        items,
                        maps_address: payload.maps_address,
                        lat: payload.lat,
                        lng: payload.lng,
                      },
                    })
                    setMapsAddress(payload.maps_address)
                    setMapsLat(payload.lat)
                    setMapsLng(payload.lng)
                  }}
                />

                <div className="my-8 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => reportMutation.mutate()}
                    disabled={reportMutation.isPending}
                    className="flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <BarChart3 size={18} />
                    {reportMutation.isPending ? 'Generando informe...' : 'Informe PRO de tendencias'}
                  </button>
                  <button
                    type="button"
                    onClick={() => extraAdsMutation.mutate()}
                    disabled={extraAdsMutation.isPending}
                    className="flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 disabled:opacity-50"
                  >
                    <Crown size={18} />
                    Solicitar +5 anuncios ($500 MXN)
                  </button>
                </div>
              </>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Banner Principal</label>
                {bannerUrl ? (
                  <div className="relative h-32 rounded-xl overflow-hidden group">
                    <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={handleBannerUpload} className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold">Cambiar</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={handleBannerUpload} className="h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex flex-col items-center">
                      <ImageIcon size={24} className="mb-2" />
                      <span>{uploadingBanner ? 'Subiendo banner...' : 'Subir imagen de portada'}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Servicios o Productos Destacados</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item, index) => (
                    <div key={index} className="relative h-32 border border-gray-200 rounded-xl overflow-hidden group bg-white">
                      <img src={item} alt={`Item ${index}`} className="w-full h-full object-cover" />
                      <button onClick={() => handleRemoveItem(index)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {(isPro || items.length < FREE_TIENDA_MAX_ITEMS) && (
                  <div onClick={handleAddItem} className="border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-center h-32 bg-white hover:border-amber-500 cursor-pointer transition-colors">
                    <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-2">
                      <Plus size={20} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {uploadingItem ? 'Subiendo...' : 'Agregar Item'}
                    </span>
                  </div>
                  )}
                </div>
                <div className="mt-8">
                  <button 
                    onClick={() => handleUpdateNegocio(bannerUrl, items)} 
                    disabled={isSavingStore}
                    className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    {isSavingStore ? 'Publicando...' : 'GUARDAR CAMBIOS DE TIENDA'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'guia' && (
          <div className="p-6 md:p-8 animate-in fade-in">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Guía de Uso Inteligente</h2>
              <p className="text-gray-500">
                Aprende las funciones básicas de ContacNeed con consejos adaptados a tu perfil.
              </p>
            </div>
            <SmartGuidePanel />
            <div className="mt-8">
              <PlanComparison isPro={isPro} />
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
