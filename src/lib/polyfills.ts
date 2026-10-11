/**
 * Polyfills for Safari 15.x (iPad mini 4 / iOS 15.8)
 *
 * This file patches missing Web APIs so the app works on older WebKit.
 * Import this ONCE at the top of the root layout (client boundary).
 *
 * Safari 15 already supports:
 *  - nullish coalescing (??)          ✓ since 13.1
 *  - optional chaining (?.)           ✓ since 13.1
 *  - private class fields (#)         ✓ since 15
 *  - structuredClone                  ✓ since 15.4
 *  - crypto.randomUUID               ✓ since 15.4
 *  - Array.prototype.at              ✓ since 15.4
 *  - Object.hasOwn                   ✓ since 15.4
 *  - globalThis                      ✓ since 12.1
 *  - CSS @layer                      ✓ since 15.4
 *
 * Missing in Safari 15 that we polyfill below:
 *  - AbortSignal.timeout()           needs Safari 16+
 *  - Array.prototype.findLast()      needs Safari 15.4 (edge case)
 *  - Array.prototype.findLastIndex() needs Safari 15.4 (edge case)
 */

/* ---- AbortSignal.timeout() ---- */
if (typeof AbortSignal !== "undefined" && !("timeout" in AbortSignal)) {
  Object.defineProperty(AbortSignal, "timeout", {
    value(ms: number): AbortSignal {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("TimeoutError", "TimeoutError")), ms);
      return controller.signal;
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

/* ---- Array.prototype.findLast ---- */
if (!Array.prototype.findLast) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.findLast = function <T>(
    this: T[],
    predicate: (value: T, index: number, array: T[]) => boolean,
  ): T | undefined {
    for (let i = this.length - 1; i >= 0; i--) {
      if (predicate(this[i], i, this)) return this[i];
    }
    return undefined;
  };
}

/* ---- Array.prototype.findLastIndex ---- */
if (!Array.prototype.findLastIndex) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.findLastIndex = function <T>(
    this: T[],
    predicate: (value: T, index: number, array: T[]) => boolean,
  ): number {
    for (let i = this.length - 1; i >= 0; i--) {
      if (predicate(this[i], i, this)) return i;
    }
    return -1;
  };
}

export {};
