import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ThumbsUp, ThumbsDown, MessageCircle, Share2, BadgeCheck, MoreHorizontal, Trash2, Edit2, ShieldAlert } from 'lucide-react'
import { useIdentity } from '../lib/identity-context'
import {
  updatePostFn,
  deletePostFn,
  addCommentFn,
  reportContentFn,
  getCommentsFn,
  toggleReactionFn,
} from '../server/posts.functions'
import { hasPostMedia, PostMedia } from './PostMedia'
import { SharePostModal } from './SharePostModal'

type CommentRow = {
  id: string
  text: string
  user_id: string
  author_name?: string
  author_avatar?: string | null
  created_at?: string | null
}

export function PostCard({ post, author, onChanged }: any) {
  const { user } = useIdentity()

  const [likes, setLikes] = useState(post.likes || 0)
  const [dislikes, setDislikes] = useState(post.dislikes || 0)
  const [userReaction, setUserReaction] = useState<'like' | 'dislike' | null>(post.userReaction ?? null)
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(post.comments || 0)
  const [commentList, setCommentList] = useState<CommentRow[]>(post.commentList || [])
  const [loadingComments, setLoadingComments] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [reacting, setReacting] = useState(false)

  useEffect(() => {
    setLikes(post.likes || 0)
    setDislikes(post.dislikes || 0)
    setUserReaction(post.userReaction ?? null)
    setComments(post.comments || 0)
  }, [post.likes, post.dislikes, post.userReaction, post.comments])

  useEffect(() => {
    if (!showCommentInput) return

    let cancelled = false
    setLoadingComments(true)
    getCommentsFn({ data: { postId: post.id } })
      .then((rows) => {
        if (!cancelled) {
          setCommentList(rows)
          setComments(rows.length)
        }
      })
      .catch(() => {
        if (!cancelled) setCommentList([])
      })
      .finally(() => {
        if (!cancelled) setLoadingComments(false)
      })

    return () => {
      cancelled = true
    }
  }, [showCommentInput, post.id])

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
    setReacting(true)
    try {
      const result = await toggleReactionFn({ data: { postId: post.id, tipo } })
      setLikes(result.likes)
      setDislikes(result.dislikes)
      setUserReaction(result.userReaction)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo guardar tu reacción')
    } finally {
      setReacting(false)
    }
  }

  const appendComment = (newC: CommentRow) => {
    setCommentList((prev) => [...prev, newC])
    setComments((prev) => prev + 1)
    setComment('')
  }

  const submitComment = async () => {
    if (!user) {
      alert('Debes iniciar sesión para comentar')
      return
    }
    if (!comment.trim()) return
    try {
      const result = await addCommentFn({ data: { postId: post.id, comment: { text: comment.trim() } } })
      appendComment(result.comment)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al comentar')
    }
  }

  return (
    <article className="cn-glass overflow-hidden rounded-2xl border border-purple-500/20 break-words shadow-xl shadow-purple-900/15 transition hover:border-purple-400/30">
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
            <Share2 size={20} /> <span className="hidden text-sm font-medium sm:inline">Compartir</span>
          </button>
        </div>
      </div>

      {showCommentInput && (
        <div className="bg-slate-900/40 px-4 pb-4 pt-3">
          {loadingComments && <p className="mb-2 text-xs text-purple-200/50">Cargando comentarios...</p>}
          {commentList.map((c) => (
            <div
              key={c.id}
              className="group mb-2 rounded-lg border border-purple-500/15 bg-slate-900/60 p-2 text-sm shadow-sm"
            >
              <div className="mb-1 flex items-center gap-2">
                <Link to="/u/$userId" params={{ userId: c.user_id }}>
                  <img
                    src={c.author_avatar || `https://i.pravatar.cc/40?u=${c.user_id}`}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover"
                  />
                </Link>
                <Link
                  to="/u/$userId"
                  params={{ userId: c.user_id }}
                  className="text-xs font-bold text-amber-200/90 hover:text-amber-100"
                >
                  {c.author_name ?? 'Usuario'}
                </Link>
              </div>
              <div className="whitespace-pre-wrap pl-9 text-purple-50/90">{c.text}</div>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escribe un comentario..."
              className="flex-1 rounded-full border border-purple-500/30 bg-slate-900/80 px-4 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitComment()
              }}
            />
            <button
              type="button"
              onClick={() => void submitComment()}
              className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-bold text-slate-950 hover:bg-amber-600"
            >
              Comentar
            </button>
          </div>
        </div>
      )}

      <SharePostModal
        open={showShare}
        onClose={() => setShowShare(false)}
        postId={post.id}
        excerpt={post.content?.slice(0, 120) ?? 'Publicación en ContacNeed'}
      />
    </article>
  )
}
