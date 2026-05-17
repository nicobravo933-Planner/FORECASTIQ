/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Variables de entorno públicas disponibles en el browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  },
}

module.exports = nextConfig
