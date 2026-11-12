import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // A 10 MiB image needs extra room for multipart boundaries and text fields.
    // Both client and server still enforce the exact image-byte limit.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
