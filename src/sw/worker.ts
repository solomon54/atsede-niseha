/// <reference lib="webworker" />

import type { PrecacheEntry } from "@serwist/precaching";
import { Serwist } from "serwist";

import { apiRoutes } from "./caching/api";
import { shellRoutes } from "./caching/appShell";
import { assetRoutes } from "./caching/assets";

// 1. Setup Type-Safe self
declare let self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | PrecacheEntry)[] | undefined;
};

// 2. Initialize THE single Serwist instance
const serwist = new Serwist({
  // This handles your precacheAndRoute automatically
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // We will fix these files next so they export these arrays
    ...apiRoutes,
    ...assetRoutes,
    ...shellRoutes,
  ],
});

// 3. Centralized Security / Event Listeners
self.addEventListener("message", (event) => {
  // Logic to clear cache on logout to protect "Identity-Bound" data
  if (event.data && event.data.type === "LOGOUT_SANCTUARY") {
    caches.keys().then((names) => {
      for (const name of names) caches.delete(name);
    });
  }
});

serwist.addEventListeners();
