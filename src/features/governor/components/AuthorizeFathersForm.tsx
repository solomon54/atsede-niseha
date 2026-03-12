// src/features/governor/components/AuthorizeFathersForm.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FiTrash2, FiUpload } from "react-icons/fi";
import { MdCheckCircle, MdOutlinePhotoCamera } from "react-icons/md";
import { z } from "zod";

import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";

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
  "ቀሲስ",
  "መልአከ ሰላም",
  "መልአከ መንክራት",
  "ቆሞስ",
  "ሊቀ ካህናት",
  "መጋቤ ሐዲስ",
];

const LANGUAGES = ["አማርኛ", "ግዕዝ", "ትግርኛ", "Oromiffa", "Hadiyisa", "English"];

export default function AuthorizeFathersForm() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

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
      uid: "EOTC-",
      phone: "+251",
    },
  });

  const generateId = () => {
    const hex = Math.random().toString(16).slice(2, 10).toUpperCase();
    setValue("uid", `EOTC-${hex}`);
  };

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

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setStatus(null);

    try {
      let photoUrl = "";

      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", "father-portrait");

        const upload = await fetch("/api/upload", { method: "POST", body: fd });
        if (!upload.ok) throw new Error("የምስል ጭነት አልተሳካም");

        const { url } = await upload.json();
        photoUrl = url;
      }

      const res = await fetch("/api/governor/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, photoUrl }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "ምዝገባ አልተሳካም");
      }

      setStatus({ type: "success", text: "በክብር ተመዝግቧል ✞" });
      reset({ uid: "EOTC-", phone: "+251", languages: [] });
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
        className="space-y-8 bg-white backdrop-blur-md border-2 border-amber-200/40 shadow-2xl rounded-[2.5rem] p-6 md:p-12 max-w-4xl mx-auto">
        {/* Header */}
        <div className="pb-8 border-b-2 border-amber-100 flex items-center justify-between">
          <div>
            <h2 className="text-3xl md:text-4xl font-black font-ethiopic text-slate-900">
              የአባቶች መዝገብ
            </h2>
            <p className="text-[11px] font-black text-amber-700 uppercase tracking-[0.3em] mt-2">
              High Ecclesiastical Registry
            </p>
          </div>
          <div className="text-5xl text-amber-600 drop-shadow-sm">✞</div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
          {/* UID - Prefix Handled */}
          <div className="md:col-span-2 lg:col-span-1">
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Unique Ecclesiastical ID
            </label>
            <div className="flex gap-2">
              <input
                {...register("uid")}
                className="flex-1 px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold font-mono text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
                placeholder="EOTC-XXXXXX"
              />
              <button
                type="button"
                onClick={generateId}
                className="px-6 bg-slate-900 hover:bg-amber-600 text-white text-[10px] font-black rounded-2xl shadow-lg transition-all active:scale-95 uppercase">
                Generate
              </button>
            </div>
            {errors.uid && (
              <p className="text-red-600 text-xs font-bold mt-2 ml-1">
                ⚠ {errors.uid.message}
              </p>
            )}
          </div>

          {/* Spiritual Title */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              መንፈሳዊ ማዕረግ (Title)
            </label>
            <select
              {...register("title")}
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm appearance-none">
              <option value="">ይምረጡ...</option>
              {SPIRITUAL_TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.title && (
              <p className="text-red-600 text-xs font-bold mt-2 ml-1">
                ⚠ {errors.title.message}
              </p>
            )}
          </div>

          {/* Secular Title */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ዓለማዊ ማዕረግ (Secular)
            </label>
            <input
              {...register("secularTitle")}
              placeholder="Dr., Prof., Eng..."
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
            />
          </div>

          {/* Phone - Prefix Logic Included */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ስልክ (Phone)
            </label>
            <input
              {...register("phone")}
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
              placeholder="+251-9..."
            />
            {errors.phone && (
              <p className="text-red-600 text-xs font-bold mt-2 ml-1">
                ⚠ {errors.phone.message}
              </p>
            )}
          </div>

          {/* Full Name */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ሙሉ ስም (Full Name)
            </label>
            <input
              {...register("fullName")}
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
            />
            {errors.fullName && (
              <p className="text-red-600 text-xs font-bold mt-2 ml-1">
                ⚠ {errors.fullName.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ኢሜይል (Email)
            </label>
            <input
              {...register("email")}
              type="email"
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
            />
          </div>

          {/* Academics */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              የትምህርት ዝግጅት
            </label>
            <input
              {...register("academics")}
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
            />
          </div>

          {/* Diocese */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ሀገረ ስብከት (Diocese)
            </label>
            <input
              {...register("diocese")}
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
            />
          </div>

          {/* Parish */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              ደብር / ገዳም (Parish)
            </label>
            <input
              {...register("parish")}
              className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-900 focus:border-amber-500 focus:bg-white outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Full width components */}
        <div className="space-y-10 pt-4">
          {/* Photo Picker */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4 text-center">
              Ecclesiastical Portrait
            </label>

            <div
              onClick={() => fileRef.current?.click()}
              className={`group relative border-4 border-dashed rounded-[2rem] h-64 flex flex-col items-center justify-center cursor-pointer transition-all duration-500 ${
                preview
                  ? "border-amber-400 bg-amber-50/20"
                  : "border-slate-200 bg-slate-50/50 hover:border-amber-400 hover:bg-amber-50/30"
              }`}>
              {preview ? (
                <>
                  <img
                    src={preview}
                    alt="Preview"
                    className="absolute inset-0 w-full h-full object-cover rounded-[1.8rem]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent rounded-[1.8rem]" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto();
                    }}
                    className="absolute top-4 right-4 bg-white p-3 rounded-full shadow-2xl hover:bg-red-50 text-red-600 transition-transform active:scale-90">
                    <FiTrash2 size={22} />
                  </button>
                </>
              ) : (
                <div className="text-center">
                  <MdOutlinePhotoCamera className="text-6xl text-amber-500 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <p className="font-black text-slate-800 text-lg">ፎቶ ይምረጡ</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
                    JPG / PNG • Maximum 5 MB
                  </p>
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Languages */}
          <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-slate-100">
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4">
              የአገልግሎት ቋንቋዎች (Service Languages)
            </label>
            <div className="flex flex-wrap gap-4">
              {LANGUAGES.map((lang) => (
                <label
                  key={lang}
                  className="flex items-center gap-3 bg-white border-2 border-slate-200 px-5 py-3 rounded-2xl cursor-pointer hover:border-amber-400 transition-all has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50 shadow-sm">
                  <input
                    type="checkbox"
                    value={lang}
                    {...register("languages")}
                    className="w-5 h-5 accent-amber-600 rounded-lg"
                  />
                  <span className="text-sm font-black text-slate-700">
                    {lang}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col items-center gap-6 pt-6">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            className="w-full max-w-lg bg-slate-900 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-base uppercase tracking-[0.2em] py-6 rounded-[2rem] shadow-2xl shadow-amber-900/10 transition-all flex items-center justify-center gap-3">
            {loading ? "በሂደት ላይ..." : "በክብር አረጋግጥ ✞"}
          </motion.button>

          {/* Status message */}
          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`w-full max-w-lg p-5 rounded-2xl text-center text-sm font-black flex items-center justify-center gap-3 border-2 ${
                  status.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}>
                {status.type === "success" && (
                  <MdCheckCircle className="text-2xl" />
                )}
                {status.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </form>
    </SanctuarySurface>
  );
}
