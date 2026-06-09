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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden break-words mb-6">
      <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex gap-3 items-center sm:items-start">
          <img src={author.avatar} alt={author.name} className="w-12 h-12 rounded-full object-cover" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-gray-900 hover:text-slate-800 cursor-pointer">{author.name}</h4>
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
            <p className="text-xs text-gray-500">
              {author.title} • {post.timestamp || new Date(post.createdAt || Date.now()).toLocaleDateString()}
              {post.estado ? ` • ${post.estado}` : ''}
            </p>
          </div>
        </div>

        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="text-gray-400 hover:text-slate-700 p-1">
            <MoreHorizontal size={20} />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 shadow-lg rounded-xl z-10 py-1">
              {isAuthor ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(true)
                      setShowMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
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
          <p className="text-gray-800 text-sm whitespace-pre-wrap">{post.content}</p>
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

      <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
        <div className="flex gap-4 w-full">
          <button
            onClick={() => setLikes(likes + 1)}
            className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ThumbsUp size={20} /> <span className="text-sm font-medium">{likes}</span>
          </button>
          <button
            onClick={() => setDislikes(dislikes + 1)}
            className="flex items-center gap-1.5 text-gray-500 hover:text-red-500 transition-colors"
          >
            <ThumbsDown size={20} /> <span className="text-sm font-medium">{dislikes > 0 ? dislikes : ''}</span>
          </button>
          <button
            onClick={() => setShowCommentInput(!showCommentInput)}
            className="flex items-center gap-1.5 text-gray-500 hover:text-slate-700 transition-colors"
          >
            <MessageCircle size={20} /> <span className="text-sm font-medium">{comments}</span>
          </button>
          <div className="flex-1"></div>
          <button
            onClick={() => alert('Enlace de la publicación copiado')}
            className="flex items-center gap-1.5 text-gray-500 hover:text-green-600 transition-colors"
          >
            <Share2 size={20} /> <span className="text-sm font-medium hidden sm:inline">Compartir</span>
          </button>
        </div>
      </div>

      {showCommentInput && (
        <div className="px-4 pb-4 bg-gray-50 pt-3">
          {commentList.map((c) => (
            <div key={c.id} className="mb-2 bg-white p-2 rounded-lg text-sm border border-gray-100 shadow-sm group">
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
              className="flex-1 rounded-full border border-gray-300 px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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
    </div>
  )
}
