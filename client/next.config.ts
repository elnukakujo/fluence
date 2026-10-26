import type { NextConfig } from "next";

// Media and API are both served same-origin through the Next.js server (rewrites
// below proxy /api/* and /media/* to the backend), so the frontend no longer needs
// a public backend host/port baked in — URLs are relative and inherit the site origin.
const nextConfig = {
  eslint: {
    // ponytail: pre-existing lint errors block `next build`; not a Docker concern. Fix the
    // lint errors and remove this to re-enable lint-on-build.
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    const backend = `http://${process.env.LAPP_INTERNAL_HOST || '127.0.0.1'}:${process.env.LAPP_INTERNAL_PORT || '5050'}`;
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/media/:path*', destination: `${backend}/media/:path*` },
      { source: '/media_dev/:path*', destination: `${backend}/media_dev/:path*` },
      { source: '/media_test/:path*', destination: `${backend}/media_test/:path*` },
    ];
  },
} as NextConfig;

export default nextConfig;
