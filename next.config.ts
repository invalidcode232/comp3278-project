import type { NextConfig } from "next";

/** Next.js request-body allowance supporting the image cap plus form overhead. */
const nextConfig: NextConfig = {
  experimental: {
    // A 10 MiB image needs extra room for multipart boundaries and text fields.
    // Both client and server still enforce the exact image-byte limit.
    serverActions: { bodySizeLimit: "12mb" },
    // Proxy clones the multipart request before forwarding it to the action.
    proxyClientMaxBodySize: "12mb",
  },
};

export default nextConfig;
