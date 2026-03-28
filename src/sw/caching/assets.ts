//src/sw/caching/assets.ts

import { ExpirationPlugin } from "@serwist/expiration";
import { type RuntimeCaching, StaleWhileRevalidate } from "serwist";

import { CACHE } from "../constants";

export const assetRoutes: RuntimeCaching[] = [
  {
    // Capture Styles, Scripts, and Images
    matcher: ({ request }) =>
      request.destination === "style" ||
      request.destination === "script" ||
      request.destination === "image",

    // Use StaleWhileRevalidate:
    // Show the "Cached" parchment/style immediately,
    // then update in the background for next time.
    handler: new StaleWhileRevalidate({
      cacheName: CACHE.ASSETS,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days (Sacred assets don't change often)
        }),
      ],
    }),
  },
];
