import { createFileRoute, redirect } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { Camera, Settings, Star, TrendingUp, HelpCircle, Store, MessageSquare, Image as ImageIcon, Sparkles, X, Plus, LogOut } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { useUser } from '../store/userContext'
import { useIdentity } from '../lib/identity-context'
import { uploadFileToCloudinary } from '../lib/cloudinary-upload'
import { DEFAULT_STATE, type MexicoState } from '../lib/mexico-states'
import { getServerUserFn, signOutFn } from '../server/auth.functions'
import { getNegocioFn, updateNegocioFn } from '../server/negocios.functions'

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
  const [selectedState, setSelectedState] = useState<MexicoState | ''>(DEFAULT_STATE)
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
              onClick={() => {
                if (!isPro) {
                  onOpenStripe()
                  return
                }
                setActiveTab('negocio')
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'negocio' ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <Store size={18} /> Mi Negocio / Tienda {!isPro && '🔒'}
            </button>
            <button 
              onClick={() => setActiveTab('guia')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'guia' ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <HelpCircle size={18} /> Guía de Uso (IA)
            </button>
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

        {activeTab === 'negocio' && !isPro && (
          <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
            <Store size={48} className="mb-4 text-amber-500" />
            <h2 className="text-2xl font-bold text-slate-900">Tienda exclusiva PRO</h2>
            <p className="mt-2 max-w-md text-gray-500">
              Activa ContacNeed PRO para diseñar tu mini tienda con banner, galería y mayor visibilidad.
            </p>
            <button
              type="button"
              onClick={onOpenStripe}
              className="mt-6 rounded-xl bg-amber-500 px-6 py-3 font-bold text-slate-950 hover:bg-amber-600"
            >
              Ver planes PRO
            </button>
          </div>
        )}

        {activeTab === 'negocio' && isPro && (
          <div className="p-6 md:p-8 animate-in fade-in">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Diseña tu Tienda / Negocio</h2>
                <p className="text-gray-500">Personaliza tu mini página web. Exclusivo para usuarios Pro.</p>
              </div>
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full uppercase">Pro</span>
            </div>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3">
                <Sparkles className="text-amber-500" size={20} /> Asistente de Diseño IA
              </h3>
              <p className="text-sm text-slate-600 mb-4">Describe qué tipo de negocio tienes y la IA te dará recomendaciones de colores, secciones y textos para tu tienda.</p>
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
                  <div onClick={handleAddItem} className="border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-center h-32 bg-white hover:border-amber-500 cursor-pointer transition-colors">
                    <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-2">
                      <Plus size={20} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {uploadingItem ? 'Subiendo...' : 'Agregar Item'}
                    </span>
                  </div>
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
              <p className="text-gray-500">Consejos personalizados por IA según tu actividad en la red.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                  <TrendingUp size={20} />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Aumenta tu Visibilidad</h3>
                <p className="text-sm text-slate-700 mb-4">Hemos notado que publicas poco contenido visual. Sube fotos de tus trabajos terminados para conseguir un 40% más de interacciones.</p>
                <button className="text-sm font-bold text-blue-600 hover:text-blue-700">Crear Publicación</button>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-6">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                  <Star size={20} />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Aprovecha tu Cuenta Pro</h3>
                <p className="text-sm text-slate-700 mb-4">Aún no has configurado los botones de contacto directo en tu Tienda. Actívalos para que los clientes te llamen al instante.</p>
                <button onClick={() => setActiveTab('negocio')} className="text-sm font-bold text-amber-700 hover:text-amber-800">Ir a Mi Negocio</button>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 md:col-span-2">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare size={20} />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Interactúa con la Comunidad</h3>
                <p className="text-sm text-slate-700 mb-4">Hay 3 nuevas preguntas sobre Plomería en tu ciudad (Guadalajara). Responderlas te posiciona como experto local.</p>
                <button className="text-sm font-bold text-emerald-700 hover:text-emerald-800">Ver Preguntas Locales</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
