import { useEffect, useRef, useState } from "react";
import { QueryKey, useQueryClient } from "@tanstack/react-query";

/**
 * Render cached data immediately while the network request is in flight.
 *
 * React Query starts its fetch on mount, so an `initialData` option cannot be
 * used (SQLite reads are async and arrive after mount). Instead we seed the
 * query cache as soon as the read resolves. The network response still wins:
 * seeding only fills in a query that has no data yet.
 *
 * Returns `cacheChecked` so a screen can tell "the cache has not been read
 * yet" apart from "there really is nothing to show" — without it, an empty
 * cache would flash the empty state before the first response arrives.
 */
export function useCacheFirst<T>(
  queryKey: QueryKey,
  load: () => Promise<T | null>
): boolean {
  const queryClient = useQueryClient();
  const [cacheChecked, setCacheChecked] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;
  const serializedKey = JSON.stringify(queryKey);

  useEffect(() => {
    let cancelled = false;
    setCacheChecked(false);

    (async () => {
      try {
        const cached = await loadRef.current();

        if (!cancelled && cached != null) {
          queryClient.setQueryData<T>(queryKey, (prev) => prev ?? cached);

          // Seeded data is not fresh. Mark it stale without cancelling the
          // request that is already running, so a later mount refetches.
          await queryClient.invalidateQueries({
            queryKey,
            exact: true,
            refetchType: "none",
          });
        }
      } catch (error) {
        console.warn("Cache hydration failed:", error);
      } finally {
        if (!cancelled) setCacheChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `load` is intentionally excluded: callers pass an inline closure and the
    // serialized key is the real identity of the cache entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, serializedKey]);

  return cacheChecked;
}
