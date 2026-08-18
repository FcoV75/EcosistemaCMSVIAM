import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Edit2, Heart, ImagePlus, Smile, Trash2, X } from 'lucide-react'
import { resolveAvatarUrl } from '../lib/default-avatar'
import { uploadFileToCloudinary } from '../lib/cloudinary-upload'
import { useIdentity } from '../lib/identity-context'
import {
  addCommentFn,
  deleteCommentFn,
  getCommentsFn,
  toggleCommentLikeFn,
  updateCommentFn,
} from '../server/posts.functions'
import { LinkifiedText } from './LinkifiedText'
import { PostMedia } from './PostMedia'

export type CommentRow = {
  id: string
  text: string
  mediaUrl?: string | null
  user_id: string
  author_name?: string
  author_avatar?: string | null
  created_at?: string | null
  updated_at?: string | null
  likes?: number
  likedByMe?: boolean
}

const QUICK_EMOJIS = ['😀', '😂', '😍', '🔥', '👍', '👏', '🙏', '💪', '❤️', '🎉', '😎', '🤔']

const MAX_COMMENT_MEDIA_BYTES = 20 * 1024 * 1024

type CommentSectionProps = {
  postId: string
  open: boolean
  onCountChange: (count: number) => void
}

export function CommentSection({ postId, open, onCountChange }: CommentSectionProps) {
  const { user } = useIdentity()
  const fileRef = useRef<HTMLInputElement>(null)
  const [commentList, setCommentList] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editMediaUrl, setEditMediaUrl] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    getCommentsFn({ data: { postId } })
      .then((rows) => {
        if (cancelled) return
        setCommentList(rows as CommentRow[])
        onCountChange(rows.length)
      })
      .catch(() => {
        if (!cancelled) setCommentList([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, postId, onCountChange])

  const requireLogin = () => {
    if (user) return true
    alert('Debes iniciar sesión para comentar')
    return false
  }

  const handlePickMedia = async (file: File | null) => {
    if (!file) return
    if (file.size > MAX_COMMENT_MEDIA_BYTES) {
      alert('El archivo debe pesar máximo 20 MB (imagen, GIF o video corto).')
      return
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Solo se permiten imágenes, GIF o video corto.')
      return
    }
    setUploading(true)
    try {
      const url = await uploadFileToCloudinary(file)
      if (editingId) setEditMediaUrl(url)
      else setMediaUrl(url)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo subir el archivo')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submitComment = async () => {
    if (!requireLogin()) return
    const trimmed = text.trim()
    const media = mediaUrl.trim()
    if (!trimmed && !media) return
    try {
      const result = await addCommentFn({
        data: { postId, comment: { text: trimmed, mediaUrl: media || null } },
      })
      setCommentList((prev) => {
        const next = [...prev, result.comment as CommentRow]
        onCountChange(next.length)
        return next
      })
      setText('')
      setMediaUrl('')
      setShowEmojis(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al comentar')
    }
  }

  const startEdit = (comment: CommentRow) => {
    setEditingId(comment.id)
    setEditText(comment.text === '📎' ? '' : comment.text)
    setEditMediaUrl(comment.mediaUrl ?? '')
    setShowEmojis(false)
  }

  const saveEdit = async () => {
    if (!editingId) return
    const trimmed = editText.trim()
    const media = editMediaUrl.trim()
    if (!trimmed && !media) {
      alert('El comentario no puede quedar vacío')
      return
    }
    setBusyId(editingId)
    try {
      const result = await updateCommentFn({
        data: { commentId: editingId, text: trimmed, mediaUrl: media || null },
      })
      setCommentList((prev) =>
        prev.map((row) =>
          row.id === editingId
            ? {
                ...row,
                ...(result.comment as CommentRow),
                likes: row.likes ?? 0,
                likedByMe: row.likedByMe ?? false,
              }
            : row,
        ),
      )
      setEditingId(null)
      setEditText('')
      setEditMediaUrl('')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo editar')
    } finally {
      setBusyId(null)
    }
  }

  const removeComment = async (commentId: string) => {
    if (!confirm('¿Borrar este comentario?')) return
    setBusyId(commentId)
    try {
      await deleteCommentFn({ data: { commentId } })
      setCommentList((prev) => {
        const next = prev.filter((row) => row.id !== commentId)
        onCountChange(next.length)
        return next
      })
      if (editingId === commentId) setEditingId(null)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo borrar')
    } finally {
      setBusyId(null)
    }
  }

  const toggleLike = async (comment: CommentRow) => {
    if (!requireLogin()) return
    const prevLikes = comment.likes ?? 0
    const prevLiked = Boolean(comment.likedByMe)
    setCommentList((prev) =>
      prev.map((row) =>
        row.id === comment.id
          ? {
              ...row,
              likedByMe: !prevLiked,
              likes: Math.max(0, prevLikes + (prevLiked ? -1 : 1)),
            }
          : row,
      ),
    )
    try {
      const result = await toggleCommentLikeFn({ data: { commentId: comment.id } })
      setCommentList((prev) =>
        prev.map((row) =>
          row.id === comment.id
            ? { ...row, likes: result.likes, likedByMe: result.likedByMe }
            : row,
        ),
      )
    } catch (error) {
      setCommentList((prev) =>
        prev.map((row) =>
          row.id === comment.id ? { ...row, likes: prevLikes, likedByMe: prevLiked } : row,
        ),
      )
      alert(error instanceof Error ? error.message : 'No se pudo guardar el like')
    }
  }

  if (!open) return null

  return (
    <div className="bg-slate-900/40 px-4 pb-4 pt-3">
      {loading && <p className="mb-2 text-xs text-purple-200/50">Cargando comentarios...</p>}

      {commentList.map((c) => {
        const isMine = user?.id === c.user_id
        const isEditing = editingId === c.id
        return (
          <div
            key={c.id}
            className="group mb-2 rounded-lg border border-purple-500/15 bg-slate-900/60 p-2 text-sm shadow-sm"
          >
            <div className="mb-1 flex items-center gap-2">
              <Link to="/u/$userId" params={{ userId: c.user_id }}>
                <img
                  src={resolveAvatarUrl(c.author_avatar, c.user_id, c.author_name)}
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
              {c.updated_at ? (
                <span className="text-[10px] text-purple-300/50">editado</span>
              ) : null}
              {isMine ? (
                <div className="ml-auto flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="rounded p-1 text-purple-200/70 hover:bg-white/10 hover:text-amber-200"
                    aria-label="Editar comentario"
                    disabled={busyId === c.id}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeComment(c.id)}
                    className="rounded p-1 text-purple-200/70 hover:bg-white/10 hover:text-red-300"
                    aria-label="Borrar comentario"
                    disabled={busyId === c.id}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : null}
            </div>

            {isEditing ? (
              <div className="space-y-2 pl-9">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-purple-500/30 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50"
                />
                {editMediaUrl ? (
                  <div className="relative">
                    <PostMedia mediaUrl={editMediaUrl} compact />
                    <button
                      type="button"
                      onClick={() => setEditMediaUrl('')}
                      className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
                      aria-label="Quitar media"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-lg border border-purple-500/30 px-2 py-1 text-xs text-purple-100"
                  >
                    Cambiar imagen/GIF/video
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveEdit()}
                    disabled={busyId === c.id}
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-purple-500/30 px-3 py-1 text-xs text-purple-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="pl-9">
                {c.text && c.text !== '📎' ? (
                  <div className="whitespace-pre-wrap text-purple-50/90">
                    <LinkifiedText text={c.text} />
                  </div>
                ) : null}
                {c.mediaUrl ? <PostMedia mediaUrl={c.mediaUrl} compact /> : null}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleLike(c)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition ${
                      c.likedByMe
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'text-purple-200/60 hover:bg-white/5 hover:text-rose-300'
                    }`}
                  >
                    <Heart size={13} className={c.likedByMe ? 'fill-current' : ''} />
                    {(c.likes ?? 0) > 0 ? c.likes : 'Me gusta'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <div className="mt-3 space-y-2">
        {mediaUrl ? (
          <div className="relative">
            <PostMedia mediaUrl={mediaUrl} compact />
            <button
              type="button"
              onClick={() => setMediaUrl('')}
              className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
              aria-label="Quitar adjunto"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {showEmojis ? (
          <div className="flex flex-wrap gap-1 rounded-xl border border-purple-500/20 bg-slate-950/70 p-2">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="rounded-lg px-1.5 py-1 text-lg hover:bg-white/10"
                onClick={() => setText((prev) => `${prev}${emoji}`)}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe un comentario… (puedes pegar un enlace)"
            className="flex-1 rounded-full border border-purple-500/30 bg-slate-900/80 px-4 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submitComment()
              }
            }}
          />
          <button
            type="button"
            onClick={() => setShowEmojis((v) => !v)}
            className="rounded-full border border-purple-500/30 px-3 text-purple-100 hover:bg-white/5"
            aria-label="Emojis"
            title="Emojis"
          >
            <Smile size={18} />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-full border border-purple-500/30 px-3 text-purple-100 hover:bg-white/5 disabled:opacity-50"
            aria-label="Adjuntar imagen, GIF o video"
            title="Imagen / GIF / video corto"
          >
            <ImagePlus size={18} />
          </button>
          <button
            type="button"
            onClick={() => void submitComment()}
            disabled={uploading || (!text.trim() && !mediaUrl.trim())}
            className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-bold text-slate-950 hover:bg-amber-600 disabled:opacity-50"
          >
            {uploading ? 'Subiendo…' : 'Comentar'}
          </button>
        </div>
        <p className="text-[11px] text-purple-300/50">
          Puedes adjuntar imagen, GIF o video corto (máx. 20 MB). Los enlaces http/https quedan activos.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*,.gif"
        className="hidden"
        onChange={(e) => void handlePickMedia(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}
