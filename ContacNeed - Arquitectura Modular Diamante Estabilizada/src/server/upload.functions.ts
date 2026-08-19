import { createServerFn } from '@tanstack/react-start'
import { requireActiveUser } from '../lib/auth'

const CLOUDINARY_CLOUD_NAME = 'dgkruw6n7'
const CLOUDINARY_UPLOAD_PRESET = 'contacneed_uploads'
const MAX_SERVER_DOC_BYTES = 4 * 1024 * 1024

function resolveCloudName() {
  const raw = String(
    process.env.VITE_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME ?? '',
  ).trim()
  return raw && !raw.includes('=') ? raw : CLOUDINARY_CLOUD_NAME
}

function resolvePreset() {
  const raw = String(
    process.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? process.env.CLOUDINARY_UPLOAD_PRESET ?? '',
  ).trim()
  return raw && !raw.includes('=') && !raw.startsWith('cloudinary://')
    ? raw
    : CLOUDINARY_UPLOAD_PRESET
}

function safeDocumentName(fileName: string, mimeType?: string | null) {
  const base = (fileName || 'documento').trim() || 'documento'
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base
  if ((mimeType || '').includes('pdf')) return `${base}.pdf`
  if ((mimeType || '').includes('word')) return `${base}.docx`
  return `${base}.bin`
}

/**
 * Subida servidor → Cloudinary raw para documentos/PDF.
 * Evita fallos del navegador y la ruta image (PDF restringido en delivery).
 * Límite ~4 MB por el body de la función serverless.
 */
export const uploadChatDocumentFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: { fileName: string; mimeType?: string | null; base64: string; sizeBytes?: number }) => d,
  )
  .handler(async ({ data }) => {
    await requireActiveUser()

    const base64 = data.base64?.trim()
    if (!base64) throw new Error('Archivo vacío')

    const buffer = Buffer.from(base64, 'base64')
    if (!buffer.length) throw new Error('No se pudo leer el archivo')
    if (buffer.length > MAX_SERVER_DOC_BYTES) {
      throw new Error('El PDF/documento supera 4 MB para subida segura. Prueba uno más liviano.')
    }

    const fileName = safeDocumentName(data.fileName, data.mimeType)
    const mime =
      data.mimeType?.trim() ||
      (/\.pdf$/i.test(fileName) ? 'application/pdf' : 'application/octet-stream')

    const form = new FormData()
    const blob = new Blob([buffer], { type: mime })
    form.append('file', blob, fileName)
    form.append('upload_preset', resolvePreset())
    form.append('filename_override', fileName)

    const cloudName = resolveCloudName()
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
      method: 'POST',
      body: form,
    })

    const rawBody = await response.text()
    if (!response.ok) {
      let message = 'Cloudinary rechazó el documento'
      try {
        const parsed = JSON.parse(rawBody) as { error?: { message?: string } }
        if (parsed.error?.message) message = parsed.error.message
      } catch {
        if (rawBody.trim()) message = rawBody.slice(0, 200)
      }
      throw new Error(message)
    }

    const payload = JSON.parse(rawBody) as { secure_url?: string }
    if (!payload.secure_url) throw new Error('Cloudinary no devolvió URL del documento')

    return {
      url: payload.secure_url,
      mimeType: mime,
      fileName,
      sizeBytes: buffer.length,
    }
  })
