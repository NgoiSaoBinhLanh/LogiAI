/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: [
      'echarts',
      'lucide-react',
      'qrcode.react',
      '@dnd-kit/core',
      '@dnd-kit/utilities',
      '@tanstack/react-table',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-progress',
    ],
  },
};

export default nextConfig;
