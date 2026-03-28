//src/sw/caching/security.ts

/// <reference lib="webworker" />
export {};

declare const self: ServiceWorkerGlobalScope;

// SECURITY GATEKEEPER
self.addEventListener("message", (event) => {
  // If the UI sends a 'LOGOUT' signal, wipe the Sacred Ledger immediately
  if (event.data && event.data.type === "LOGOUT_SANCTUARY") {
    console.log("🛡️ Security: Purging cached sacred records...");

    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete everything to ensure no identity leakage
            return caches.delete(cacheName);
          })
        );
      })
    );
  }
});

// Protect against protocol leaks
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Real-time Pusher/WebSocket traffic should never be intercepted by the cache
  if (url.protocol.startsWith("ws") || url.pathname.includes("pusher")) {
    return;
  }
});
