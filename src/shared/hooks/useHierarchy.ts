// src/shared/hooks/useHierarchy.ts
import { useMemo } from "react";

export function useHierarchy<T>(
  parentValue: string,
  map: Record<string, T[]>
): T[] {
  return useMemo(() => {
    if (!parentValue) return [];
    return map[parentValue] ?? [];
  }, [parentValue, map]);
}
