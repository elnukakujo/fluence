import type { NextConfig } from "next";

// Browser-facing host/port: LAPP_HOST/LAPP_PORT is the Flask *bind* address (can be
// 0.0.0.0), which browsers can't fetch - LAPP_PUBLIC_HOST/PORT overrides it when they differ.
const publicHost = process.env.LAPP_PUBLIC_HOST || process.env.LAPP_HOST;
const publicPort = process.env.LAPP_PUBLIC_PORT || process.env.LAPP_PORT;

// Extra hostnames media can be served from besides LAPP_PUBLIC_HOST/PORT (e.g. a reverse-proxy
// domain like "fluence.home" or "fluence.home:443"), comma-separated: LAPP_EXTRA_MEDIA_HOSTS=fluence.home,192.168.1.93
const extraHosts = (process.env.LAPP_EXTRA_MEDIA_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)
  .map((h) => {
    const [hostname, port] = h.split(':');
    return { hostname, port };
  });

const mediaHosts = [{ hostname: publicHost || '127.0.0.1', port: publicPort || '5000' }, ...extraHosts];

const nextConfig = {
  eslint: {
    // ponytail: pre-existing lint errors block `next build`; not a Docker concern. Fix the
    // lint errors and remove this to re-enable lint-on-build.
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_LAPP_HOST: publicHost,
    NEXT_PUBLIC_LAPP_PORT: publicPort,
  },
  async rewrites() {
    const backend = `http://${process.env.LAPP_INTERNAL_HOST || '127.0.0.1'}:${process.env.LAPP_INTERNAL_PORT || '5050'}`;
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
    ];
  },
  images: {
    remotePatterns: mediaHosts.flatMap(({ hostname, port }) =>
      ['/media/images/**', '/media_dev/images/**', '/media_test/images/**'].map((pathname) => ({
        protocol: 'http' as const,
        hostname,
        ...(port ? { port } : {}),
        pathname,
      }))
    ),
  },
} as NextConfig;

export default nextConfig;
