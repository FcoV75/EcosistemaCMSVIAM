import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'

import { Camera, ImageIcon, RefreshCw, Sparkles, X } from 'lucide-react'

import { useEffect, useDeferredValue, useMemo, useRef, useState } from 'react'

import { PostCard } from './PostCard'

import { PeopleSearchResults } from './PeopleSearchResults'

import { Link } from '@tanstack/react-router'

import { useBrowseSearch } from '../lib/browse-context'
import { useIdentity } from '../lib/identity-context'

import { fetchPublicPosts, FEED_PAGE_SIZE } from '../lib/posts-client'

import { uploadFileToCloudinary } from '../lib/cloudinary-upload'

import { createPostFn } from '../server/posts.functions'
import { getPlanUsageFn } from '../server/plan.functions'
import { sugerirPublicacionPizarraFn } from '../server/support.functions'

import type { MexicoState } from '../lib/mexico-states'



type FeedProps = {

  selectedState: MexicoState | ''

  highlightPostId?: string | null

  onHighlightDone?: () => void

}



type MediaPreview = {

  file: File

  url: string

  kind: 'image' | 'video'

}



export function Feed({ selectedState, highlightPostId, onHighlightDone }: FeedProps) {

  const queryClient = useQueryClient()
  const { searchQuery } = useBrowseSearch()
  const deferredSearch = useDeferredValue(searchQuery)
  const { user } = useIdentity()

  const planQuery = useQuery({
    queryKey: ['plan-usage'],
    queryFn: () => getPlanUsageFn(),
    enabled: Boolean(user),
  })



  const postsQuery = useInfiniteQuery({
    queryKey: ['posts', selectedState],
    queryFn: ({ pageParam }) =>
      fetchPublicPosts(selectedState || undefined, { offset: pageParam, limit: FEED_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < FEED_PAGE_SIZE) return undefined
      return allPages.reduce((total, page) => total + page.length, 0)
    },
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  })

  const feedPosts = useMemo(
    () => postsQuery.data?.pages.flat() ?? [],
    [postsQuery.data],
  )

  useEffect(() => {
    if (!highlightPostId || postsQuery.isLoading) return
    const target = document.getElementById(`post-${highlightPostId}`)
    if (!target) return

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    onHighlightDone?.()
  }, [highlightPostId, postsQuery.isLoading, feedPosts, onHighlightDone])

  const loadMoreRef = useRef<HTMLDivElement>(null)
  const fetchingMore = postsQuery.isFetchingNextPage
  const canLoadMore = Boolean(postsQuery.hasNextPage) && !deferredSearch.trim()

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /iPhone|iPod/i.test(navigator.userAgent)) return
    const el = loadMoreRef.current
    if (!el || !canLoadMore || fetchingMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void postsQuery.fetchNextPage()
      },
      { rootMargin: '80px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [canLoadMore, fetchingMore, postsQuery.fetchNextPage])

  const filteredPosts = useMemo(() => {
    const posts = feedPosts
    const q = deferredSearch.trim().toLowerCase()
    if (!q) return posts

    return posts.filter((post) => {
      const haystack = [
        post.content,
        post.authorData.name,
        post.authorData.title,
        post.estado,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [feedPosts, deferredSearch])



  const createPostMutation = useMutation({

    mutationFn: (payload: { content: string; mediaUrl?: string; imageUrl?: string; videoUrl?: string; estado?: string }) =>

      createPostFn({ data: payload }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['plan-usage'] })
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'No se pudo publicar. Verifica tu sesión e intenta de nuevo.')
    },
  })



  return (

    <section className="space-y-5">

      <div className="flex items-center justify-between gap-3">

        <div>

          <h2 className="text-xl font-black text-white">Pizarra de Servicios</h2>

          <p className="text-sm text-purple-200/70">

            {selectedState ? `Publicaciones en ${selectedState}` : 'Todas las publicaciones de México'}

            {searchQuery.trim() ? ` · Buscando “${searchQuery.trim()}”` : ''}

          </p>

        </div>

        <button

          type="button"

          onClick={() => postsQuery.refetch()}

          className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-950/40 px-3 py-2 text-sm font-medium text-purple-100 transition hover:bg-purple-900/50"

        >

          <RefreshCw size={16} />

          Actualizar

        </button>

      </div>



      <Composer

        selectedState={selectedState}

        isSubmitting={createPostMutation.isPending}
        postsRemaining={planQuery.data?.posts.remaining}
        postsLabel={planQuery.data?.posts.label}
        isPro={planQuery.data?.isPro}

        onSubmit={(payload) => createPostMutation.mutate(payload)}

      />

      {deferredSearch.trim().length >= 2 && (
        <PeopleSearchResults query={deferredSearch} selectedState={selectedState} />
      )}

      {deferredSearch.trim().length >= 2 && (
        <h3 className="text-sm font-bold text-white">Publicaciones</h3>
      )}



      {postsQuery.isLoading && (

        <p className="text-sm text-purple-200/60">Cargando publicaciones...</p>

      )}

      {postsQuery.isError && (

        <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">

          No se pudo cargar el feed. Usa el botón Actualizar para reintentar.

          {postsQuery.error instanceof Error && postsQuery.error.message ? (

            <span className="mt-1 block text-xs opacity-80">{postsQuery.error.message}</span>

          ) : null}

        </p>

      )}



      {filteredPosts.length === 0 && !postsQuery.isLoading && !postsQuery.isError && (

        <p className="rounded-xl border border-purple-500/20 bg-slate-900/50 px-4 py-3 text-sm text-purple-200/70">

          {deferredSearch.trim()
            ? `No hay publicaciones para "${deferredSearch.trim()}". Prueba otro término o cambia el estado.`
            : 'No hay publicaciones en este estado todavía. Prueba cambiar el filtro a "Todos los estados" o publica la primera.'}

        </p>

      )}



      <div className="space-y-5">

        {filteredPosts.map((post) => (

          <PostCard

            key={post.id}

            post={post}

            highlighted={highlightPostId === post.id}

            author={{

              name: post.authorData.name,

              avatar: post.authorData.avatar,

              title: post.authorData.title ?? 'Profesional',

              verified: post.authorData.verified,

              isFounder: post.authorData.isFounder,

            }}

            onChanged={() => queryClient.invalidateQueries({ queryKey: ['posts'] })}

          />

        ))}

      </div>

      {canLoadMore && (
        <div ref={loadMoreRef} className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => void postsQuery.fetchNextPage()}
            disabled={fetchingMore}
            className="rounded-xl border border-purple-500/30 bg-purple-950/40 px-4 py-2 text-sm font-medium text-purple-100"
          >
            {fetchingMore ? 'Cargando más…' : 'Cargar más publicaciones'}
          </button>
        </div>
      )}

    </section>

  )

}



