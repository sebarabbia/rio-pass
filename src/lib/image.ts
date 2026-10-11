// Optimización de imágenes en el navegador (antes de subirlas a Storage).

const MAX_SIDE = 2000 // px del lado más largo: sobra para un flyer en pantalla de celular
const TARGET_BYTES = 1.5 * 1024 * 1024
const QUALITIES = [0.86, 0.78, 0.7, 0.6, 0.5]

export type CompressedImage = { file: File; ext: 'webp' | 'jpg'; originalBytes: number }

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Achica y recomprime una imagen hasta que pese menos de ~1,5 MB.
 * Prefiere WebP (más liviano); si el navegador no lo sabe generar, usa JPEG.
 * Lanza un error si el navegador no puede abrir el formato (p. ej. HEIC en Chrome).
 */
export async function compressImage(input: File): Promise<CompressedImage> {
  const img = await loadImage(input)
  let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))

  for (let attempt = 0; attempt < 4; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo procesar la imagen')
    ctx.fillStyle = '#ffffff' // por si es un PNG con transparencia
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    for (const quality of QUALITIES) {
      let blob = await toBlob(canvas, 'image/webp', quality)
      let ext: 'webp' | 'jpg' = 'webp'
      if (!blob || blob.type !== 'image/webp') {
        blob = await toBlob(canvas, 'image/jpeg', quality)
        ext = 'jpg'
      }
      if (blob && blob.size <= TARGET_BYTES) {
        return { file: new File([blob], `flyer.${ext}`, { type: blob.type }), ext, originalBytes: input.size }
      }
    }
    scale *= 0.75 // todavía pesada: se achica un poco más y se reintenta
  }
  throw new Error('No se pudo achicar la imagen lo suficiente')
}

export function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1024)} KB`
}
