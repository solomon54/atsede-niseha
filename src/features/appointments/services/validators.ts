// src/features/appointments/services/validators.ts
import { z } from "zod";

export const CreateAppointmentSchema = z.object({
  // childUid is optional from the client — server fills it for STUDENT role
  childUid: z.string().optional().default(""),
  type: z.enum(["NISEHA", "COUNSELING"], {
    message: "ዓይነት ይምረጡ",
  }),
  scheduledAt: z.string().min(8, "ቀንና ሰዓት ያስፈልጋል"),
  location: z.string().max(200).optional(),
  message: z.string().max(500).optional(),
  logisticsNote: z.string().max(500).optional(),
});

export const UpdateAppointmentSchema = z
  .object({
    status: z
      .enum(["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED"])
      .optional(),
    scheduledAt: z.string().min(8).optional(),
    location: z.string().max(200).optional(),
    message: z.string().max(500).optional(),
    logisticsNote: z.string().max(500).optional(),
    lastNisehaDate: z.string().min(8).optional(),
  })
  .refine(
    (v) =>
      v.status !== undefined ||
      v.scheduledAt !== undefined ||
      v.location !== undefined ||
      v.message !== undefined ||
      v.logisticsNote !== undefined ||
      v.lastNisehaDate !== undefined,
    { message: "ቢያንስ አንድ መስክ ያስፈልጋል" }
  );
