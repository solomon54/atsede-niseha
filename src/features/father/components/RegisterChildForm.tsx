// //src/features/father/components/RegisterChildForm.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Camera,
  Church,
  Globe,
  RefreshCw,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";

const schema = z.object({
  fullToken: z.string(),
  secularName: z.string().min(3, "ሙሉ ስም ያስፈልጋል"),
  christianName: z.string().min(2, "የክርስትና ስም ያስፈልጋል"),
  gender: z.enum(["MALE", "FEMALE"], { required_error: "ጾታ ይምረጡ" }),
  birthPlace: z.string().min(2, "የትውልድ ቦታ ያስፈልጋል"),
  spiritualTitle: z.enum(["ምዕመን", "ዲያቆን", "መዘምር"]),
  university: z.string().min(2, "ዩኒቨርሲቲ ያስገቡ"),
  department: z.string().min(2, "ትምህርት ክፍል ያስገቡ"),
  entryYear: z.coerce.number().min(2000).max(2100),
  phone: z.string().startsWith("+251", "በ +251 ይጀምሩ").min(13, "ልክ ያልሆነ ስልክ"),
  email: z.string().email("ትክክለኛ ኢሜይል ያስገቡ").or(z.literal("")),
  language: z.string().min(1, "ቋንቋ ይምረጡ"),
  customLanguage: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const COMMON_LANGS = [
  "አማርኛ",
  "ግዕዝ",
  "Oromiffa",
  "Tigrinya",
  "Hadiyissa",
  "English",
  "OTHER",
];

export default function RegisterChildForm({ fatherId }: { fatherId: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: "+251",
      entryYear: new Date().getFullYear(),
      spiritualTitle: "ምዕመን",
      language: "አማርኛ",
    },
  });

  const currentToken = watch("fullToken");
  const selectedLang = watch("language");

  const generateFullToken = () => {
    const childHex = Math.random().toString(16).slice(2, 10).toUpperCase();
    // Safety check: only prefix if fatherId exists
    const prefix = fatherId ? `EOTC-${fatherId}-` : "EOTC-PENDING-";
    setValue("fullToken", `${prefix}${childHex}`);
  };

  useEffect(() => {
    generateFullToken();
  }, [fatherId]);

  const handleRemoveImage = () => {
    setPreview(null);
    setShowDeleteWarning(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="w-full max-w-md mx-auto lg:max-w-5xl p-2 md:p-6 mb-20">
      <SanctuarySurface className="p-5 md:p-10 border-amber-200/40 shadow-2xl rounded-[2rem] md:rounded-[2.5rem] bg-white text-slate-900">
        <form
          onSubmit={handleSubmit((d) => console.log(d))}
          className="space-y-8">
          <header className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-slate-100">
            <div className="p-3 bg-amber-50 rounded-full text-amber-600">
              <Church size={28} />
            </div>
            <h2 className="text-2xl md:text-3xl font-black font-ethiopic">
              የልጆች መዝገብ
            </h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Ecclesiastical Onboarding
            </p>
          </header>

          {/* Token Display - Now Safe from 'slice' errors */}
          <div className="bg-slate-900 p-5 md:p-6 rounded-2xl md:rounded-3xl text-center relative overflow-hidden">
            <label className="text-[8px] font-black text-amber-500/60 uppercase tracking-widest mb-2 block">
              Covenant Link
            </label>
            <div className="flex flex-wrap justify-center items-center gap-1 font-mono text-xs md:text-lg">
              <span className="text-slate-400">
                EOTC-{fatherId?.slice(0, 4) || "####"}...-
              </span>
              <span className="text-amber-400 font-black tracking-widest">
                {currentToken?.split("-").pop()}
              </span>
              <button
                title="Regenerate"
                type="button"
                onClick={generateFullToken}
                className="ml-2 p-1.5 text-amber-500 hover:rotate-180 transition-transform">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {/* Column 1: Identity */}
            <div className="space-y-5">
              <SectionTitle title="Identity" />
              <Field label="የዓለም ስም" error={errors.secularName}>
                <input
                  {...register("secularName")}
                  className="sanctuary-input"
                  placeholder="Full Name"
                />
              </Field>
              <Field label="የክርስትና ስም" error={errors.christianName}>
                <input
                  {...register("christianName")}
                  className="sanctuary-input font-ethiopic"
                  placeholder="ኃይለ ማርያም"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ጾታ">
                  <select {...register("gender")} className="sanctuary-input">
                    <option value="MALE">ወንድ</option>
                    <option value="FEMALE">ሴት</option>
                  </select>
                </Field>
                <Field label="ማዕረግ">
                  <select
                    {...register("spiritualTitle")}
                    className="sanctuary-input">
                    <option value="ምዕመን">ምዕመን</option>
                    <option value="ዲያቆን">ዲያቆን</option>
                    <option value="መዘምር">መዘምር</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* Column 2: Academic */}
            <div className="space-y-5">
              <SectionTitle title="Academic" />
              <Field label="ዩኒቨርሲቲ">
                <input
                  {...register("university")}
                  className="sanctuary-input"
                />
              </Field>
              <Field label="ትምህርት ክፍል">
                <input
                  {...register("department")}
                  className="sanctuary-input"
                />
              </Field>
              <Field label="መግቢያ ዓ.ም">
                <input
                  type="number"
                  {...register("entryYear")}
                  className="sanctuary-input"
                />
              </Field>
            </div>

            {/* Column 3: Contact & Language */}
            <div className="space-y-5">
              <SectionTitle title="Connect" />
              <Field label="ስልክ" error={errors.phone}>
                <input {...register("phone")} className="sanctuary-input" />
              </Field>
              <Field label="ኢሜይል" error={errors.email}>
                <input
                  {...register("email")}
                  className="sanctuary-input"
                  placeholder="soul@church.org"
                />
              </Field>

              <div className="space-y-3">
                <Field label="ቋንቋ (Language)">
                  <select {...register("language")} className="sanctuary-input">
                    {COMMON_LANGS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Conditional Manual Language Input */}
                {selectedLang === "OTHER" && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <div className="relative">
                      <Globe
                        className="absolute left-3 top-3 text-amber-500"
                        size={16}
                      />
                      <input
                        {...register("customLanguage")}
                        className="sanctuary-input pl-10 border-amber-300 bg-amber-50/30"
                        placeholder="Specify Language..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer: Image Picker & Submit */}
          <div className="pt-8 border-t border-slate-100 flex flex-col items-center gap-8">
            <div className="w-full flex flex-col items-center gap-4">
              <div className="relative group">
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-28 h-28 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden shadow-inner transition-transform active:scale-95">
                  {preview ? (
                    <img
                      src={preview}
                      className="w-full h-full object-cover"
                      alt="preview"
                    />
                  ) : (
                    <Camera className="text-slate-300" size={32} />
                  )}
                </div>

                {preview && !showDeleteWarning && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteWarning(true)}
                    className="absolute -top-2 -right-2 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all scale-100 active:scale-90">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {showDeleteWarning && (
                <div className="w-full max-w-xs animate-in zoom-in-95 fade-in duration-200">
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start gap-3">
                    <AlertTriangle
                      className="text-amber-600 shrink-0"
                      size={18}
                    />
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-amber-900 leading-tight">
                        Remove portrait from ledger?
                      </p>
                      <div className="flex gap-4 mt-2">
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="text-[10px] font-black text-red-600 uppercase">
                          Yes, Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteWarning(false)}
                          className="text-[10px] font-black text-slate-500 uppercase">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!preview && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Upload Portrait
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95">
              <UserPlus size={18} className="text-amber-400" /> የንስሐ ልጅ መዝግብ ✞
            </button>
          </div>
        </form>
      </SanctuarySurface>

      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setPreview(URL.createObjectURL(f));
        }}
      />

      <style jsx>{`
        .sanctuary-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 0.75rem;
          font-size: 16px; /* Prevents iOS auto-zoom */
          font-weight: 600;
          color: #0f172a;
          outline: none;
          appearance: none;
          transition: all 0.2s ease;
        }
        .sanctuary-input:focus {
          border-color: #f59e0b;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.08);
        }
        select.sanctuary-input {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          background-size: 1rem;
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h4 className="text-[10px] font-black uppercase text-amber-600 tracking-[0.2em] flex items-center gap-2 mb-2">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {title}
    </h4>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: any;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full space-y-1">
      <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase tracking-tighter">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[9px] text-red-500 font-bold ml-1 animate-pulse">
          ⚠ {error.message}
        </p>
      )}
    </div>
  );
}
