import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  images: { formats: ['image/avif', 'image/webp'] },
  typedRoutes: true,
  experimental: {
    serverActions: {
      // uploadMedia (src/app/admin/produits/actions.ts) accepte des photos jusqu'à
      // 8 Mo ; la limite par défaut d'une Server Action est 1 Mo (voir
      // node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/
      // serverActions.md), ce qui rejetterait silencieusement tout téléversement réel
      // avant même que le contrôle de format/taille de processImage() ne s'exécute. La
      // marge au-delà de 8 Mo couvre l'en-tête multipart/form-data (limites, métadonnées).
      bodySizeLimit: '9mb',
    },
  },
}

export default config
