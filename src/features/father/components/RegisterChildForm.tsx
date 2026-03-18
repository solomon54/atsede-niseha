// src/features/father/components/RegisterChildForm.tsx
/**
 * EOTC Sacred Ledger - RegisterChildForm
 * ------------------------------------------------------------
 * Final Production Build: Unified Validation & Pristine Reset.
 * Bridges ecclesiastical tradition with modern technical precision.
 * * FEATURES:
 * - Pristine Reset: Deep scrub of form state post-success to prevent ghost errors.
 * - Premium Toast UI: Smooth floating notifications for success/error states.
 * - Mode 'onTouched': Reduces validation noise while the user is typing.
 */

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Church, RefreshCcw, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { getTodayEthiopian } from "@/shared/utils/calendar/ethiopianCalendar";
import { cn } from "@/shared/utils/utils";

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
  onSuccess?: () => void; // Add this to refresh the directory
}

export default function RegisterChildForm({
  fatherId,
  fatherEotcId,
  onSuccess, // Destructure here
}: RegisterChildFormProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterChildFormData>({
    resolver: zodResolver(RegisterChildSchema) as any,
    mode: "onTouched",
    defaultValues: {
      fullToken: "",
      secularName: "",
      christianName: "",
      spiritualFatherId: fatherEotcId,
      gender: undefined,
      birthDate: {
        year: getTodayEthiopian().year - 20, // Default to 20 years ago for convenience
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
      photoUrl: "",
    },
  });

  const currentToken = watch("fullToken");
  const hasErrors = Object.keys(errors).length > 0;

  /**
   * TOKEN GENERATOR
   * Interleaves Father and Child IDs for spiritual linkage.
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
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview(objectUrl);
    setValue("photoUrl", objectUrl, { shouldValidate: true });
  };

  const removePhoto = () => {
    setFile(null);
    setPreview(null);
    setValue("photoUrl", "", { shouldValidate: true });
  };

  /**
   * SUBMISSION LOGIC
   */
  const onSubmit: SubmitHandler<RegisterChildFormData> = async (data) => {
    setStatus(null);
    try {
      let photoUrl = "";
      // 1. Handle Portrait Upload
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

      // 2. Prepare the Sovereign Ledger Payload
      // We explicitly map spiritualFatherId to ensure the query works!
      const finalPayload = {
        ...data,
        photoUrl,
        fatherId, // Auth UID for security rules
        spiritualFatherId: fatherEotcId, // EOTC ID for directory linking
        eotcUid: currentToken, // The generated token
      };

      const res = await fetch("/api/father/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fatherId, data: finalPayload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "ምዝገባው አልተሳካም");
      }

      // 3. Success Workflow
      setStatus({ type: "success", text: "የልጁ መረጃ በክብር ተመዝግቧል ✞" });

      reset(
        {},
        {
          keepValues: false,
          keepErrors: false,
          keepDirty: false,
          keepTouched: true,
        }
      );

      removePhoto();
      generateFullToken();

      // Trigger directory refresh
      if (onSuccess) onSuccess();

      setTimeout(() => setStatus(null), 4000);
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
            <span className="px-3 py-1 bg-slate-900 text-amber-300 text-[8px] font-black uppercase rounded-full tracking-widest">
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

          <div className="pt-4 flex flex-col items-center gap-6 pb-6">
            <PortraitPicker
              preview={preview}
              onSelect={handlePhotoSelect}
              onRemove={removePhoto}
              error={errors.photoUrl?.message}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full md:w-2/3 lg:w-1/3 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:bg-slate-600",
                hasErrors
                  ? "bg-red-50 text-red-500 border border-red-100 cursor-not-allowed"
                  : "bg-slate-950 hover:bg-amber-600 text-white shadow-lg"
              )}>
              {isSubmitting ? (
                <RefreshCcw size={16} className="animate-spin text-amber-400" />
              ) : (
                <UserPlus
                  size={16}
                  className={hasErrors ? "text-red-500" : "text-amber-400"}
                />
              )}
              {isSubmitting
                ? "በሂደት ላይ..."
                : hasErrors
                ? "የጎደሉ መረጃዎችን ይሙሉ"
                : "መዝግብ ✞"}
            </button>
          </div>
        </form>
      </SanctuarySurface>

      {status && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div
            className={cn(
              "px-8 py-4 rounded-[2rem] shadow-2xl border backdrop-blur-xl flex items-center gap-4 min-w-[300px] justify-center",
              status.type === "success"
                ? "bg-emerald-50/95 border-emerald-200 text-emerald-900"
                : "bg-red-50/95 border-red-200 text-red-900"
            )}>
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full animate-pulse",
                status.type === "success"
                  ? "bg-emerald-500 shadow-[0_0_10px_#10b981]"
                  : "bg-red-500 shadow-[0_0_10px_#ef4444]"
              )}
            />
            <span className="text-[10px] font-black uppercase tracking-[0.15em]">
              {status.text}
            </span>
          </div>
        </div>
      )}

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
          transition: all 0.2s ease;
        }
        .sanctuary-input:focus {
          background: #ffffff;
          border-color: #fbbf24;
          box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1);
          outline: none;
        }
      `}</style>
    </div>
  );
}