function Composer({

  selectedState,

  isSubmitting,
  postsRemaining,
  postsLabel,
  isPro,

  onSubmit,

}: {

  selectedState: MexicoState | ''

  isSubmitting: boolean
  postsRemaining?: number
  postsLabel?: string
  isPro?: boolean

  onSubmit: (payload: {

    content: string

    mediaUrl?: string

    imageUrl?: string

    videoUrl?: string

    estado?: string

  }) => void

}) {

  const { user } = useIdentity()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [content, setContent] = useState('')

  const [mediaUrl, setMediaUrl] = useState('')

  const [preview, setPreview] = useState<MediaPreview | null>(null)

  const [uploading, setUploading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const [suggesting, setSuggesting] = useState(false)

  const [postIdeas, setPostIdeas] = useState<string[]>([])



  const revokePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  const clearPreview = () => {
    revokePreview()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    revokePreview()
    const isVideo =
      file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(file.name)
    const kind = isVideo ? 'video' : 'image'
    setPreview({ file, url: URL.createObjectURL(file), kind })
    setError(null)
  }



  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {

    event.preventDefault()

    const nextContent = content.trim()

    const nextMediaUrl = mediaUrl.trim()



    if (!nextContent && !nextMediaUrl && !preview) return



    setError(null)

    let finalMediaUrl = nextMediaUrl || undefined



    if (preview) {

      setUploading(true)

      try {

        finalMediaUrl = await uploadFileToCloudinary(preview.file)

      } catch (uploadError) {

        setError(uploadError instanceof Error ? uploadError.message : 'Error al subir archivo')

        setUploading(false)

        return

      }

      setUploading(false)

    }



    onSubmit({

      content: nextContent,

      mediaUrl: finalMediaUrl,

      imageUrl: finalMediaUrl,

      videoUrl: finalMediaUrl,

      estado: selectedState || undefined,

    })



    setContent('')

    setMediaUrl('')

    setPostIdeas([])

    clearPreview()

    event.currentTarget.reset()

  }



  const handleSugerirPublicacion = async () => {
    setSuggesting(true)
    setError(null)
    try {
      const result = await sugerirPublicacionPizarraFn({ data: { pista: content.trim() } })
      setPostIdeas(result.ideas)
    } catch (suggestError) {
      setError(suggestError instanceof Error ? suggestError.message : 'No se pudieron sugerir publicaciones.')
    } finally {
      setSuggesting(false)
    }
  }

  const busy = isSubmitting || uploading || suggesting

  if (!user) {
    return (
      <div className="cn-glass overflow-hidden rounded-2xl border border-purple-500/25 p-5 text-center shadow-xl shadow-purple-900/20">
        <p className="text-sm font-semibold text-white">Inicia sesión para publicar en la pizarra</p>
        <p className="mt-1 text-xs text-purple-200/70">
          Comparte tu oficio, servicio o experiencia con la comunidad de tu estado.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            to="/login"
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-bold text-slate-950"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/registro"
            className="rounded-xl border border-amber-400/40 px-5 py-2 text-sm font-semibold text-amber-300"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    )
  }

  return (

    <form

      className="cn-glass overflow-hidden rounded-2xl border border-purple-500/25 shadow-xl shadow-purple-900/20"

      onSubmit={handleSubmit}

    >

      <div className="border-b border-purple-500/15 bg-gradient-to-r from-purple-900/30 to-amber-900/10 px-4 py-2">

        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">Nueva publicación</p>
        {postsLabel && (
          <p className="mt-1 text-[11px] text-purple-200/70">
            {postsLabel}
            {!isPro && typeof postsRemaining === 'number' && postsRemaining <= 3 ? ' · Considera PRO (30/día)' : ''}
          </p>
        )}

      </div>



      <div className="p-4">

        <textarea

          name="content"

          rows={3}

          value={content}

          onChange={(event) => setContent(event.target.value)}

          placeholder="Comparte tu trabajo, consejo o servicio..."

          className="w-full resize-none rounded-xl border border-purple-500/20 bg-slate-900/50 px-3 py-2.5 text-sm text-white placeholder:text-purple-300/40 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"

        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSugerirPublicacion}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
          >
            <Sparkles size={14} />
            {suggesting ? 'Pensando ideas...' : 'Qué publicar'}
          </button>
          <p className="text-[11px] text-purple-200/60">
            Ideas de foto, YouTube o material propio según tu oficio.
          </p>
        </div>

        {postIdeas.length > 0 && (
          <ul className="mt-3 space-y-2">
            {postIdeas.map((idea) => (
              <li key={idea}>
                <button
                  type="button"
                  onClick={() => setContent(idea)}
                  className="w-full rounded-xl border border-purple-500/20 bg-slate-900/60 px-3 py-2 text-left text-xs leading-relaxed text-purple-100 hover:border-amber-400/40 hover:bg-amber-500/10"
                >
                  {idea}
                </button>
              </li>
            ))}
          </ul>
        )}



        {preview && (

          <div className="relative mt-3 overflow-hidden rounded-xl border border-purple-500/25 bg-slate-900/60">

            <button

              type="button"

              onClick={clearPreview}

              className="absolute right-2 top-2 z-10 rounded-full bg-slate-950/80 p-1.5 text-white hover:bg-red-600/80"

              aria-label="Quitar archivo"

            >

              <X size={14} />

            </button>

            {preview.kind === 'video' ? (
              <video
                src={preview.url}
                controls
                preload="metadata"
                playsInline
                muted
                className="max-h-56 w-full bg-black object-contain"
              />
            ) : (

              <img src={preview.url} alt="Vista previa" className="max-h-56 w-full object-contain" />

            )}

            <p className="px-3 py-1.5 text-[11px] text-purple-200/60">{preview.file.name}</p>

          </div>

        )}



        {error && (

          <p className="mt-2 text-xs text-red-300">{error}</p>

        )}



        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">

          <input

            ref={fileInputRef}

            type="file"

            accept="image/*,video/*"

            className="hidden"

            onChange={handleFileChange}

          />



          <button

            type="button"

            onClick={() => fileInputRef.current?.click()}

            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20"

          >

            <Camera size={18} />

            Galería / Cámara

          </button>



          <div className="relative flex flex-1 items-center">

            <ImageIcon size={16} className="pointer-events-none absolute left-3 text-purple-300/40" />

            <input

              name="mediaUrl"

              type="url"

              value={mediaUrl}

              onChange={(event) => setMediaUrl(event.target.value)}

              placeholder="O pega URL de imagen, Cloudinary o YouTube"

              className="w-full rounded-xl border border-purple-500/20 bg-slate-900/50 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-purple-300/40 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"

            />

          </div>



          <button

            type="submit"

            disabled={busy}

            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition hover:brightness-110 disabled:opacity-50"

          >

            {uploading ? 'Subiendo...' : isSubmitting ? 'Publicando...' : 'Publicar'}

          </button>

        </div>

      </div>

    </form>

  )

}


