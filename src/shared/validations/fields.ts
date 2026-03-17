// src/shared/validation/fields.ts
import { z } from "zod";

import { getTodayEthiopian } from "@/shared/utils/calendar/ethiopianCalendar";

/**
 * Common Ethiopian name normalization
 * - Removes parentheses content (e.g. (ሙሉ))
 * - Handles Ge'ez word separator ፡
 * - Collapses multiple spaces
 */
export const normalizeName = (value: string): string =>
  value
    .replace(/\(.*?\)/g, "")
    .replace(/[፡]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Validates full Ethiopian-style name:
 * - At least 2 parts
 * - Each part ≥ 2 characters
 */
export const isValidEthiopianFullName = (name: string): boolean => {
  const parts = normalizeName(name).split(" ");
  if (parts.length < 2) return false;
  return parts.every((part) => part.length >= 2);
};

/* ────────────────────────────────────────────────
   Field Factories – Reusable across all forms (Zod v4 style)
   ──────────────────────────────────────────────── */

/**
 * Required text input (names, city, etc.)
 * - Catches undefined / null / empty very early
 * - Shows your custom message instead of Zod default
 */
export function textField(
  requiredMessage: string,
  minLength = 1,
  minMessage?: string
) {
  return z.preprocess(
    // Step 1: Force undefined → "" so Zod never sees undefined
    (val) => {
      if (val === undefined || val === null) return "";
      return String(val).trim();
    },
    z
      .string()
      // Step 2: Catch empty after normalization
      .refine((val) => val.length > 0, {
        message: requiredMessage,
      })
      // Step 3: Enforce minimum length
      .min(minLength, {
        message: minMessage ?? `${requiredMessage} (ቢያንስ ${minLength} ፊደል)`,
      })
  );
}

/**
 * Required select / dropdown field – 100% safe against undefined
 * - Forces undefined / null / "" → empty string
 * - Then enforces non-empty with YOUR custom message
 * - Prevents Zod's "expected string, received undefined" forever
 */
export function selectField(requiredMessage: string) {
  return z.preprocess(
    (val) => {
      if (val == null || val === undefined || val === "" || val === false) {
        return "";
      }
      return String(val).trim();
    },
    z.string().refine((val) => val.length > 0, { message: requiredMessage })
  );
}

/**
 * Number field from select/input – prevents NaN crash
 */
type NumberFieldConfig = {
  required: string;
  min?: { value: number; message: string };
  max?: { value: number; message: string };
};

export function numberField(config: NumberFieldConfig) {
  let schema = z
    .number()
    .refine((val) => !Number.isNaN(val), { message: config.required });

  if (config.min) {
    schema = schema.min(config.min.value, { message: config.min.message });
  }

  if (config.max) {
    schema = schema.max(config.max.value, { message: config.max.message });
  }

  return z.preprocess((val) => {
    if (val === "" || val == null || val === undefined) return undefined;
    const num = Number(val);
    return Number.isNaN(num) ? undefined : num;
  }, schema);
}

/**
 * Ethiopian full name – at least two parts, each ≥2 chars
 */
export function ethiopianFullNameField() {
  return z
    .string()
    .refine((val) => val.trim().length > 0, {
      message: "ሙሉ ስም ያስገቡ (Full name is required)",
    })
    .transform(normalizeName)
    .refine(isValidEthiopianFullName, {
      message:
        "ሙሉ ስም ቢያንስ ሁለት ክፍል ሊኖረው ይገባል፣ እያንዳንዱ ክፍል ቢያንስ 2 ፊደል መሆን አለበት (Full name must contain at least two parts, each with at least 2 letters)",
    });
}

/**
 * Christian / spiritual name – single name, min 2 chars
 */
export function christianNameField() {
  return textField("የክርስትና ስም ያስገቡ", 3);
}

/**
 * Ethiopian phone number (normalized to +251 format)
 */
export function ethiopianPhoneField() {
  return z
    .string()
    .refine((val) => val.trim().length > 0, {
      message: "ስልክ ቁጥር ያስገቡ",
    })
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => /^\+251[179]\d{8}$/.test(v) || /^0[179]\d{8}$/.test(v), {
      message: "ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (ለምሳሌ +251912345678)",
    })
    .transform((v) => (v.startsWith("0") ? "+251" + v.slice(1) : v));
}

/**
 * Strictly required email
 */
export function requiredEmailField() {
  return z
    .string()
    .trim()
    .min(1, { message: "ኢሜይል ባዶ መሆን አይችልም" })
    .email({ message: "ትክክለኛ ኢሜይል አስገባ (example@domain.com)" });
}

/**
 * Academic entry year – constrained to realistic range
 */
export function entryYearField() {
  const currentYear = getTodayEthiopian().year;
  return numberField({
    required: "የመግቢያ ዓመት ይምረጡ",
    min: {
      value: 1900,
      message: "ዓመት ከ1900 በታች መሆን አይችልም",
    },
    max: {
      value: currentYear,
      message: "የገቡበት ዓመት መጪ መሆን አይችልም",
    },
  });
}
