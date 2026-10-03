import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.scdn.co",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://i.scdn.co https://*.scdn.co https://*.spotifycdn.com",
      "font-src 'self' data:",
      "connect-src 'self' https://api.spotify.com https://accounts.spotify.com",
      "frame-src 'self' https://sdk.scdn.co",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.spotify.com",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
