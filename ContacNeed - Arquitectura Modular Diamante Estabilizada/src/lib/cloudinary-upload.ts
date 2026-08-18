const CLOUDINARY_CLOUD_NAME = 'dgkruw6n7'
const CLOUDINARY_UPLOAD_PRESET = 'contacneed_uploads'

type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto'

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
    return 'No se encontró el preset de Cloudinary. Usa el enlace directo o contacta soporte.'
  }
  if (/pdf/i.test(body) && /not allowed|denied|invalid|unsupported/i.test(body)) {
    return 'Cloudinary rechazó el PDF. Se reintentará como documento (raw).'
  }
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } }
    if (parsed.error?.message) return parsed.error.message
  } catch {
    // ignore
  }
  return 'No se pudo subir el archivo. Prueba con un enlace directo o un archivo más liviano.'
}

/** Elige el endpoint correcto: PDF/Office → raw; audio/video → video; fotos → image. */
export function resolveCloudinaryResourceType(file: File): CloudinaryResourceType {
  const type = (file.type || '').toLowerCase()
  const name = file.name || ''

  if (
    type.startsWith('video/') ||
    type.startsWith('audio/') ||
    /\.(mp4|mov|webm|mp3|wav|ogg|m4a|aac|flac)$/i.test(name)
  ) {
    return 'video'
  }

  // PDF y documentos como raw: más fiable en presets unsigned (auto suele tratar PDF como image y fallar).
  if (
    type === 'application/pdf' ||
    type.includes('officedocument') ||
    type.includes('msword') ||
    type.includes('ms-excel') ||
    type.includes('ms-powerpoint') ||
    type === 'application/zip' ||
    type === 'application/x-zip-compressed' ||
    type === 'text/plain' ||
    type === 'application/octet-stream' ||
    /\.(pdf|docx?|xlsx?|pptx?|txt|zip|rar|7z)$/i.test(name)
  ) {
    return 'raw'
  }

  if (type.startsWith('image/') || /\.(gif|jpe?g|png|webp|svg|bmp|heic)$/i.test(name)) {
    return 'image'
  }

  return 'raw'
}

async function postToCloudinary(
  file: File,
  resourceType: CloudinaryResourceType,
): Promise<string> {
  const cloudName = resolveCloudName()
  const preset = resolveUploadPreset()

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', preset)

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

export async function uploadFileToCloudinary(file: File): Promise<string> {
  const primary = resolveCloudinaryResourceType(file)

  try {
    return await postToCloudinary(file, primary)
  } catch (primaryError) {
    // PDF a veces falla como image vía auto; reintenta raw / image / auto
    const fallbacks: CloudinaryResourceType[] = ['raw', 'image', 'auto'].filter(
      (type) => type !== primary,
    ) as CloudinaryResourceType[]

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
