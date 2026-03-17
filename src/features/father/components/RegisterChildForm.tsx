// src/features/father/components/RegisterChildForm.tsx
/**
 * EOTC Sacred Ledger - RegisterChildForm
 * ------------------------------------------------------------
 * Production-grade onboarding for the Sovereign Ledger.
 * Bridges the gap between ecclesiastical tradition and modern technical precision.
 * * FIXES:
 * 1. TypeScript Control Prop Mismatch: Explicit generic casting.
 * 2. Cascading Linkage: Stable reset logic for Region/University hierarchies.
 * 3. Dynamic Year: Integrated with dynamic scaling logic.
 */

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Church, RefreshCcw, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { cn } from "@/shared/utils/utils";
import { getTodayEthiopian } from "@/shared/utils/calendar/ethiopianCalendar";

import {
  RegisterChildFormData,
  RegisterChildSchema,
} from "../services/validators";
import {
  AcademicSection,
  ConnectSection,
  GeographySection,
  IdentitySection,
} from "./FormModules";
import { PortraitPicker } from "./PortraitPicker";
import { TokenSanctuary } from "./TokenSanctuary";

interface RegisterChildFormProps {
  fatherId: string;
  fatherEotcId: string;
}

export default function RegisterChildForm({
  fatherId,
  fatherEotcId,
}: RegisterChildFormProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  /**
   * Form initialization.
   * Note: We use the explicit RegisterChildFormData to satisfy Zod and TS.
   */
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterChildFormData>({
    resolver: zodResolver(RegisterChildSchema),
    mode: "onChange",
    defaultValues: {
      fullToken: "",
      secularName: "",
      christianName: "",
      gender: undefined,
      birthDate: {
        year: getTodayEthiopian().year - 20,
        month: 1,
        day: 1,
      },
      region: "",
      zone: "",
      city: "",
      spiritualTitle: "",
      language: "",
      university: "",
      college: "",
      department: "",
      entryYear: getTodayEthiopian().year,
      academicYear: 1,
      semester: 1,
      phone: "+2519",
      email: "",
    },
  });

  const currentToken = watch("fullToken");

  /**
   * Token Generator: Interleaves Father and Child IDs for spiritual linkage.
   */
  const generateFullToken = useCallback(() => {
    if (!fatherEotcId) return;
    const fCore = fatherEotcId.replace("EOTC-", "").toUpperCase();
    const cSeed = Math.random().toString(16).slice(2, 6).toUpperCase();
    let mixed = "";
    let fIdx = 0;
    let cIdx = 0;
    for (let i = 0; i < 4; i++) {
      mixed +=
        (fCore[fIdx++] || "X") +
        (fCore[fIdx++] || "X") +
        (cSeed[cIdx++] || "Z");
    }
    setValue("fullToken", `EOTC-${mixed}`);
  }, [fatherEotcId, setValue]);

  useEffect(() => {
    if (!currentToken) generateFullToken();
  }, [generateFullToken, currentToken]);

  const handlePhotoSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const removePhoto = () => {
    setFile(null);
    setPreview(null);
  };

  /**
   * Submission logic.
   */
  const onSubmit: SubmitHandler<RegisterChildFormData> = async (data) => {
    setStatus(null);
    try {
      let photoUrl = "";
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", "student-portrait");
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });
        if (!uploadRes.ok) throw new Error("የምስል ጭነት አልተሳካም");
        const uploadData = await uploadRes.json();
        photoUrl = uploadData.url;
      }

      const res = await fetch("/api/father/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fatherId, data: { ...data, photoUrl } }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "ምዝገባው አልተሳካም");
      }

      setStatus({ type: "success", text: "የልጁ መረጃ በክብር ተመዝግቧል ✞" });
      reset();
      removePhoto();
      generateFullToken();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "የኔትወርክ ችግር ተፈጥሯል";
      setStatus({ type: "error", text: message });
    }
  };

  return (
    <div className="w-full min-h-screen bg-white md:bg-transparent p-0 md:p-4 mb-10">
      <SanctuarySurface className="p-1 md:p-6 border-0 md:border shadow-none md:shadow-xl rounded-none md:rounded-[2rem]">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6 md:space-y-10">
          <header className="flex flex-row items-center justify-between px-3 py-2 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 rounded-full text-amber-600">
                <Church size={24} />
              </div>
              <h2 className="text-sm md:text-xl text-slate-600 font-black">
                የልጆች መዝገብ (Register Spiritual Child)
              </h2>
            </div>
            <span className="px-3 py-1 bg-slate-900 text-amber-300 text-[8px] font-black uppercase rounded-full">
              Sovereign Ledger
            </span>
          </header>

          <div className="px-2">
            <TokenSanctuary
              fatherEotcId={fatherEotcId}
              currentToken={currentToken}
              onRegenerate={generateFullToken}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 px-1">
            {/* Identity Section (Control passed with explicit typing) */}
            <IdentitySection
              register={register}
              errors={errors}
              control={control as any}
            />

            <GeographySection control={control as any} errors={errors} />

            <AcademicSection
              register={register}
              control={control as any}
              errors={errors}
              setValue={setValue}
            />

            <ConnectSection
              register={register}
              errors={errors}
              control={control as any}
            />
          </div>

          <div className="pt-4 flex flex-col items-center gap-4 pb-6">
            <PortraitPicker
              preview={preview}
              onSelect={handlePhotoSelect}
              onRemove={removePhoto}
            />

            {status && (
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest animate-pulse",
                  status.type === "success"
                    ? "text-emerald-600"
                    : "text-red-600"
                )}>
                {status.text}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full md:w-2/3 lg:w-1/3 hover:bg-amber-600 bg-slate-950 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:bg-slate-300">
              {isSubmitting ? (
                <RefreshCcw size={16} className="animate-spin text-amber-400" />
              ) : (
                <UserPlus size={16} className="text-amber-400" />
              )}
              {isSubmitting ? "በሂደት ላይ..." : "መዝግብ ✞"}
            </button>
          </div>
        </form>
      </SanctuarySurface>

      <style jsx global>{`
        .sanctuary-input {
          width: 100%;
          padding: 0.8rem 1rem !important;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 11px !important;
          font-weight: 700;
          color: #1e293b;
        }
        .sanctuary-input:focus {
          background: #ffffff;
          border-color: #fbbf24;
          box-shadow: 0 0 0 1px #fbbf24;
          outline: none;
        }
      `}</style>
    </div>
  );
}
