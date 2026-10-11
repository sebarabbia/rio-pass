import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Los flyers de las fechas de ejemplo se leen del disco en el servidor (ver /organizador/demo).
  outputFileTracingIncludes: {
    '/organizador/demo': ['./src/demo/flyers/**/*'],
  },
}

export default nextConfig
