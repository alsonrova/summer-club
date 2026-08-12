import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  images: { formats: ['image/avif', 'image/webp'] },
  typedRoutes: true,
}

export default config
