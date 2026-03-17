// src/features/father/components/FormModules.tsx
/**
 * EOTC Sacred Ledger - Form Modules
 * ------------------------------------------------------------
 * Handles hierarchical data entry for spiritual children.
 * Features: Dynamic Ethiopian year scaling, Amharic-first UI,
 * and stable state-linked cascading selections.
 */

"use client";

import { GraduationCap, MapPin, Phone, User } from "lucide-react";
import React, { useMemo } from "react";
import {
  Control,
  Controller,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  useWatch,
} from "react-hook-form";

import EthiopianDateInput from "@/shared/components/ui/EthiopianDateInput";
import { SearchableSelect } from "@/shared/components/ui/SearchableSelect";
import {
  ETHIOPIAN_GEOGRAPHY,
  ETHIOPIAN_LANGUAGES,
  UNIVERSITY_MASTER_MAP,
} from "@/shared/constants/ethiopianData";
import { useHierarchy } from "@/shared/hooks/useHierarchy";
import { getTodayEthiopian } from "@/shared/utils/calendar/ethiopianCalendar";

import { RegisterChildFormData } from "../services/validators";

interface GroupProps {
  register: UseFormRegister<RegisterChildFormData>;
  errors: FieldErrors<RegisterChildFormData>;
  watch: UseFormWatch<RegisterChildFormData>;
  setValue: UseFormSetValue<RegisterChildFormData>;
  control: Control<RegisterChildFormData>;
}

/* -------------------------------------------------------------------------- */
/* CASCADE STABILITY HOOK (ZERO-LOSS RESET)                                   */
/* -------------------------------------------------------------------------- */

function useCascadeReset<T>(value: T, reset: () => void) {
  const prev = React.useRef(value);

  React.useEffect(() => {
    if (prev.current !== value) {
      reset();
    }
    prev.current = value;
  }, [value, reset]);
}

/* -------------------------------------------------------------------------- */
/* SECTION 1: Identity Information (የማንነት መረጃ)                               */
/* -------------------------------------------------------------------------- */

