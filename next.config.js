/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable type checking during build (we'll handle it separately)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig 