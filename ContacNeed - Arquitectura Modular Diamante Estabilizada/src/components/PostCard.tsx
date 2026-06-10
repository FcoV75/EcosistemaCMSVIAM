import { useState } from 'react'
import { ThumbsUp, ThumbsDown, MessageCircle, Share2, BadgeCheck, MoreHorizontal, Trash2, Edit2, ShieldAlert } from 'lucide-react'
import { useIdentity } from '../lib/identity-context'
import { updatePostFn, deletePostFn, addCommentFn, reportContentFn } from '../server/posts.functions'
import { hasPostMedia, PostMedia } from './PostMedia'

export function PostCard({
  post,
  author,
  initialLikes,
  initialComments,
  onChanged,
}: any) {
  const { user } = useIdentity()

  const [likes, setLikes] = useState(initialLikes || post.likes || 0)
  const [dislikes, setDislikes] = useState(0)
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(initialComments || post.comments || 0)
  const [commentList, setCommentList] = useState<{ id: string; text: string; user_id: string }[]>(
    post.commentList || [],
  )

  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content || '')

  const isAuthor = user?.id === post.professionalId || post.professionalId === 'current-user'

  const invalidateFeed = () => {
    onChanged?.()
  }

  const handleDelete = async () => {
    if (confirm('¿Seguro que quieres eliminar esta publicación? Esta acción no se puede deshacer.')) {
      try {
        await deletePostFn({ data: { id: post.id } })
        alert('Publicación eliminada')
        invalidateFeed()
      } catch {
        alert('Error al eliminar')
      }
    }
  }

  const handleEdit = async () => {
    try {
      await updatePostFn({ data: { id: post.id, content: editContent } })
      setIsEditing(false)
      invalidateFeed()
    } catch (e: any) {
      alert(e.message || 'Error al actualizar')
    }
  }

  const handleReport = async () => {
    if (!user) {
      alert('Debes iniciar sesión para reportar contenido')
      return
    }
    if (confirm('¿Quieres reportar esta publicación al administrador por contenido inapropiado?')) {
      try {
        await reportContentFn({
          data: { postId: post.id, reporterId: user.id, reason: 'Contenido Inapropiado' },
        })
        alert('Reporte enviado a moderación. Gracias por cuidar ContacNeed.')
        setShowMenu(false)
        invalidateFeed()
      } catch {
        alert('Error al reportar')
      }
    }
  }

  return (
    <article className="cn-glass overflow-hidden rounded-2xl border border-purple-500/20 break-words shadow-xl shadow-purple-900/15 transition hover:border-purple-400/30">
      <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-start">
        <div className="flex items-center gap-3 sm:items-start">
          <img
            src={author.avatar}
            alt={author.name}
            className="h-12 w-12 rounded-full border-2 border-amber-400/30 object-cover"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="cursor-pointer font-bold text-white hover:text-amber-200">{author.name}</h4>
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
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 text-purple-300/60 hover:text-white">
            <MoreHorizontal size={20} />
          </button>

          {showMenu && (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-purple-500/30 bg-slate-900 py-1 shadow-xl">
              {isAuthor ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(true)
                      setShowMenu(false)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-purple-100 transition-colors hover:bg-purple-900/50"
                  >
                    <Edit2 size={16} /> Editar
                  </button>
                  <button
                    onClick={() => {
                      handleDelete()
                      setShowMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={16} /> Eliminar
                  </button>
                </>
              ) : (
                <button
                  onClick={handleReport}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
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
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsEditing(false)}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleEdit}
                className="text-sm font-bold bg-amber-500 text-slate-900 px-3 py-1 rounded-lg"
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
            onClick={() => setLikes(likes + 1)}
            className="flex items-center gap-1.5 text-purple-200/60 transition-colors hover:text-sky-400"
          >
            <ThumbsUp size={20} /> <span className="text-sm font-medium">{likes}</span>
          </button>
          <button
            onClick={() => setDislikes(dislikes + 1)}
            className="flex items-center gap-1.5 text-purple-200/60 transition-colors hover:text-red-400"
          >
            <ThumbsDown size={20} /> <span className="text-sm font-medium">{dislikes > 0 ? dislikes : ''}</span>
          </button>
          <button
            onClick={() => setShowCommentInput(!showCommentInput)}
            className="flex items-center gap-1.5 text-purple-200/60 transition-colors hover:text-amber-300"
          >
            <MessageCircle size={20} /> <span className="text-sm font-medium">{comments}</span>
          </button>
          <div className="flex-1"></div>
          <button
            onClick={() => alert('Enlace de la publicación copiado')}
            className="flex items-center gap-1.5 text-purple-200/60 transition-colors hover:text-emerald-400"
          >
            <Share2 size={20} /> <span className="text-sm font-medium hidden sm:inline">Compartir</span>
          </button>
        </div>
      </div>

      {showCommentInput && (
        <div className="bg-slate-900/40 px-4 pb-4 pt-3">
          {commentList.map((c) => (
            <div key={c.id} className="group mb-2 rounded-lg border border-purple-500/15 bg-slate-900/60 p-2 text-sm shadow-sm">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 whitespace-pre-wrap">{c.text}</div>
                {user?.id === c.user_id && (
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        const newText = prompt('Editar comentario:', c.text)
                        if (newText && newText.trim()) {
                          setCommentList((prev: any[]) =>
                            prev.map((item: any) =>
                              item.id === c.id ? { ...item, text: newText.trim() } : item,
                            ),
                          )
                        }
                      }}
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('¿Seguro que quieres eliminar este comentario?')) {
                          setCommentList((prev: any[]) => prev.filter((item: any) => item.id !== c.id))
                          setComments((prev: number) => prev - 1)
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escribe un comentario..."
              className="flex-1 rounded-full border border-purple-500/30 bg-slate-900/80 px-4 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && comment.trim() && user?.id) {
                  const newC = { text: comment.trim(), user_id: user.id }
                  try {
                    await addCommentFn({ data: { postId: post.id, comment: newC } })
                    setCommentList([...commentList, { id: Math.random().toString(), ...newC }])
                    setComments((prev: number) => prev + 1)
                    setComment('')
                  } catch {
                    alert('Error al comentar')
                  }
                }
              }}
            />
            <button
              onClick={async () => {
                if (!user) {
                  alert('Debes iniciar sesión para comentar')
                  return
                }
                if (comment.trim() && user.id) {
                  const newC = { text: comment.trim(), user_id: user.id }
                  try {
                    await addCommentFn({ data: { postId: post.id, comment: newC } })
                    setCommentList([...commentList, { id: Math.random().toString(), ...newC }])
                    setComments((prev: number) => prev + 1)
                    setComment('')
                  } catch {
                    alert('Error al comentar')
                  }
                }
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-1.5 rounded-full font-bold text-sm"
            >
              Comentar
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
