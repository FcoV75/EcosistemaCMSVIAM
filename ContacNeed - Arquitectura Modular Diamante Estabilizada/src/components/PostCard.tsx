import { useEffect, useState, useCallback } from 'react'

import { Link } from '@tanstack/react-router'

import { ThumbsUp, ThumbsDown, MessageCircle, Share2, BadgeCheck, MoreHorizontal, Trash2, Edit2, ShieldAlert } from 'lucide-react'

import { useIdentity } from '../lib/identity-context'

import {

  updatePostFn,

  deletePostFn,

  reportContentFn,

  toggleReactionFn,

} from '../server/posts.functions'

import { CommentSection } from './CommentSection'

import { hasPostMedia, PostMedia } from './PostMedia'

import { SharePostModal } from './SharePostModal'



export function PostCard({ post, author, onChanged, highlighted = false }: any) {

  const { user } = useIdentity()



  const [likes, setLikes] = useState(post.likes || 0)

  const [dislikes, setDislikes] = useState(post.dislikes || 0)

  const [userReaction, setUserReaction] = useState<'like' | 'dislike' | null>(post.userReaction ?? null)

  const [showCommentInput, setShowCommentInput] = useState(false)

  const [comments, setComments] = useState(post.comments || 0)

  const [shares, setShares] = useState(post.shares || 0)

  const [showShare, setShowShare] = useState(false)

  const [reacting, setReacting] = useState(false)

  const handleCommentCount = useCallback((count: number) => {
    setComments(count)
  }, [])



  useEffect(() => {

    setLikes(post.likes || 0)

    setDislikes(post.dislikes || 0)

    setUserReaction(post.userReaction ?? null)

    setComments(post.comments || 0)

    setShares(post.shares || 0)

  }, [post.likes, post.dislikes, post.userReaction, post.comments, post.shares])



  const [showMenu, setShowMenu] = useState(false)

  const [isEditing, setIsEditing] = useState(false)

  const [editContent, setEditContent] = useState(post.content || '')



  const profileId = post.professionalId

  const isAuthor = user?.id === profileId



  const handleReaction = async (tipo: 'like' | 'dislike') => {

    if (!user) {

      alert('Debes iniciar sesión para reaccionar')

      return

    }

    const prevLikes = likes
    const prevDislikes = dislikes
    const prevReaction = userReaction

    let nextLikes = likes
    let nextDislikes = dislikes
    let nextReaction: 'like' | 'dislike' | null = tipo
    if (prevReaction === tipo) {
      nextReaction = null
      if (tipo === 'like') nextLikes = Math.max(0, likes - 1)
      else nextDislikes = Math.max(0, dislikes - 1)
    } else if (prevReaction === 'like' && tipo === 'dislike') {
      nextLikes = Math.max(0, likes - 1)
      nextDislikes = dislikes + 1
    } else if (prevReaction === 'dislike' && tipo === 'like') {
      nextDislikes = Math.max(0, dislikes - 1)
      nextLikes = likes + 1
    } else if (tipo === 'like') {
      nextLikes = likes + 1
    } else {
      nextDislikes = dislikes + 1
    }
    setLikes(nextLikes)
    setDislikes(nextDislikes)
    setUserReaction(nextReaction)

    setReacting(true)

    try {

      const result = await toggleReactionFn({ data: { postId: post.id, tipo } })

      setLikes(result.likes)

      setDislikes(result.dislikes)

      setUserReaction(result.userReaction)

    } catch (error) {

      setLikes(prevLikes)
      setDislikes(prevDislikes)
      setUserReaction(prevReaction)
      alert(error instanceof Error ? error.message : 'No se pudo guardar tu reacción')

    } finally {

      setReacting(false)

    }

  }



  return (

    <article
      id={`post-${post.id}`}
      className={`cn-glass overflow-hidden rounded-2xl border break-words shadow-xl shadow-purple-900/15 transition hover:border-purple-400/30 ${
        highlighted
          ? 'border-amber-400/70 ring-2 ring-amber-400/40'
          : 'border-purple-500/20'
      }`}
    >

      <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-start">

        <div className="flex items-center gap-3 sm:items-start">

          <Link to="/u/$userId" params={{ userId: profileId }}>

            <img

              src={author.avatar}

              alt={author.name}

              className="h-12 w-12 rounded-full border-2 border-amber-400/30 object-cover"

            />

          </Link>

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-2">

              <Link

                to="/u/$userId"

                params={{ userId: profileId }}

                className="font-bold text-white hover:text-amber-200"

              >

                {author.name}

              </Link>

              {author.verified && (

                <span title="Identidad Validada">

                  <BadgeCheck size={16} className="text-blue-500" />

                </span>

              )}

              {author.isFounder && (

                <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shadow-sm">

                  ✨ Fundador

                </span>

              )}

            </div>

            <p className="text-xs text-purple-200/60">

              {author.title} • {post.timestamp || new Date(post.createdAt || Date.now()).toLocaleDateString()}

              {post.estado ? ` • ${post.estado}` : ''}

            </p>

          </div>

        </div>



        <div className="relative">

          <button type="button" onClick={() => setShowMenu(!showMenu)} className="p-1 text-purple-300/60 hover:text-white">

            <MoreHorizontal size={20} />

          </button>

          {showMenu && (

            <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-purple-500/30 bg-slate-900 py-1 shadow-xl">

              {isAuthor ? (

                <>

                  <button

                    type="button"

                    onClick={() => {

                      setIsEditing(true)

                      setShowMenu(false)

                    }}

                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-purple-100 hover:bg-purple-900/50"

                  >

                    <Edit2 size={16} /> Editar

                  </button>

                  <button

                    type="button"

                    onClick={async () => {

                      if (confirm('¿Seguro que quieres eliminar esta publicación?')) {

                        try {

                          await deletePostFn({ data: { id: post.id } })

                          onChanged?.()

                        } catch {

                          alert('Error al eliminar')

                        }

                      }

                      setShowMenu(false)

                    }}

                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-950/30"

                  >

                    <Trash2 size={16} /> Eliminar

                  </button>

                </>

              ) : (

                <button

                  type="button"

                  onClick={async () => {

                    if (!user) {

                      alert('Debes iniciar sesión para reportar')

                      return

                    }

                    if (confirm('¿Reportar esta publicación al administrador?')) {

                      try {

                        await reportContentFn({ data: { postId: post.id, reporterId: user.id, reason: 'Contenido Inapropiado' } })

                        alert('Reporte enviado. Gracias.')

                        onChanged?.()

                      } catch {

                        alert('Error al reportar')

                      }

                    }

                    setShowMenu(false)

                  }}

                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-amber-400 hover:bg-amber-950/20"

                >

                  <ShieldAlert size={16} /> Reportar al Admin

                </button>

              )}

            </div>

          )}

        </div>

      </div>



      <div className="px-4 pb-3">

        {isEditing ? (

          <div className="space-y-2">

            <textarea

              value={editContent}

              onChange={(e) => setEditContent(e.target.value)}

              className="w-full rounded-lg border border-gray-300 p-2 text-sm text-slate-900"

              rows={3}

            />

            <div className="flex justify-end gap-2">

              <button type="button" onClick={() => setIsEditing(false)} className="text-sm text-slate-400">

                Cancelar

              </button>

              <button

                type="button"

                onClick={async () => {

                  try {

                    await updatePostFn({ data: { id: post.id, content: editContent } })

                    setIsEditing(false)

                    onChanged?.()

                  } catch (e: unknown) {

                    alert(e instanceof Error ? e.message : 'Error al actualizar')

                  }

                }}

                className="rounded-lg bg-amber-500 px-3 py-1 text-sm font-bold text-slate-900"

              >

                Guardar

              </button>

            </div>

          </div>

        ) : (

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-purple-50/90">{post.content}</p>

        )}

      </div>



      {!isEditing && hasPostMedia(post) && (

        <PostMedia

          mediaUrl={post.mediaUrl}

          imageUrl={post.imageUrl}

          videoUrl={post.videoUrl}

          mediaType={post.mediaType}

        />

      )}



      <div className="flex items-center justify-between border-t border-purple-500/15 px-4 py-3">

        <div className="flex w-full gap-4">

          <button

            type="button"

            disabled={reacting}

            onClick={() => handleReaction('like')}

            className={`flex items-center gap-1.5 transition-colors ${

              userReaction === 'like' ? 'text-sky-400' : 'text-purple-200/60 hover:text-sky-400'

            }`}

          >

            <ThumbsUp size={20} /> <span className="text-sm font-medium">{likes}</span>

          </button>

          <button

            type="button"

            disabled={reacting}

            onClick={() => handleReaction('dislike')}

            className={`flex items-center gap-1.5 transition-colors ${

              userReaction === 'dislike' ? 'text-red-400' : 'text-purple-200/60 hover:text-red-400'

            }`}

          >

            <ThumbsDown size={20} /> <span className="text-sm font-medium">{dislikes > 0 ? dislikes : ''}</span>

          </button>

          <button

            type="button"

            onClick={() => setShowCommentInput(!showCommentInput)}

            className="flex items-center gap-1.5 text-purple-200/60 transition-colors hover:text-amber-300"

          >

            <MessageCircle size={20} /> <span className="text-sm font-medium">{comments}</span>

          </button>

          <div className="flex-1" />

          <button

            type="button"

            onClick={() => setShowShare(true)}

            className="flex items-center gap-1.5 text-purple-200/60 transition-colors hover:text-emerald-400"

          >

            <Share2 size={20} /> <span className="text-sm font-medium">{shares > 0 ? shares : <span className="hidden sm:inline">Compartir</span>}</span>

          </button>

        </div>

      </div>



      <CommentSection
        postId={post.id}
        open={showCommentInput}
        onCountChange={handleCommentCount}
      />



      <SharePostModal

        open={showShare}

        onClose={() => setShowShare(false)}

        postId={post.id}

        excerpt={post.content?.slice(0, 120) ?? 'Publicación en ContacNeed'}

        onShared={(count) => setShares(count)}

      />

    </article>

  )

}


