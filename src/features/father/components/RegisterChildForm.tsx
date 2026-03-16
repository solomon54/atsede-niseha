// src/features/father/components/RegisterChildForm.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Church, RefreshCcw, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { cn } from "@/shared/utils/utils";

import {
  RegisterChildFormData,
  RegisterChildSchema,
} from "../services/validators";
import {
  AcademicSection,
  ConnectSection,
  IdentitySection,
} from "./FormModules";
import { PortraitPicker } from "./PortraitPicker";
import { TokenSanctuary } from "./TokenSanctuary";

/**
 * Prop definition for the Registration form.
 * Includes fatherId for database pathing and fatherEotcId for token mixing.
 */
interface RegisterChildFormProps {
  fatherId: string;
  fatherEotcId: string;
}

/**
 * RegisterChildForm: Handles the creation of a new Spiritual Child profile.
 * Implements a "Covenant Mixer" that interleaves Father and Child IDs.
 * Features:
 * - Precise Hex-Interleaving for inter-generational token safety.
 * - Cloudinary image upload via local API bridge.
 * - Modular form sections for Identity, Academic, and Connectivity.
 */
export default function RegisterChildForm({
  fatherId,
  fatherEotcId,
}: RegisterChildFormProps) {
  /** Local state for portrait preview and file management */
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  /** Initialize form with react-hook-form + zod validation */
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegisterChildFormData>({
    resolver: zodResolver(RegisterChildSchema),
    mode: "onChange",
    defaultValues: {
      phone: "+251",
      spiritualTitle: "",
      language: "",
      fullToken: "",
      // Initialize birthDate to resolve 'unknown' type errors in the resolver
      birthDate: { year: 0, month: 1, day: 1 },
    },
  });

  const currentToken = watch("fullToken");

  /**
   * THE COVENANT MIXER LOGIC
   * Generates the 12-character Covenant Key.
   * Logic: Interleaves the first 4 chars of Father's Hex with a 4-char Child Seed,
   * then appends the remaining 4 chars of the Father's Hex.
   */
  const generateFullToken = useCallback(() => {
    if (!fatherEotcId) {
      setValue("fullToken", "EOTC-PENDING");
      return;
    }

    // Extract the Hex portion of the EOTC ID (removes prefix)
    const fCore = fatherEotcId.replace("EOTC-", "").toUpperCase();
    // Generate a unique 4-character seed for the child
    const cSeed = Math.random().toString(16).slice(2, 6).toUpperCase();

    let mixed = "";
    // Step 1: Interleave (FatherChar + ChildChar) for the first 4 pairs
    for (let i = 0; i < 4; i++) {
      mixed += (fCore[i] || "0") + (cSeed[i] || "0");
    }
    // Step 2: Append the final 4 characters of the Father's Core Hex
    mixed += fCore.slice(4, 8);

    setValue("fullToken", `EOTC-${mixed}`);
  }, [fatherEotcId, setValue]);

  /** Ensure token is generated on mount or when context changes */
  useEffect(() => {
    if (!currentToken) generateFullToken();
  }, [generateFullToken, currentToken]);

  /** Debug log for validation errors in development */
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.warn("❌ Form Validation Errors:", errors);
    }
  }, [errors]);

  const handlePhotoSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const removePhoto = () => {
    setFile(null);
    setPreview(null);
  };

  /**
   * Primary Submission Handler
   * Bridges the UI data to the server-side Firestore orchestration.
   */
  const onSubmit: SubmitHandler<RegisterChildFormData> = async (data) => {
    setStatus(null);
    try {
      let photoUrl = "";

      // Step 1: Portrait Upload to Cloudinary
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", "student-portrait");

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });
        if (!uploadRes.ok) throw new Error("የምስል ጭነት አልተሳካም (Upload failed)");

        const uploadData = await uploadRes.json();
        photoUrl = uploadData.url;
      }

      // Step 2: Persist complete record to Backend
      const res = await fetch("/api/father/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fatherId, // Auth UID for database pathing
          data: { ...data, photoUrl },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "ምዝገባው አልተሳካም (Registration failed)");
      }

      // Step 3: Cleanup and notification
      setStatus({ type: "success", text: "የልጁ መረጃ በክብር ተመዝግቧል ✞" });
      reset();
      removePhoto();
      generateFullToken();
    } catch (err: any) {
      setStatus({ type: "error", text: err.message || "የኔትወርክ ችግር ተፈጥሯል" });
    }
  };

  return (
    <div className="w-full min-h-screen bg-white md:bg-transparent p-0 md:p-4 mb-10">
      <SanctuarySurface className="p-1 md:p-6 border-0 md:border shadow-none md:shadow-xl rounded-none md:rounded-[2rem]">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6 md:space-y-10">
          {/* HEADER SECTION */}
          <header className="flex flex-row items-center justify-between px-3 py-2 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 rounded-full text-amber-600">
                <Church size={18} />
              </div>
              <h2 className="text-sm md:text-xl text-slate-600 font-black font-ethiopic">
                የልጆች መዝገብ
              </h2>
            </div>
            <p className="text-[8px] font-black text-amber-300 rounded-xl p-1 uppercase tracking-widest inline-block bg-slate-900">
              Child Onboarding
            </p>
          </header>

          {/* TOKEN DISPLAY: Passing both IDs for visual context */}
          <div className="px-2">
            <TokenSanctuary
              fatherEotcId={fatherEotcId}
              currentToken={currentToken}
              onRegenerate={generateFullToken}
            />
          </div>

          {/* FORM GRID: 3-Column layout for desktop */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 px-1">
            <IdentitySection register={register} errors={errors} />
            <AcademicSection register={register} errors={errors} />
            <ConnectSection
              register={register}
              errors={errors}
              watch={watch}
              setValue={setValue}
            />
          </div>

          {/* SUBMISSION BLOCK */}
          <div className="pt-4 flex flex-col items-center gap-4 pb-6">
            <PortraitPicker
              preview={preview}
              onSelect={handlePhotoSelect}
              onRemove={removePhoto}
            />

            {status && (
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
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
              className={`
                w-[95%] hover:bg-amber-600/75 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest 
                flex items-center justify-center gap-2
                bg-slate-950 text-white hover:scale-105
                focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
                active:scale-95 active:bg-slate-800
                cursor-pointer transition-all duration-300 ease-in-out
                disabled:bg-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed
              `}>
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

      {/* Global CSS for modular form inputs */}
      <style jsx global>{`
        .sanctuary-input {
          width: 100%;
          padding: 0.75rem 0.85rem !important;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 11px !important;
          font-weight: 600;
          color: #0f172a;
          outline: none;
        }

        label {
          font-size: 9px !important;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 2px !important;
          display: block;
          color: #64748b;
        }

        @media (max-width: 768px) {
          .sanctuary-surface {
            border-radius: 0 !important;
            margin: 0 !important;
            width: 100vw !important;
          }
        }
      `}</style>
    </div>
  );
}
