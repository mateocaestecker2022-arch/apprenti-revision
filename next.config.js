/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Empêche le site d'être intégré dans une iframe (anti-clickjacking)
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Empêche le navigateur de deviner le type MIME (anti-sniffing)
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Contrôle les infos envoyées au referrer
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Désactive les fonctionnalités navigateur non utilisées
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // Politique de chargement des ressources (CSP)
  // 'unsafe-inline' requis pour le script dark mode inline dans layout.tsx
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  // Force HTTPS (1 an)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
]

const nextConfig = {
  output: 'standalone',

  // Cache les headers qui révèlent la techno (X-Powered-By: Next.js)
  poweredByHeader: false,

  // Désactive les source maps en production (le code source ne peut pas être reconstruit depuis F12)
  productionBrowserSourceMaps: false,

  // Applique les headers de sécurité sur toutes les routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
