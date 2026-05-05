import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  },
  async headers() {
    return [
      {
        source: "/widget.js",
        headers: [
          { key: "Content-Type", value: "text/javascript; charset=UTF-8" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Allow the /embed page to be loaded in an iframe from the WP site
        source: "/embed/:path*",
        headers: [
          { key: "X-Frame-Options", value: "ALLOW-FROM http://thisiscrowd.local" },
          { key: "Content-Security-Policy", value: "frame-ancestors http://thisiscrowd.local http://localhost:* https://thisiscrowd.com" },
          { key: "Access-Control-Allow-Origin", value: "http://thisiscrowd.local" },
        ],
      },
      {
        // Allow the agent API to be called cross-origin from the WP site
        source: "/api/agent/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
      {
        source: "/api/voice/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
      {
        source: "/bot.js",
        headers: [
          { key: "Content-Type", value: "text/javascript; charset=UTF-8" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
