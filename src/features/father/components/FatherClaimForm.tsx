//src/features/father/components/FatherClaimForm.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiUser,
} from "react-icons/fi";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";

export default function FatherClaimForm() {
  const [step, setStep] = useState(1);
  const [eotcId, setEotcId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [foundFather, setFoundFather] = useState<any>(null);

  const handleVerifyId = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/father/verify-id", {
        method: "POST",
        body: JSON.stringify({ eotcId: eotcId.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setFoundFather(data);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}>
            <SanctuarySurface>
              <div className="space-y-2 p-3 text-center">
                <h2 className="text-xl md:text-3xl font-black font-ethiopic text-slate-900 tracking-tighter">
                  ማንነትዎን ያረጋግጡ
                </h2>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.3em]">
                  Identity Authentication
                </p>
              </div>

              <div className="space-y-6 p-3">
                <div className="group space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">
                    Ecclesiastical ID
                  </label>
                  <input
                    type="text"
                    placeholder="EOTC-XXXXXXXX"
                    value={eotcId}
                    onChange={(e) => setEotcId(e.target.value.toUpperCase())}
                    className="w-full px-8 py-6 bg-slate-50 text-slate-400 border-2 border-slate-100 rounded-2xl font-mono font-bold text-base md:text-xl focus:bg-white focus:border-amber-500 outline-none transition-all"
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl text-xs font-bold">
                    <FiAlertCircle /> {error}
                  </motion.div>
                )}

                <button
                  onClick={handleVerifyId}
                  disabled={loading || eotcId.length < 5}
                  className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-amber-600 transition-all flex items-center justify-center gap-3 group">
                  {loading ? (
                    "በማረጋገጥ ላይ..."
                  ) : (
                    <>
                      ቀጥል{" "}
                      <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </SanctuarySurface>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 text-center">
            <SanctuarySurface className="p-10 rounded-[3rem] bg-white border-emerald-100 shadow-xl border-t-4 border-t-emerald-500">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FiUser size={32} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">
                    Authenticated Account
                  </p>
                  <h3 className="text-2xl font-black font-ethiopic text-slate-900">
                    {foundFather?.title} {foundFather?.fullName}
                  </h3>
                  <p className="text-sm font-bold text-slate-400">
                    {foundFather?.diocese} አህጉረ ስብከት
                  </p>
                </div>
              </div>
            </SanctuarySurface>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep(3)}
                className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest">
                ይህ እኔ ነኝ - ቀጥል ✞
              </button>
              <button
                onClick={() => setStep(1)}
                className="text-[12px] font-black bg-gray-100 text-red-500/70 uppercase tracking-widest hover:text-red-500 py-2 rounded-xl">
                ይህ እኔ አይደለሁም
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3 (Password) remains similar but connects to the actual claim API */}
      </AnimatePresence>
    </div>
  );
}
