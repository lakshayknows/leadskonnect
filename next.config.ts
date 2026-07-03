import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "d8j0ntlcm91z4.cloudfront.net" },
    ],
  },
  // Server-only packages that should not be bundled for the browser.
  serverExternalPackages: ["twilio", "nodemailer", "bullmq", "ioredis", "@prisma/client"],
};

export default nextConfig;
