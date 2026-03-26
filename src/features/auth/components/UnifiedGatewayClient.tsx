//src/features/auth/components/UnifiedGatewayClient.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import IdentificationStep from "@/features/auth/components/IdentificationStep";
import ProfilePreviewStep from "@/features/auth/components/ProfilePreviewStep";
import SecuritySetupStep from "@/features/auth/components/SecuritySetupStep";
import { normalizeGateway } from "@/features/auth/utils/normalizeGateway";
import { SanctuaryBackground } from "@/shared/components/ui/sanctuary-background";
import { AuthContext, GatewayResponse } from "@/shared/types/auth.types";

export default function UnifiedGateway() {
  const [step, setStep] = useState<"ID_ENTRY" | "PREVIEW" | "SECURITY">(
    "ID_ENTRY"
  );
  const [context, setContext] = useState<AuthContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const checkPersistedSession = async () => {
      const savedId = localStorage.getItem("atsede_niseha_uid");
      if (savedId) {
        try {
          const res = await fetch("/api/auth/gateway", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eotcUid: savedId }),
          });
          const data = await res.json();

          if (data.success) {
            const result = normalizeGateway(data);
            if (result.success) {
              setContext(result.context);
              setStep(
                result.context.role === "GOVERNOR" ? "SECURITY" : "PREVIEW"
              );
            }
          }
        } catch (e) {
          console.error("Session restoration failed");
        }
      }
      setTimeout(() => setIsInitializing(false), 800);
    };
    checkPersistedSession();
  }, []);

  const handleIdSuccess = useCallback((data: GatewayResponse) => {
    const result = normalizeGateway(data);
    if (!result.success) {
      setError(result.message);
      return;
    }

    localStorage.setItem("atsede_niseha_uid", result.context.eotcUid);
    setContext(result.context);
    setError(null);
    setStep(result.context.role === "GOVERNOR" ? "SECURITY" : "PREVIEW");
  }, []);

  const handleBack = useCallback(() => {
    setError(null);
    setStep("ID_ENTRY");
  }, []);

  // 1. Initial Loading State (Prevents layout jump)
  if (isInitializing) {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center bg-[#fdfcf6]">
        <SanctuaryBackground />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-6">
          <div className="relative w-20 h-20 md:w-24 md:h-24">
            <div className="absolute inset-0 rounded-full border-2 border-amber-200 border-t-amber-600 animate-spin" />
            <div className="absolute inset-1 rounded-full overflow-hidden">
              <Image
                src="/assets/images/qdst-bite-krstiyan.jpg"
                alt="Logo"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
          <p className="text-[9px] text-amber-700 font-bold uppercase tracking-[0.3em] animate-pulse">
            ማንነትዎን በማረጋገጥ ላይ...
          </p>
        </motion.div>
      </main>
    );
  }

  // 2. Main Flow State
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start md:justify-center overflow-x-hidden bg-[#fdfcf6] pt-0">
      <SanctuaryBackground />

      {/* Decorative Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="relative w-full max-w-2xl z-10 flex flex-col items-center pt-0">
        <AnimatePresence mode="popLayout">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 w-[90%] max-w-sm px-6 py-3 bg-white border border-red-100 rounded-2xl flex items-center gap-3 shadow-xl">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <p className="text-[10px] font-bold text-red-900 leading-tight uppercase tracking-tighter">
                {error}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full flex justify-center items-center px-0">
          <AnimatePresence mode="wait" initial={false}>
            {step === "ID_ENTRY" && (
              <motion.div
                key="id-step"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full">
                <IdentificationStep onSuccess={handleIdSuccess} />
              </motion.div>
            )}

            {step === "PREVIEW" && context && (
              <motion.div
                key="preview-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full">
                <ProfilePreviewStep
                  data={context}
                  role={context.role}
                  onConfirm={() => setStep("SECURITY")}
                  onBack={handleBack}
                />
              </motion.div>
            )}

            {step === "SECURITY" && context && (
              <motion.div
                key="security-step"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full">
                <SecuritySetupStep context={context} onBack={handleBack} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
