// src/features/governor/components/AuthorizeFathersForm.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FiRefreshCw, FiTrash2, FiUpload } from "react-icons/fi";
import { MdCheckCircle, MdOutlinePhotoCamera, MdWifiOff } from "react-icons/md";
import { z } from "zod";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";

/**
 * @Schema - Strict Validation
 */
const schema = z.object({
  uid: z
    .string()
    .startsWith("EOTC-", "መለያው በ EOTC- መጀመር አለበት")
    .min(12, "መለያው በትክክል አልተሞላም"),
  title: z.string().min(1, "መንፈሳዊ ማዕረግ ይምረጡ"),
  secularTitle: z.string().optional(),
  fullName: z.string().min(3, "ሙሉ ስም ያስፈልጋል"),
  academics: z.string().min(2, "የትምህርት ዝግጅት ያስፈልጋል"),
  email: z.string().email("ትክክለኛ ኢሜይል ያስገቡ"),
  phone: z
    .string()
    .startsWith("+251", "የስልክ ቁጥሩ በ +251 መጀመር አለበት")
    .min(13, "ትክክለኛ ስልክ ቁጥር ያስገቡ"),
  diocese: z.string().min(2, "ሀገረ ስብከት ያስፈልጋል"),
  parish: z.string().min(3, "ደብር/ገዳም ያስፈልጋል"),
  languages: z.array(z.string()).min(1, "ቢያንስ አንድ ቋንቋ ይምረጡ"),
});

type FormData = z.infer<typeof schema>;

const SPIRITUAL_TITLES = [
  "ሊቀ ሊቃዉንት",
  "መልአከ ሰላም",
  "መልአከ መንክራት",
  "ቆሞስ",
  "ሊቀ ካህናት",
  "መጋቤ ሐዲስ",
  "ቀሲስ",
];

const LANGUAGES = ["አማርኛ", "ግዕዝ", "ትግርኛ", "Oromiffa", "Hadiyisa", "English"];

