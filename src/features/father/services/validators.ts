// src/features/father/services/validators.ts
import { z } from "zod";

import {
  EthiopianDate,
  getTodayEthiopian,
  isFutureEthiopianDate,
  isValidEthiopianDate,
} from "@/shared/utils/calendar/ethiopianCalendar";
import {
  christianNameField,
  entryYearField,
  ethiopianFullNameField,
  ethiopianPhoneField,
  numberField,
  requiredEmailField,
  selectField,
  textField,
} from "@/shared/validations/fields";

// ────────────────────────────────────────────────
// Reusable Ethiopian Date Schema
// ────────────────────────────────────────────────

const EthiopianDateSchema = z
  .object({
    year: numberField({
      required: "ዓመተ ምህረት ያስገቡ (Year is required)",
      min: {
        value: 1900,
        message: "ዓመተ ምህረት ከ1900 በታች መሆን አይችልም (Year cannot be before 1900)",
      },
      max: {
        value: getTodayEthiopian().year,
        message: "የወደፊት ዓመተ ምህረት አይፈቀድም (Future year not allowed)",
      },
    }),

    month: numberField({
      required: "ወር ያስገቡ (Month is required)",
      min: {
        value: 1,
        message: "ወር ከ1 መጀመር አለበት (Month must start from 1)",
      },
      max: {
        value: 13,
        message: "ወር ከ13 መብለጥ የለበትም (Month cannot exceed 13)",
      },
    }),

    day: numberField({
      required: "ቀን ያስገቡ (Day is required)",
      min: {
        value: 1,
        message: "ቀን ከ1 መጀመር አለበት (Day must start from 1)",
      },
      max: {
        value: 30,
        message: "ቀን ከ30 መብለጥ የለበትም (Day cannot exceed 30)",
      },
    }),
  })
  .superRefine((date, ctx) => {
    if (!isValidEthiopianDate(date)) {
      ctx.addIssue({
        code: "custom",
        message: "የተሳሳተ ቀን ተገብሏል (Invalid Date Provided)",
      });
    }
    if (isFutureEthiopianDate(date)) {
      ctx.addIssue({
        code: "custom",
        message: "የወደፊት ቀን መመዝገብ አይቻልም (Future date not allowed)",
      });
    }
  });

// ────────────────────────────────────────────────
// Main Child Registration Schema
// ────────────────────────────────────────────────

export const RegisterChildSchema = z.object({
  // Identity
  fullToken: textField("Invalid Registration Token", 10),

  secularName: ethiopianFullNameField(),

  christianName: christianNameField(),

  gender: z.enum(["MALE", "FEMALE"], {
    message: "እባክዎ ጾታ ይምረጡ (Please select gender)",
  }),

  birthDate: EthiopianDateSchema,

  // Geography
  region: selectField("እባክዎ ክልል ይምረጡ (Please select a region)"),
  zone: selectField("እባክዎ ዞን ይምረጡ (Please select a zone)"),
  city: textField("እባክዎ ከተማ ያስገቡ (Please enter city/town)"),

  // Ecclesiastical
  spiritualTitle: selectField(
    "እባክዎ መንፈሳዊ ማዕረግ ይምረጡ (Please select spiritual title)"
  ),
  spiritualFatherId: z.string().optional(),
  language: selectField("እባክዎ ቋንቋ ይምረጡ (Please select a language)"),

  // Academic
  university: selectField("እባክዎ ዩኒቨርሲቲ ይምረጡ (Please select university)"),
  college: selectField(
    "እባክዎ ኮሌጅ/ኢንስቲትዩት ይምረጡ (Please select college/institute)"
  ),
  department: selectField("እባክዎ የትምህርት ክፍል ይምረጡ (Please select department)"),

  entryYear: selectField("የመግቢያ ዓ.ም ይምረጡ (Select entry year)")
    .pipe(z.coerce.number())
    .refine(
      (n) => !Number.isNaN(n) && n >= 1900 && n <= getTodayEthiopian().year,
      {
        message: `የመግቢያ ዓመት ${1900}–${getTodayEthiopian().year} መካከል መሆን አለበት`,
      }
    ),

  academicYear: selectField("የትምህርት ዘመን ይምረጡ (Select academic year)")
    .pipe(z.coerce.number())
    .refine((n) => !Number.isNaN(n) && n >= 1 && n <= 8, {
      message: "ዓመት 1–8 መካከል መሆን አለበት (Academic year must be 1–8)",
    }),

  semester: selectField("ሴሚስተር ይምረጡ (Select semester)")
    .pipe(z.coerce.number())
    .refine((n) => !Number.isNaN(n) && (n === 1 || n === 2), {
      message: "ሴሚስተር 1 ወይም 2 መሆን አለበት (Semester must be 1 or 2)",
    }),

  // Contact
  phone: ethiopianPhoneField(),

  email: requiredEmailField(),

  photoUrl: textField("ፎቶ መምረጥ አለብዎት — የልጁን ምስል ያክሉ (Photo is required)"),
});

export type RegisterChildFormData = z.infer<typeof RegisterChildSchema>;
