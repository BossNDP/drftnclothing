import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['onnxruntime-web', '@imgly/background-removal'],
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts — Clerk JS, Razorpay, CDN, Cloudflare Turnstile (CAPTCHA)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://checkout.razorpay.com https://cdn.jsdelivr.net https://*.clerk.accounts.dev https://*.clerk.com https://clerk.drftn.in https://clerk.drftnclothing.in https://challenges.cloudflare.com",
              "script-src-elem 'self' 'unsafe-inline' blob: https://checkout.razorpay.com https://cdn.jsdelivr.net https://*.clerk.accounts.dev https://*.clerk.com https://clerk.drftn.in https://clerk.drftnclothing.in https://challenges.cloudflare.com",
              // Styles
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://clerk.drftnclothing.in https://*.clerk.com",
              // Images
              "img-src 'self' data: https: blob:",
              // Connections (fetch/XHR/WebSocket)
              "connect-src 'self' https: blob:",
              // Workers / service workers
              "worker-src blob: 'self'",
              // Frames — Razorpay, Clerk, Cloudflare Turnstile
              "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.drftnclothing.in https://challenges.cloudflare.com",
              // Fonts
              "font-src 'self' data:",
            ].join('; '),
          },
        ],
      },
    ];
  },
  webpack(config) {
    // onnxruntime-web exports "./webgpu" with "node: null" — webpack picks up the
    // node condition and rejects it even for client bundles. Alias directly to the
    // physical file to bypass the broken exports field.
    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-web/webgpu': resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.min.js'),
      'onnxruntime-web$': resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.min.js'),
      'onnxruntime-web': resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.min.js'),
    };
    
    return config;
  },
};

import { withSentryConfig } from "@sentry/nextjs";

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "webibi",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI or production builds
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route Sentry requests through Tunneling to avoid ad blockers
  // tunnelRoute: "/monitoring",

  // Hides source maps from visitors
  hideSourceMaps: true,

  webpack: {
    // Automatically annotate React components to show their full name in breadcrumbs and stack traces
    reactComponentAnnotation: {
      enabled: true,
    },
    // Enables automatic Instrumentation of Vercel Cron Jobs
    automaticVercelMonitors: true,
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
