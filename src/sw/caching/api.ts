//src/sw/caching/api.ts

import { ExpirationPlugin } from "@serwist/expiration"; // Must be imported
import { NetworkFirst, NetworkOnly, type RuntimeCaching } from "serwist";

import { CACHE } from "../constants";

export const apiRoutes: RuntimeCaching[] = [
  // 1. ❌ Identity Security: Never cache Auth endpoints
  {
    matcher: ({ url }) => url.pathname.includes("/api/auth"),
    handler: new NetworkOnly(),
  },

  // 2. ✅ Sacred Ledger Cache
  {
    matcher: ({ url }) =>
      url.pathname.includes("/api/") && !url.pathname.includes("/api/auth"),
    handler: new NetworkFirst({
      cacheName: CACHE.API,
      networkTimeoutSeconds: 10,
      // CORRECT: Expiration is a plugin in Serwist/Workbox
      plugins: [
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24, // 24 Hours
        }),
      ],
    }),
  },
];
