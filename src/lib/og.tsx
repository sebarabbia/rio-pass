import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { LOGO_PATH } from '@/components/Logo'
import { flyerUrl } from '@/lib/events'

// Imágenes de vista previa (WhatsApp, Instagram, etc.): 1200×630 con la estética de Rio.
// Los flyers están en WebP y el generador de imágenes no los lee, así que se pasan
// a JPEG con sharp antes de dibujarlos.

export const OG_SIZE = { width: 1200, height: 630 }
// JPEG y no PNG: con el flyer, el PNG pasa los 500 KB y WhatsApp a veces no muestra
// vistas previas pesadas. En JPEG queda en ~100 KB.
export const OG_CONTENT_TYPE = 'image/jpeg'
const FLYER = { width: 404, height: 505 }

const BG = '#2b3a3f'
const MUTED = '#a9b8bc'

async function serifFont() {
  return readFile(path.join(process.cwd(), 'src/assets/fonts/CormorantGaramond-SemiBold.woff'))
}

async function flyerDataUri(flyerPath: string | null) {
  const url = flyerUrl(flyerPath)
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(FLYER.width * 2, FLYER.height * 2, { fit: 'cover' })
      .jpeg({ quality: 78 })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    return null
  }
}

type Card = { kicker: string; title: string; lines?: string[]; flyerPath?: string | null }

export async function renderOgCard({ kicker, title, lines = [], flyerPath = null }: Card) {
  const [font, flyer] = await Promise.all([serifFont(), flyerDataUri(flyerPath)])
  const titleSize = title.length > 28 ? 64 : title.length > 18 ? 76 : 92

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 56,
          padding: 62,
          background: `radial-gradient(circle at 70% -20%, #3b4c52 0%, ${BG} 60%)`,
          color: '#fff',
        }}
      >
        {flyer && (
          // eslint-disable-next-line @next/next/no-img-element -- imagen dentro de ImageResponse
          <img src={flyer} width={FLYER.width} height={FLYER.height} style={{ borderRadius: 22, objectFit: 'cover' }} alt="" />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: flyer ? 'flex-start' : 'center', textAlign: flyer ? 'left' : 'center' }}>
          <svg width={flyer ? 150 : 260} viewBox="0 0 888 618" style={{ marginBottom: flyer ? 34 : 40 }}>
            <path fill="#fff" fillRule="evenodd" d={LOGO_PATH} />
          </svg>
          <div style={{ fontSize: 22, letterSpacing: 6, textTransform: 'uppercase', color: MUTED, marginBottom: 14 }}>{kicker}</div>
          <div style={{ fontFamily: 'Cormorant', fontSize: titleSize, lineHeight: 1.02, marginBottom: 22 }}>{title}</div>
          {lines.map((line) => (
            <div key={line} style={{ fontSize: 30, color: '#dde5e7', lineHeight: 1.35 }}>
              {line}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: 'Cormorant', data: font, weight: 600, style: 'normal' }] },
  )
  const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  return new Response(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': OG_CONTENT_TYPE,
      // Una hora en el CDN: si cambia el flyer, la vista previa se actualiza sola.
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
