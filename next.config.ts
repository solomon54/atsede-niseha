//next.config.ts

import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw/worker.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  injectionPoint: "self.__SW_MANIFEST",
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["192.168.8.19:3000", "localhost:3000"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  poweredByHeader: false,
  compress: true,

  webpack: (config, { isServer, dev }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        ignored: ["**/node_modules/**", "**/.next/**", "**/public/assets/**"],
        poll: false,
      };
    }
    return config;
  },
};

export default withSerwist(nextConfig);
