import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Image optimization configuration
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // CloudFront CDN pattern - configured per deployment
      ...(process.env.CDN_DOMAIN
        ? [
            {
              protocol: "https" as const,
              hostname: process.env.CDN_DOMAIN,
            },
          ]
        : []),
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },

  // Telemetry disabled for production
  ...(process.env.NEXT_TELEMETRY_DISABLED === "1" && {}),

  serverExternalPackages: ["sharp", "postgres"],
};

export default nextConfig;
