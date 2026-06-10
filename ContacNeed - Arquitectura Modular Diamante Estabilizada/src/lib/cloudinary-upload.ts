const CLOUDINARY_CLOUD_NAME = 'dgkruw6n7'
const CLOUDINARY_UPLOAD_PRESET = 'contacneed_uploads'

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
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } }
    if (parsed.error?.message) return parsed.error.message
  } catch {
    // ignore
  }
  return 'No se pudo subir el archivo. Prueba con un enlace directo o un archivo más liviano.'
}

export async function uploadFileToCloudinary(file: File): Promise<string> {
  const cloudName = resolveCloudName()
  const preset = resolveUploadPreset()

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', preset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
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