export default function AuthorizeFathersForm() {
  // States
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error" | "offline";
    text: string;
  } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);

  // Form Initialization
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      languages: [],
      uid: "EOTC-########",
      phone: "+251",
    },
  });

  const currentUid = watch("uid");

  // Connectivity Listener
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Logic: ID Generation
  const generateId = () => {
    const hex = Math.random().toString(16).slice(2, 10).toUpperCase();
    setValue("uid", `EOTC-${hex}`, { shouldValidate: true });
  };

  // Logic: File Handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      alert("የፎቶ ፋይል ብቻ ይምረጡ");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      alert("ፎቶው ከ 5MB በታች መሆን አለበት");
      return;
    }

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const removePhoto = () => {
    setPreview(null);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Submission Handler
  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setStatus(null);

    // Offline Resilience
    if (!navigator.onLine) {
      localStorage.setItem("eotc_offline_cache", JSON.stringify(data));
      setStatus({
        type: "offline",
        text: "ኢንተርኔት የለም። መረጃው በስልኩ ላይ ተቀምጧል፤ ኢንተርኔት ሲመጣ ይላካል። 💾",
      });
      setLoading(false);
      return;
    }

    try {
      let photoUrl = "";

      // Image Upload Step
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", "father-portrait");

        const upload = await fetch("/api/upload", { method: "POST", body: fd });
        if (!upload.ok) throw new Error("የምስል ጭነት አልተሳካም");

        const { url } = await upload.json();
        photoUrl = url;
      }

      // Authorization Step
      const res = await fetch("/api/governor/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, photoUrl }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "ምዝገባ አልተሳካም");
      }

      // Success Reset
      setStatus({ type: "success", text: "በክብር ተመዝግቧል ✞" });
      reset({ uid: "EOTC-########", phone: "+251", languages: [] });
      setPreview(null);
      setFile(null);
    } catch (err: any) {
      setStatus({
        type: "error",
        text: err.message || "የኔትወርክ ችግር ተፈጥሯል",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SanctuarySurface>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto max-w-4xl space-y-6 bg-white backdrop-blur-md border-2 border-amber-200/40 shadow-2xl rounded-[1.5rem] p-4 sm:p-8 md:p-12 md:space-y-10 lg:rounded-[2.5rem] transition-all duration-500">
        {/* Adaptive Header */}
        <div className="pb-6 border-b-2 border-amber-100 flex items-center justify-between sm:pb-8">
          <div>
            <h2 className="text-[22px] sm:text-3xl md:text-4xl font-black font-ethiopic text-slate-900 leading-tight">
              የአባቶች መዝገብ
            </h2>
            <p className="text-[9px] sm:text-[11px] font-black text-amber-700 uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-1 sm:mt-2">
              High Ecclesiastical Registry
            </p>
          </div>
          <div className="text-3xl sm:text-5xl text-amber-600 drop-shadow-sm select-none">
            ✞
          </div>
        </div>

        {/* Global Grid System */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-10 sm:gap-y-8">
          {/* UID - Ecclesiastical Token */}
          <div className="md:col-span-2">
            <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              የምዝገባ መለያ ቁጥር/unique ID (EOTC Token)
            </label>
            <div className="flex flex-col min-[320px]:flex-row gap-2">
              <div className="flex-1 flex items-center bg-black rounded-xl sm:rounded-2xl p-1 border border-amber-900/50 shadow-2xl overflow-hidden">
                <div className="flex-1 px-4 py-3 sm:py-4 text-[13px] sm:text-base font-mono font-black text-amber-400 tracking-widest overflow-hidden">
                  <span className="opacity-65 mr-1 text-slate-100">EOTC-</span>
                  {currentUid?.split("-")[1] || "########"}
                </div>
                <button
                  title="Generate New Token"
                  type="button"
                  onClick={generateId}
                  className="bg-amber-600 hover:bg-amber-500 text-black p-3 sm:p-4 rounded-lg sm:rounded-xl transition-all active:scale-90">
                  <FiRefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>
            <input type="hidden" {...register("uid")} />
            {errors.uid && (
              <p className="text-red-600 text-[10px] sm:text-xs font-bold mt-2 ml-1">
                ⚠ {errors.uid.message}
              </p>
            )}
          </div>

          {/* Spiritual Title */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ማዕረግ (Title)
            </label>
            <div className="relative">
              <select
                {...register("title")}
                className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl text-[14px] sm:text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm appearance-none">
                <option value="">ይምረጡ...</option>
                {SPIRITUAL_TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                ▼
              </div>
            </div>
            {errors.title && (
              <p className="text-red-600 text-[10px] sm:text-xs font-bold mt-2 ml-1">
                ⚠ {errors.title.message}
              </p>
            )}
          </div>

          {/* Secular Title */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ዓለማዊ (Secular)
            </label>
            <input
              {...register("secularTitle")}
              placeholder="Dr., Prof., Eng..."
              className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl text-[14px] sm:text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
            />
          </div>

          {/* Full Name */}
          <div className="md:col-span-2">
            <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ሙሉ ስም (Full Name)
            </label>
            <input
              {...register("fullName")}
              className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl text-[15px] sm:text-lg font-black text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
            />
            {errors.fullName && (
              <p className="text-red-600 text-[10px] sm:text-xs font-bold mt-2 ml-1">
                ⚠ {errors.fullName.message}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ስልክ (Phone)
            </label>
            <input
              {...register("phone")}
              className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl text-[14px] sm:text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
              placeholder="+251-9..."
            />
            {errors.phone && (
              <p className="text-red-600 text-[10px] sm:text-xs font-bold mt-2 ml-1">
                ⚠ {errors.phone.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ኢሜይል (Email)
            </label>
            <input
              {...register("email")}
              type="email"
              className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl text-[14px] sm:text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
            />
          </div>

          {/* Academics */}
          <div className="md:col-span-2 lg:col-span-1">
            <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              የትምህርት ዝግጅት (Academics)
            </label>
            <input
              {...register("academics")}
              className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl text-[14px] sm:text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
            />
          </div>

          {/* Diocese */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ሀገረ ስብከት (Diocese)
            </label>
            <input
              {...register("diocese")}
              className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl text-[14px] sm:text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
            />
          </div>

          {/* Parish */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ደብር / ገዳም (Parish)
            </label>
            <input
              {...register("parish")}
              className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl text-[14px] sm:text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Extended UI: Photo & Languages */}

        <div className="space-y-8 sm:space-y-12 pt-6">
          {/* Language Matrix - Ultra-Compact for Mobile */}
          <div className="bg-slate-50 p-3 sm:p-10 rounded-[1.2rem] sm:rounded-[2.5rem] border-2 border-slate-100 shadow-inner">
            <label className="block text-[9px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 sm:mb-6">
              የአገልግሎት ቋንቋዎች (Service Languages)
            </label>

            <div className="flex flex-wrap gap-2 sm:gap-5">
              {LANGUAGES.map((lang) => (
                <label
                  key={lang}
                  className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 sm:px-6 sm:py-4 sm:border-2 rounded-lg sm:rounded-2xl cursor-pointer hover:border-amber-400 transition-all has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50 shadow-sm active:scale-95">
                  <input
                    type="checkbox"
                    value={lang}
                    {...register("languages")}
                    className="w-3.5 h-3.5 sm:w-5 sm:h-5 accent-amber-600 rounded"
                  />
                  <span className="text-[11px] sm:text-base font-black text-slate-700 whitespace-nowrap">
                    {lang}
                  </span>
                </label>
              ))}
            </div>

            {errors.languages && (
              <p className="text-red-500 text-[9px] sm:text-xs font-bold mt-3">
                ⚠ {errors.languages.message}
              </p>
            )}
          </div>

          {/* Portrait Picker */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4 text-center">
              Ecclesiastical Portrait / መንፈሳዊ ምስል
            </label>

            <div
              onClick={() => fileRef.current?.click()}
              className={`group relative border-4 border-dashed rounded-[1.5rem] sm:rounded-[2.5rem] h-48 sm:h-72 flex flex-col items-center justify-center cursor-pointer transition-all duration-500 overflow-hidden ${
                preview
                  ? "border-amber-400 bg-amber-50/20"
                  : "border-slate-200 bg-slate-50/50 hover:border-amber-400 hover:bg-amber-50/30"
              }`}>
              {preview ? (
                <>
                  <img
                    src={preview}
                    alt="Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent" />
                  <button
                    title="Remove Photo"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto();
                    }}
                    className="absolute top-4 right-4 bg-white p-3 rounded-full shadow-2xl hover:bg-red-50 text-red-600 transition-transform active:scale-90">
                    <FiTrash2 size={20} />
                  </button>
                </>
              ) : (
                <div className="text-center p-4">
                  <MdOutlinePhotoCamera className="text-5xl sm:text-7xl text-amber-500 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <p className="font-black text-slate-800 text-base sm:text-xl">
                    ፎቶ ይምረጡ
                  </p>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
                    JPG / PNG / WEBP • Maximum 5 MB
                  </p>
                </div>
              )}
            </div>

            <input
              title="Upload Photo"
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col items-center gap-6 pt-8 border-t border-slate-100">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            className="w-full max-w-lg bg-slate-900 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-sm sm:text-base uppercase tracking-[0.2em] py-5 sm:py-7 rounded-2xl sm:rounded-[2rem] shadow-2xl shadow-amber-900/20 transition-all flex items-center justify-center gap-3">
            {loading ? "በሂደት ላይ..." : "በክብር መዝግብ ✞"}
          </motion.button>

          {/* Contextual Status Feedback */}
          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`w-full max-w-lg p-5 rounded-2xl text-center text-[12px] sm:text-sm font-black flex items-center justify-center gap-3 border-2 ${
                  status.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : status.type === "offline"
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}>
                {status.type === "success" && (
                  <MdCheckCircle className="text-2xl" />
                )}
                {status.type === "offline" && (
                  <MdWifiOff className="text-2xl" />
                )}
                {status.text}
              </motion.div>
            )}
          </AnimatePresence>

          {!isOnline && (
            <div className="text-blue-600 text-[10px] font-bold uppercase tracking-widest animate-pulse">
              System Operating in Offline Vault Mode
            </div>
          )}
        </div>
      </form>
    </SanctuarySurface>
  );
}
