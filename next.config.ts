import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https: wss: ws:; media-src 'self' blob: data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
        },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
