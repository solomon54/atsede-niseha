// src/features/father/hooks/useChildrenDirectory.ts
import { useEffect, useState } from "react";

import { BaseDirectoryRecord } from "@/shared/types";

export function useChildrenDirectory(fatherEotcUid: string) {
  const [children, setChildren] = useState<BaseDirectoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChildren() {
      try {
        const res = await fetch(
          `/api/father/children?fatherEotcUid=${fatherEotcUid}`
        );
        const result = await res.json();

        if (result.success) {
          setChildren(result.children);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError("Network error occurred");
      } finally {
        setLoading(false);
      }
    }

    if (fatherEotcUid) fetchChildren();
  }, [fatherEotcUid]);

  return { children, loading, error };
}
