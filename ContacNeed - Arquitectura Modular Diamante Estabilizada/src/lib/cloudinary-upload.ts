export async function uploadFileToCloudinary(file: File): Promise<string> {
  const cloudName = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? 'dgkruw6n7').trim()
  const preset = String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? 'contacneed_uploads').trim()

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', preset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || 'No se pudo subir el archivo a Cloudinary')
  }

  const payload = (await response.json()) as { secure_url?: string }
  if (!payload.secure_url) throw new Error('Cloudinary no devolvió URL')
  return payload.secure_url
}
