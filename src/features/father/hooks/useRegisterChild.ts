//src/features/father/hooks/useRegisterChild.ts

import { useCallback, useState } from "react";

import { RegisterChildFormData } from "../services/validators";

export function useRegisterChild(fatherId: string) {
  const [isSyncing, setIsSyncing] = useState(false);

  const generateToken = useCallback(() => {
    const hex = Math.random().toString(16).slice(2, 8).toUpperCase();
    return `EOTC-${fatherId.slice(0, 4)}-${hex}`;
  }, [fatherId]);

  const submitToLedger = async (data: RegisterChildFormData) => {
    setIsSyncing(true);
    // 1. Save to Local DB (WatermelonDB/Hive) immediately
    // 2. Queue for background sync
    console.log("Saving to local ledger...", data);
    setIsSyncing(false);
  };

  return { generateToken, submitToLedger, isSyncing };
}
