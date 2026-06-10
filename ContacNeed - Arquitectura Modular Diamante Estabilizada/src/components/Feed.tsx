import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { PostCard } from './PostCard'
import { fetchPublicPosts } from '../lib/posts-client'
import { createPostFn } from '../server/posts.functions'
import type { MexicoState } from '../lib/mexico-states'

type FeedProps = {
  selectedState: MexicoState | ''
}

export function Feed({ selectedState }: FeedProps) {
  const queryClient = useQueryClient()

  const postsQuery = useQuery({
    queryKey: ['posts', selectedState],
    queryFn: () => fetchPublicPosts(selectedState || undefined),
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  })

  const createPostMutation = useMutation({
    mutationFn: (payload: { content: string; mediaUrl?: string; imageUrl?: string; videoUrl?: string; estado?: string }) =>
      createPostFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Pizarra de Servicios</h2>
          <p className="text-sm text-gray-500">
            {selectedState ? `Mostrando publicaciones en ${selectedState}` : 'Mostrando todas las publicaciones'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => postsQuery.refetch()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      <Composer
        selectedState={selectedState}
        isSubmitting={createPostMutation.isPending}
        onSubmit={(payload) => createPostMutation.mutate(payload)}
      />

      {postsQuery.isLoading && <p className="text-sm text-gray-500">Cargando publicaciones...</p>}
      {postsQuery.isError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          No se pudo cargar el feed. Usa el botón Actualizar para reintentar.
        </p>
      )}

      {(postsQuery.data ?? []).length === 0 && !postsQuery.isLoading && !postsQuery.isError && (
        <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          No hay publicaciones en este estado todavía. Prueba cambiar el filtro a &quot;Todos los estados&quot; o publica la primera.
        </p>
      )}

      {(postsQuery.data ?? []).map((post) => (
        <PostCard
          key={post.id}
          post={post}
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
    </section>
  )
}

function Composer({
  selectedState,
  isSubmitting,
  onSubmit,
}: {
  selectedState: MexicoState | ''
  isSubmitting: boolean
  onSubmit: (payload: {
    content: string
    mediaUrl?: string
    imageUrl?: string
    videoUrl?: string
    estado?: string
  }) => void
}) {
  return (
    <form
      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const formData = new FormData(form)
        const nextContent = String(formData.get('content') ?? '').trim()
        const nextMedia = String(formData.get('mediaUrl') ?? '').trim()

        if (!nextContent && !nextMedia) return

        onSubmit({
          content: nextContent,
          mediaUrl: nextMedia || undefined,
          imageUrl: nextMedia || undefined,
          videoUrl: nextMedia || undefined,
          estado: selectedState || undefined,
        })

        form.reset()
      }}
    >
      <textarea
        name="content"
        rows={3}
        placeholder="Comparte tu trabajo, consejo o servicio..."
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          name="mediaUrl"
          type="url"
          placeholder="URL de imagen, Cloudinary o YouTube"
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-600 disabled:opacity-50"
        >
          {isSubmitting ? 'Publicando...' : 'Publicar'}
        </button>
      </div>
    </form>
  )
}
