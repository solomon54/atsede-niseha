// src/features/father/hooks/useChildren.ts
import { useCallback, useEffect, useState } from "react";

import { BaseDirectoryRecord } from "@/shared/types";

export function useChildren(fatherEotcUid: string) {
  const [data, setData] = useState<BaseDirectoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChildren = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/father/children?fatherEotcUid=${fatherEotcUid}`
      );
      const result = await res.json();
      if (result.success) {
        setData(result.children);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("የመረብ ግንኙነት ችግር (Connection Error)");
    } finally {
      setLoading(false);
    }
  }, [fatherEotcUid]);

  useEffect(() => {
    if (fatherEotcUid) fetchChildren();
  }, [fetchChildren]);

  return { data, loading, error, refetch: fetchChildren };
}
