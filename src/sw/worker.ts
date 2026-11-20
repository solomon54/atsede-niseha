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

// Best-effort return path for call notifications. This only runs while the
// service worker is active; it does not provide Web Push or closed-tab calling.
self.addEventListener("notificationclick", (event) => {
  const rawUrl =
    typeof event.notification.data?.callUrl === "string"
      ? event.notification.data.callUrl
      : null;
  event.notification.close();
  if (!rawUrl) return;

  // Never navigate to an arbitrary origin, even if notification data is tampered with.
  const target = new URL(rawUrl, self.location.origin);
  if (target.origin !== self.location.origin) return;
  const path = `${target.pathname}${target.search}${target.hash}`;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(path);
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(path);
    })()
  );
});

self.addEventListener("message", (event) => {
  // Logic to clear cache on logout to protect "Identity-Bound" data
  if (event.data && event.data.type === "LOGOUT_SANCTUARY") {
    caches.keys().then((names) => {
      for (const name of names) caches.delete(name);
    });
  }
});

serwist.addEventListeners();
