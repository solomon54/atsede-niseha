//next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Next.js 15/16 fix: ESLint and TS settings are now under their respective objects

  typescript: {
    ignoreBuildErrors: false,
  },

  /**
   * TURBOPACK COMPATIBILITY FIX
   * In Next 16, Turbopack is the default.
   * Adding an empty turbopack object silences the "webpack config detected" error.
   */
  turbopack: {},

  /**
   *  RESOURCE MANAGEMENT FOR MAC
   * Keep the webpack block for fallback/production builds.
   * Turbopack handles watching internally, so this only applies to --webpack mode.
   */
  webpack: (config, { isServer, dev }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        ignored: ["**/node_modules/**", "**/.next/**", "**/public/assets/**"],
        poll: false,
      };
    }
    return config;
  },

  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
