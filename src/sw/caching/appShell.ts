//src/sw/caching/appShell.ts

import { NetworkFirst, type RuntimeCaching } from "serwist";

import { CACHE } from "../constants";

export const shellRoutes: RuntimeCaching[] = [
  {
    // Match all navigation requests (entering a URL or clicking a link)
    matcher: ({ request }) => request.mode === "navigate",

    // Use NetworkFirst:
    // Try to get the latest version of the page from the server,
    // but fall back to the "App Shell" in the cache if the network is dead.
    handler: new NetworkFirst({
      cacheName: CACHE.APP_SHELL,
      // Optional: Since this is the core UI, we give it a
      // generous timeout to allow for slow connections.
      networkTimeoutSeconds: 10,
    }),
  },
];
