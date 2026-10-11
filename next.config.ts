import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Los flyers de las fechas de ejemplo se leen del disco en el servidor (ver /organizador/demo).
  // La fuente de las imágenes de vista previa (WhatsApp) también (ver lib/og.tsx).
  outputFileTracingIncludes: {
    '/organizador/demo': ['./src/demo/flyers/**/*'],
    '/**/opengraph-image*': ['./src/assets/fonts/**/*'],
    '/opengraph-image*': ['./src/assets/fonts/**/*'],
  },
}

export default nextConfig