export function IdentitySection({
  register,
  errors,
  control,
}: Pick<GroupProps, "register" | "errors" | "control">) {
  return (
    <div className="space-y-5">
      <SectionTitle title="የማንነት መረጃ" icon={<User size={12} />} />

      <Field label="ዓለማዊ ስም (ሙሉ ስም)" error={errors.secularName?.message}>
        <input
          {...register("secularName")}
          className="sanctuary-input"
          placeholder="የልጁን ሙሉ ስም እዚህ ያስገቡ"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="የክርስትና ስም" error={errors.christianName?.message}>
          <input
            {...register("christianName")}
            className="sanctuary-input"
            placeholder="የክርስትና ስም"
          />
        </Field>
        <Field label="ጾታ" error={errors.gender?.message}>
          <select {...register("gender")} className="sanctuary-input">
            <option value="">ጾታ ይምረጡ</option>
            <option value="MALE">ወንድ</option>
            <option value="FEMALE">ሴት</option>
          </select>
        </Field>
      </div>

      <Field label="የትውልድ ቀን (በኢትዮጵያ አቆጣጠር)" error={errors.birthDate?.message}>
        <Controller
          name="birthDate"
          control={control}
          render={({ field }) => (
            <EthiopianDateInput value={field.value} onChange={field.onChange} />
          )}
        />
      </Field>

      <Field label="መንፈሳዊ ማዕረግ" error={errors.spiritualTitle?.message}>
        <select {...register("spiritualTitle")} className="sanctuary-input">
          <option value="">ማዕረግ ይምረጡ</option>
          <option value="ምዕመን">ምዕመን</option>
          <option value="ዲያቆን">ዲያቆን</option>
          <option value="ዘማሪ">ዘማሪ</option>
          <option value="ሰባኪ">ሰባኪ</option>
        </select>
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SECTION 2: Geography & Location (ጂኦግራፊያዊ መረጃ)                             */
/* -------------------------------------------------------------------------- */

export function GeographySection({
  control,
  errors,
}: Pick<GroupProps, "control" | "errors">) {
  const selectedRegion =
    useWatch({
      control,
      name: "region",
    }) ?? "";

  //  Universal hierarchy engine
  const zones = useHierarchy(selectedRegion, ETHIOPIAN_GEOGRAPHY);

  return (
    <div className="space-y-5">
      <SectionTitle title="የመኖሪያ አድራሻ" icon={<MapPin size={12} />} />

      {/* ---------------- REGION ---------------- */}
      <Field label="ክልል" error={errors.region?.message}>
        <Controller
          name="region"
          control={control}
          defaultValue=""
          render={({ field }) => (
            <SearchableSelect
              label="ክልል"
              options={Object.keys(ETHIOPIAN_GEOGRAPHY)}
              value={field.value ?? ""}
              onChange={field.onChange}
              placeholder="ክልል ይምረጡ..."
              allowClear
            />
          )}
        />
      </Field>

      {/* ---------------- ZONE ---------------- */}
      <Field label="ዞን / ክፍለ ከተማ" error={errors.zone?.message}>
        <Controller
          name="zone"
          control={control}
          defaultValue=""
          render={({ field }) => (
            <SearchableSelect
              label="ዞን"
              options={zones}
              value={field.value ?? ""}
              onChange={field.onChange}
              placeholder={selectedRegion ? "ዞን ይምረጡ..." : "በመጀመሪያ ክልል ይምረጡ"}
              disabled={!selectedRegion}
              allowClear
            />
          )}
        />
      </Field>

      {/* ---------------- CITY ---------------- */}
      <Field label="ከተማ / ገጠር" error={errors.city?.message}>
        <input
          {...control.register("city")}
          className="sanctuary-input"
          placeholder="ከተማ ያስገቡ"
        />
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SECTION 3: Academic Information (የትምህርት መረጃ)                             */
/* -------------------------------------------------------------------------- */

export function AcademicSection({
  register,
  control,
  errors,
  setValue,
}: Pick<GroupProps, "register" | "control" | "errors" | "setValue">) {
  const univ =
    useWatch({
      control,
      name: "university",
    }) ?? "";

  const coll =
    useWatch({
      control,
      name: "college",
    }) ?? "";

  // DYNAMIC YEAR LOGIC: Generates list up to current Ethiopian Year
  const years = useMemo(() => {
    const currentYear = getTodayEthiopian().year;
    return Array.from({ length: 30 }, (_, i) => currentYear - i);
  }, []);

  const collegeOptions = useMemo(
    () =>
      univ
        ? Object.keys(
            UNIVERSITY_MASTER_MAP[univ as keyof typeof UNIVERSITY_MASTER_MAP] ||
              {}
          )
        : [],
    [univ]
  );

  const deptOptions = useMemo(() => {
    if (!univ || !coll) return [];

    const university =
      UNIVERSITY_MASTER_MAP[univ as keyof typeof UNIVERSITY_MASTER_MAP];

    return university?.[coll as keyof typeof university] || [];
  }, [univ, coll]);

  // Stable cascade resets (now guaranteed to run because component re-renders)
  useCascadeReset(univ, () => {
    setValue("college", "", { shouldValidate: true });
    setValue("department", "", { shouldValidate: true });
  });

  useCascadeReset(coll, () => {
    setValue("department", "", { shouldValidate: true });
  });

  return (
    <div className="space-y-5">
      <SectionTitle title="የትምህርት መረጃ" icon={<GraduationCap size={12} />} />

      <Field label="ከፍተኛ ትምህርት ተቋም / ዩኒቨርሲቲ" error={errors.university?.message}>
        <Controller
          name="university"
          defaultValue=""
          control={control}
          render={({ field }) => (
            <SearchableSelect
              label="ዩኒቨርሲቲ"
              options={Object.keys(UNIVERSITY_MASTER_MAP)}
              value={field.value ?? ""}
              onChange={field.onChange}
              placeholder="ተቋም ይምረጡ..."
            />
          )}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5">
        <Field label="ኮሌጅ / ኢንስቲትዩት" error={errors.college?.message}>
          <Controller
            name="college"
            defaultValue=""
            control={control}
            render={({ field }) => (
              <SearchableSelect
                label="ኮሌጅ"
                options={collegeOptions}
                value={field.value ?? ""}
                onChange={field.onChange}
                placeholder={univ ? "ኮሌጅ ይምረጡ..." : "በመጀመሪያ ዩኒቨርሲቲ ይምረጡ"}
                disabled={!univ}
              />
            )}
          />
        </Field>

        <Field label="የትምህርት ክፍል (ዲፓርትመንት)" error={errors.department?.message}>
          <Controller
            name="department"
            defaultValue=""
            control={control}
            render={({ field }) => (
              <SearchableSelect
                label="ዲፓርትመንት"
                options={deptOptions}
                value={field.value ?? ""}
                onChange={field.onChange}
                placeholder={coll ? "ዲፓርትመንት ይምረጡ..." : "በመጀመሪያ ኮሌጅ ይምረጡ"}
                disabled={!coll}
              />
            )}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="የመግቢያ ዓ.ም" error={errors.entryYear?.message}>
          <select
            {...register("entryYear", { valueAsNumber: true })}
            className="sanctuary-input">
            {/* Placeholder — disabled   from selection */}
            <option value="" disabled>
              ዓመት ይምረጡ
            </option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>

        <Field label="የትምህርት ዘመን" error={errors.academicYear?.message}>
          <select
            {...register("academicYear", { valueAsNumber: true })}
            className="sanctuary-input">
            <option value="" disabled>
              ዓመት ይምረጡ
            </option>
            {[1, 2, 3, 4, 5, 6, 7].map((y) => (
              <option key={y} value={y}>
                {y}ኛ ዓመት
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="ሴሚስተር" error={errors.semester?.message}>
        <select
          {...register("semester", { valueAsNumber: true })}
          className="sanctuary-input">
          <option value="" disabled>
            ሴሚስተር ይምረጡ
          </option>
          <option value={1}>1ኛ ሴሚስተር</option>
          <option value={2}>2ኛ ሴሚስተር</option>
        </select>
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SECTION 4: Connectivity & Languages (የመገናኛ መረጃ)                          */
/* -------------------------------------------------------------------------- */

export function ConnectSection({
  register,
  errors,
  control,
}: Pick<GroupProps, "register" | "errors" | "control">) {
  return (
    <div className="space-y-5">
      <SectionTitle title="የመገናኛ መረጃ" icon={<Phone size={12} />} />

      <Field label="የስልክ ቁጥር" error={errors.phone?.message}>
        <input
          {...register("phone")}
          className="sanctuary-input font-mono"
          placeholder="09..."
        />
      </Field>

      <Field label="ኢሜል (ካለ)" error={errors.email?.message}>
        <input
          {...register("email")}
          className="sanctuary-input font-mono"
          placeholder="ለምሳሌ፡ example@mail.com"
        />
      </Field>

      <Field label="የአፍ መፍቻ ቋንቋ" error={errors.language?.message}>
        <Controller
          name="language"
          control={control}
          defaultValue=""
          render={({ field }) => (
            <SearchableSelect
              label="ቋንቋ"
              options={ETHIOPIAN_LANGUAGES}
              value={field.value ?? ""}
              onChange={field.onChange}
              placeholder="ቋንቋ ይምረጡ..."
            />
          )}
        />
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
    <div className="flex items-center gap-1.5 mb-2 px-1">
      <span className="text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-amber-100/50">
        {icon}
      </span>
      <h4 className="text-[11px] font-black uppercase text-slate-700 tracking-tight">
        {title}
      </h4>
      <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent ml-2"></div>
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
      <label className="text-[10px] font-bold text-slate-500 mb-1 ml-0.5 block tracking-wide">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[10px] text-red-600 font-bold mt-1 ml-0.5 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}
