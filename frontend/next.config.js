/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Variables de entorno públicas disponibles en el browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  },
  // UX-MS-3: redirects para rutas renombradas
  async redirects() {
    return [
      {
        source: "/dashboard/batch",
        destination: "/dashboard/multi-serie",
        permanent: false,
      },
      {
        source: "/dashboard/analytics",
        destination: "/dashboard/multi-serie",
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig
