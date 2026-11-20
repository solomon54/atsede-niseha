/**
 * Reuses one promise per key. Incoming calls can arrive from FCM, Pusher, a
 * persisted intent, and route params at the same time; token/status requests
 * must not be duplicated by those overlapping hints.
 */
export function createInFlight<T>() {
  const pending = new Map<string, Promise<T>>();

  return {
    run(key: string, task: () => Promise<T>): Promise<T> {
      const existing = pending.get(key);
      if (existing) return existing;

      const promise = Promise.resolve().then(task);
      pending.set(key, promise);
      const clear = () => {
        if (pending.get(key) === promise) pending.delete(key);
      };
      promise.then(clear, clear);
      return promise;
    },
    clear(): void {
      pending.clear();
    },
    has(key: string): boolean {
      return pending.has(key);
    },
  };
}
