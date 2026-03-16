// src/features/father/components/FormModules.tsx
"use client";

import { Globe, GraduationCap, Phone, User } from "lucide-react";
import React from "react";
import {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";

import { getTodayEthiopian } from "@/shared/utils/calendar/ethiopianCalendar";

import { RegisterChildFormData } from "../services/validators";

/**
 * Shared props used across all form modules.
 */
interface GroupProps {
  register: UseFormRegister<RegisterChildFormData>;
  errors: FieldErrors<RegisterChildFormData>;
  watch: UseFormWatch<RegisterChildFormData>;
  setValue: UseFormSetValue<RegisterChildFormData>;
}

/* -------------------------------------------------------------------------- */
/* SECTION 1: Identity Information                                            */
/* -------------------------------------------------------------------------- */

export function IdentitySection({
  register,
  errors,
}: Omit<GroupProps, "watch" | "setValue">) {
  const todayEC = getTodayEthiopian();

  return (
    <div className="space-y-5">
      <SectionTitle title="የማንነት መረጃ" icon={<User size={12} />} />

      <Field label="የዓለም ስም (Full Name)" error={errors.secularName?.message}>
        <input
          {...register("secularName")}
          className="sanctuary-input transition-all duration-200 hover:border-amber-300 focus:ring-1 focus:ring-amber-400"
          placeholder="ሙሉ ስም"
        />
      </Field>

      <Field label="የክርስትና ስም" error={errors.christianName?.message}>
        <input
          {...register("christianName")}
          className="sanctuary-input font-ethiopic transition-all duration-200 hover:border-amber-300 focus:ring-1 focus:ring-amber-400"
          placeholder="ምሳሌ፡ ኃይለ ማርያም"
        />
      </Field>

      <div className="grid grid-cols-2 gap-1.5">
        <Field label="ጾታ" error={errors.gender?.message}>
          <select
            {...register("gender")}
            className="sanctuary-input transition-all duration-200 hover:border-amber-300 focus:ring-1 focus:ring-amber-400">
            <option value="">ፆታ ይምረጡ...</option>
            <option value="MALE">ወንድ</option>
            <option value="FEMALE">ሴት</option>
          </select>
        </Field>

        <Field label="መንፈሳዊ ማዕረግ" error={errors.spiritualTitle?.message}>
          <select
            {...register("spiritualTitle")}
            className="sanctuary-input transition-all duration-200 hover:border-amber-300 focus:ring-1 focus:ring-amber-400">
            <option value="">ማዕረግ ይምረጡ...</option>
            <option value="ምዕመን">ምዕመን</option>
            <option value="ዲያቆን">ዲያቆን</option>
            <option value="ዘማሪ">ዘማሪ</option>
            <option value="ሰባኪ">ሰባኪ</option>
          </select>
        </Field>
      </div>

      <Field label="የትውልድ ቦታ" error={errors.birthPlace?.message}>
        <input
          {...register("birthPlace")}
          className="sanctuary-input transition-all duration-200 hover:border-amber-300 focus:ring-1 focus:ring-amber-400"
          placeholder="ምሳሌ፡ አዲስ አበባ"
        />
      </Field>

      <div className="w-full">
        {/* Note: Mapping to birthDate.year to align with EthiopianDateSchema */}
        <Field label="የትውልድ ዓመት" error={errors.birthDate?.year?.message}>
          <input
            type="number"
            {...register("birthDate.year", { valueAsNumber: true })}
            min={1900}
            max={todayEC.year}
            inputMode="numeric"
            className="sanctuary-input font-mono transition-all duration-200 hover:border-amber-300 focus:ring-1 focus:ring-amber-400"
            placeholder={`፳፻... (≤${todayEC.year})`}
          />
        </Field>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SECTION 2: Academic Information                                            */
/* -------------------------------------------------------------------------- */

export function AcademicSection({
  register,
  errors,
}: Omit<GroupProps, "watch" | "setValue">) {
  const todayEC = getTodayEthiopian();

  return (
    <div className="space-y-5">
      <SectionTitle title="የትምህርት መረጃ" icon={<GraduationCap size={12} />} />

      <Field label="የሚማሩበት ዩኒቨርሲቲ" error={errors.university?.message}>
        <input
          {...register("university")}
          className="sanctuary-input transition-all duration-200 hover:border-amber-300 focus:ring-1 focus:ring-amber-400"
          placeholder="የትምህርት ተቋም"
        />
      </Field>

      <div className="grid grid-cols-5 gap-1.5">
        <div className="col-span-3">
          <Field label="ትምህርት ክፍል" error={errors.department?.message}>
            <input
              {...register("department")}
              className="sanctuary-input transition-all duration-200 hover:border-amber-300 focus:ring-1 focus:ring-amber-400"
              placeholder="ዲፓርትመንት"
            />
          </Field>
        </div>

        <div className="col-span-2">
          <Field label="ወደ ግቢ የገቡበት ዓ.ም" error={errors.entryYear?.message}>
            <input
              {...register("entryYear")}
              type="text"
              inputMode="numeric"
              pattern="\d*"
              placeholder={`፳፻... (≤${todayEC.year})`}
              className="sanctuary-input font-mono transition-all duration-200 hover:border-amber-300 focus:ring-1 focus:ring-amber-400"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SECTION 3: Contact Information                                             */
/* -------------------------------------------------------------------------- */

export function ConnectSection({
  register,
  errors,
  watch,
  setValue,
}: GroupProps) {
  const selectedLang = watch("language");

  const COMMON_LANGS = [
    { label: "ቋንቋ ይምረጡ...", value: "" },
    { label: "አማርኛ", value: "አማርኛ" },
    { label: "ግዕዝ", value: "ግዕዝ" },
    { label: "Oromiffa", value: "Oromiffa" },
    { label: "Tigrinya", value: "Tigrinya" },
    { label: "Hadiyissa", value: "Hadiyissa" },
    { label: "English", value: "English" },
    { label: "ሌላ (Other)", value: "OTHER" },
  ];

  return (
    <div className="space-y-5">
      <SectionTitle title="የመገናኛ መረጃ" icon={<Phone size={12} />} />

      <div className="grid grid-cols-2 gap-1.5">
        <Field label="ስልክ" error={errors.phone?.message}>
          <input
            {...register("phone")}
            inputMode="tel"
            autoComplete="tel"
            placeholder="+251912345678"
            className="sanctuary-input font-mono transition-all duration-200 hover:border-amber-300 focus:ring-1 focus:ring-amber-400"
          />
        </Field>

        <Field label="ኢሜይል" error={errors.email?.message}>
          <input
            {...register("email")}
            className="sanctuary-input transition-all duration-200 hover:border-amber-300 focus:ring-1 focus:ring-amber-400"
            placeholder="example@email.com"
          />
        </Field>
      </div>

      <Field label="የአፍ መፍቻ ቋንቋ" error={errors.language?.message}>
        <select
          {...register("language")}
          className="sanctuary-input transition-all duration-200 hover:border-amber-300 focus:ring-1 focus:ring-amber-400 cursor-pointer">
          {COMMON_LANGS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        {selectedLang === "OTHER" && (
          <div className="mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="relative flex items-center">
              <Globe size={14} className="absolute left-3 text-amber-600" />
              <input
                {...register("customLanguage")}
                className="sanctuary-input pl-9 border-amber-300 bg-amber-50/50 transition-all duration-200"
                placeholder="ቋንቋውን እዚህ ይጥቀሱ..."
              />
              <button
                type="button"
                onClick={() => {
                  if (typeof setValue === "function") {
                    setValue("language", "");
                    setValue("customLanguage", "");
                  }
                }}
                className="ml-2 text-[9px] font-bold text-amber-700 hover:text-amber-900 transition">
                ቀይር
              </button>
            </div>
          </div>
        )}
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* UI UTILITIES                                                               */
/* -------------------------------------------------------------------------- */

function SectionTitle({
  title,
  icon,
}: {
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-1 px-1">
      <span className="text-amber-700 bg-amber-50 p-1 rounded-md">{icon}</span>
      <h4 className="text-[10px] font-black uppercase text-slate-700 tracking-tighter">
        {title}
      </h4>
      <div className="h-px flex-1 bg-slate-100/80 ml-1"></div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <label className="text-[9px] font-bold text-slate-400 mb-0.5 ml-0.5 block uppercase">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[8px] text-red-600 font-bold mt-0.5 ml-0.5 italic">
          * {error}
        </p>
      )}
    </div>
  );
}
