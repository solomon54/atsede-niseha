//src/features/father/services/validators.ts

import { z } from "zod";

import {
  EthiopianDate,
  getTodayEthiopian,
  isFutureEthiopianDate,
  isValidEthiopianDate,
} from "@/shared/utils/calendar/ethiopianCalendar";

/**
 * Ethiopian date schema used for birthdate validation.
 * Refined Amharic for natural phrasing.
 */
const EthiopianDateSchema = z
  .object({
    year: z.coerce
      .number()
      .min(1900, "ዓመተ ምህረት ከ1900 በታች መሆን አይችልም")
      .max(getTodayEthiopian().year, "የወደፊት ዓመተ ምህረት አይፈቀድም"),
    month: z.coerce
      .number()
      .min(1, "ወር ከ1 መጀመር አለበት")
      .max(13, "ወር ከ13 መብለጥ የለበትም"),
    day: z.coerce
      .number()
      .min(1, "ቀን ከ1 መጀመር አለበት")
      .max(30, "ቀን ከ30 መብለጥ የለበትም"),
  })
  .superRefine((date: EthiopianDate, ctx) => {
    if (!isValidEthiopianDate(date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "የተሳሳተ ቀን ተገብሏል",
      });
    }
    if (isFutureEthiopianDate(date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "የወደፊት ቀን መመዝገብ አይቻልም",
      });
    }
  });

/**
 * Main Child Registration Schema
 * Professional Amharic validation messages.
 */
export const RegisterChildSchema = z
  .object({
    fullToken: z.string(),
    secularName: z.string().min(3, "እባክዎ ሙሉ ስም ያስገቡ"),
    christianName: z.string().min(2, "እባክዎ የክርስትና ስም ያስገቡ"),
    gender: z.enum(["MALE", "FEMALE"], {
      required_error: "እባክዎ ጾታ ይምረጡ",
    }),
    // Changed to allow empty string initially to match defaultValues
    spiritualTitle: z.string().min(1, "እባክዎ መንፈሳዊ ማዕረግ ይምረጡ"),
    university: z.string().min(2, "የዩኒቨርሲቲ ስም ያስገቡ"),
    department: z.string().min(2, "የትምህርት ክፍል (ዲፓርትመንት) ያስገቡ"),
    birthDate: EthiopianDateSchema,
    birthPlace: z.string().min(2, "የትውልድ ቦታ ያስገቡ"),
    entryYear: z.coerce
      .number()
      .min(1900, "ዓመተ ምህረት ከ1900 በታች መሆን አይችልም")
      .max(getTodayEthiopian().year, "የወደፊት ዓመተ ምህረት አይፈቀድም"),
    phone: z
      .string()
      .transform((v) => v.replace(/\s+/g, "").replace(/-/g, ""))
      .refine(
        (v) => /^\+251[79]\d{8}$/.test(v) || /^0[79]\d{8}$/.test(v),
        "ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ"
      )
      .transform((v) =>
        v.startsWith("09") || v.startsWith("07") ? "+251" + v.slice(1) : v
      ),
    email: z.string().email("ትክክለኛ ኢሜይል ያስገቡ").or(z.literal("")),
    language: z.string().min(1, "እባክዎ ቋንቋ ይምረጡ"),
    customLanguage: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // If "OTHER" language selected, customLanguage is required
    if (
      data.language === "OTHER" &&
      (!data.customLanguage || data.customLanguage.trim().length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customLanguage"],
        message: "እባክዎ የቋንቋውን ስም እዚህ ይጥቀሱ",
      });
    }
    // Prevent unnecessary customLanguage data in payload
    if (
      data.language !== "OTHER" &&
      data.customLanguage &&
      data.customLanguage.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customLanguage"],
        message: "ይህ መስክ አያስፈልግም",
      });
    }
    photoUrl: z.string().optional();
  });

export type RegisterChildFormData = z.infer<typeof RegisterChildSchema>;
