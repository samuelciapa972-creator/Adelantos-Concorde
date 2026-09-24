/**
 * Reduce la foto antes de subirla: las cámaras actuales sacan 8–12 MB, demasiado
 * para datos móviles en carretera. Se redimensiona (lado mayor 1800 px) y se
 * recodifica como JPEG. Respeta la orientación EXIF. Si el navegador no puede
 * decodificarla (p. ej. HEIC sin conversión), se envía el original.
 */
export async function comprimirImagen(file: File, { maxLado = 1800, calidad = 0.82 } = {}): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', calidad))
    if (!blob) return file
    if (blob.size >= file.size && file.size <= 9.5 * 1024 * 1024) return file // ya era ligera
    const nombre = (file.name || 'soporte').replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], nombre, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/** Contraseña temporal legible: sin caracteres ambiguos (0/O, 1/l/I). */
export function generarPassword(largo = 12): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRTUVWXYZ234679'
  const bytes = crypto.getRandomValues(new Uint32Array(largo))
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
}

/** "Ana Gómez Ruiz" → "ana.gomez" */
export function sugerirUsuario(nombre = ''): string {
  const partes = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  return partes.length === 1 ? partes[0] : `${partes[0]}.${partes[partes.length > 2 ? 1 : partes.length - 1]}`
}
