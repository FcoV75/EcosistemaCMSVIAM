const CLOUDINARY_CLOUD_NAME = 'dgkruw6n7'
const CLOUDINARY_UPLOAD_PRESET = 'contacneed_uploads'

type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto'

export type CloudinaryUploadKind = 'image' | 'video' | 'audio' | 'document'

function resolveUploadPreset() {
  const raw = String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? '').trim()
  if (!raw || raw.includes('=') || raw.startsWith('cloudinary://')) {
    return CLOUDINARY_UPLOAD_PRESET
  }
  return raw
}

function resolveCloudName() {
  const raw = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? '').trim()
  if (!raw || raw.includes('=')) return CLOUDINARY_CLOUD_NAME
  return raw
}

function friendlyCloudinaryError(body: string) {
  if (body.includes('Upload preset not found')) {
    return 'No se encontró el preset de Cloudinary. Revisa VITE_CLOUDINARY_UPLOAD_PRESET.'
  }
  if (/pdf/i.test(body) && /not allowed|denied|restricted|unauthorized|forbidden/i.test(body)) {
    return 'Cloudinary bloqueó el PDF. En Cloudinary → Settings → Security activa la entrega de PDF/ZIP, o súbelo como documento raw.'
  }
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } }
    if (parsed.error?.message) return parsed.error.message
  } catch {
    // ignore
  }
  const trimmed = body.replace(/\s+/g, ' ').trim()
  if (trimmed && trimmed.length < 240) return trimmed
  return 'No se pudo subir el archivo a Cloudinary.'
}

export function classifyUploadFile(file: File): CloudinaryUploadKind {
  const type = (file.type || '').toLowerCase()
  const name = file.name || ''

  if (
    type.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name)
  ) {
    return 'audio'
  }
  if (type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(name)) {
    return 'video'
  }
  if (
    type === 'application/pdf' ||
    type.includes('officedocument') ||
    type.includes('msword') ||
    type.includes('ms-excel') ||
    type.includes('ms-powerpoint') ||
    type === 'application/zip' ||
    type === 'application/x-zip-compressed' ||
    type === 'text/plain' ||
    /\.(pdf|docx?|xlsx?|pptx?|txt|zip|rar|7z)$/i.test(name)
  ) {
    return 'document'
  }
  if (type.startsWith('image/') || /\.(gif|jpe?g|png|webp|svg|bmp|heic)$/i.test(name)) {
    return 'image'
  }
  // Desconocido: tratar como documento (raw) es más seguro que image
  return 'document'
}

/** Elige endpoint Cloudinary. PDF/Office NUNCA van por image (la entrega suele estar restringida). */
export function resolveCloudinaryResourceType(file: File): CloudinaryResourceType {
  const kind = classifyUploadFile(file)
  if (kind === 'audio' || kind === 'video') return 'video'
  if (kind === 'document') return 'raw'
  return 'image'
}

function ensureFileExtension(file: File): File {
  const kind = classifyUploadFile(file)
  const name = file.name || 'archivo'
  if (kind !== 'document') {
    if (file.type) return file
    return new File([file], name, { type: file.type || 'application/octet-stream' })
  }

  let nextName = name
  if (!/\.[a-z0-9]{2,5}$/i.test(nextName)) {
    if ((file.type || '').includes('pdf') || /\.pdf/i.test(name)) nextName = `${name}.pdf`
    else if ((file.type || '').includes('word')) nextName = `${name}.docx`
    else nextName = `${name}.bin`
  }
  // Normaliza PDF a mime correcto (algunos Windows mandan type vacío)
  const mime =
    /\.pdf$/i.test(nextName)
      ? 'application/pdf'
      : file.type || 'application/octet-stream'

  if (nextName === file.name && mime === file.type) return file
  return new File([file], nextName, { type: mime, lastModified: file.lastModified })
}

async function postToCloudinary(
  file: File,
  resourceType: CloudinaryResourceType,
): Promise<string> {
  const cloudName = resolveCloudName()
  const preset = resolveUploadPreset()
  const safeFile = ensureFileExtension(file)

  const formData = new FormData()
  formData.append('file', safeFile, safeFile.name)
  formData.append('upload_preset', preset)
  // filename_override está permitido en unsigned uploads
  formData.append('filename_override', safeFile.name)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(friendlyCloudinaryError(body))
  }

  const payload = (await response.json()) as { secure_url?: string }
  if (!payload.secure_url) throw new Error('Cloudinary no devolvió URL')
  return payload.secure_url
}

/**
 * Sube a Cloudinary.
 * Documentos/PDF: solo `raw` (sin fallback a image — eso rompe la entrega en cuentas con PDF restringido).
 */
export async function uploadFileToCloudinary(file: File): Promise<string> {
  const kind = classifyUploadFile(file)
  const primary = resolveCloudinaryResourceType(file)

  try {
    return await postToCloudinary(file, primary)
  } catch (primaryError) {
    if (kind === 'document') {
      // Segundo intento raw con type forzado a octet-stream (algunos PDF problemáticos)
      try {
        const forced = new File([file], ensureFileExtension(file).name, {
          type: 'application/octet-stream',
          lastModified: file.lastModified,
        })
        return await postToCloudinary(forced, 'raw')
      } catch {
        throw primaryError instanceof Error
          ? primaryError
          : new Error('No se pudo subir el documento a Cloudinary')
      }
    }

    const fallbacks: CloudinaryResourceType[] = (['auto', 'image', 'video', 'raw'] as const).filter(
      (type) => type !== primary,
    )
    let lastError: unknown = primaryError
    for (const resourceType of fallbacks) {
      try {
        return await postToCloudinary(file, resourceType)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('No se pudo subir el archivo a Cloudinary')
  }
}

/** Si un PDF quedó como /image/upload/, fuerza descarga para evitar bloqueo de entrega. */
export function cloudinaryPdfDeliveryUrl(url: string): string {
  if (!url) return url
  if (/\/image\/upload\//i.test(url) && /\.pdf($|\?)/i.test(url)) {
    return url.replace('/image/upload/', '/image/upload/fl_attachment/')
  }
  return url
}
