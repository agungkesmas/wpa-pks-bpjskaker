import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Performance: aktifkan strict mode untuk catch bugs lebih awal
  reactStrictMode: true,

  // Performance: jangan ignore type errors di build (sebelumnya true — berbahaya)
  typescript: {
    ignoreBuildErrors: false,
  },

  // Performance: bundle optimization
  experimental: {
    // Tree-shake lebih agresif untuk icon library & radix primitives
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-checkbox',
    ],
  },

  // Keluarkan package berat dari bundle (Next.js 16: pindah dari experimental ke root level)
  serverExternalPackages: [
    'mammoth',      // 2.5MB — docx parser
    'xlsx',         // 7.3MB — Excel parser
    'docx',         // docx generator
    'bcryptjs',     // crypto native
    'jsonwebtoken', // crypto native
  ],

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
    ],
  },

  // Production: remove console.log (keep error)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error'] }
      : false,
  },
};

export default nextConfig;
