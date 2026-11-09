import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads go through Server Actions, whose default body limit is 1 MB.
    // Images are capped at 5 MB by src/lib/upload.ts (and checked in the browser
    // first); 10 MB leaves room so a 5–10 MB file gets a friendly error message.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
