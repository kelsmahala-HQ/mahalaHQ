import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to a 1MB body limit, which phone camera photos (avatar/document
    // uploads) routinely exceed. 10MB matches the proxy's own request-buffering ceiling.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
