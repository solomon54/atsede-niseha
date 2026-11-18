// src/features/appointments/services/validators.ts
import { z } from "zod";

/**
 * Client-generated idempotency key. The same key must never be reused for a
 * different action.
 */
export const OperationIdSchema = z
  .string()
  .min(8, "የክወና መለያ ያስፈልጋል")
  .max(120, "የክወና መለያው በጣም ረጅም ነው")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "የክወና መለያው ትክክል አይደለም"
  );

const ScheduledAtSchema = z
  .string()
  .min(8, "ቀንና ሰዓት ያስፈልጋል")
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "የቀንና ሰዓት መረጃው ትክክል አይደለም",
  });

const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "ቀኑ በ YYYY-MM-DD መልክ መሆን አለበት")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "ቀኑ ትክክል አይደለም",
  });

export const CreateAppointmentSchema = z
  .object({
    operationId: OperationIdSchema,
    // childUid is optional from the client — server fills it for STUDENT role
    childUid: z.string().optional().default(""),
    type: z.enum(["NISEHA", "COUNSELING"], {
      message: "ዓይነት ይምረጡ",
    }),
    scheduledAt: ScheduledAtSchema,
    location: z.string().max(200).optional(),
    message: z.string().max(500).optional(),
    /** @deprecated alias accepted from older clients. */
    logisticsNote: z.string().max(500).optional(),
  })
  .strict();

const ActionShape = z
  .object({
    operationId: OperationIdSchema,
    expectedVersion: z
      .number()
      .int("የቅጂ ቁጥሩ ሙሉ ቁጥር መሆን አለበት")
      .min(1, "የቅጂ ቁጥሩ ትክክል አይደለም"),
    action: z.enum(
      ["CONFIRM", "DECLINE", "RESCHEDULE", "CANCEL", "COMPLETE"],
      { message: "የተፈቀደ እርምጃ ይምረጡ" }
    ),
    scheduledAt: ScheduledAtSchema.optional(),
    location: z.string().max(200).optional(),
    message: z.string().max(500).optional(),
    /** Optional correction supplied while completing a NISEHA appointment. */
    lastNisehaDate: DateOnlySchema.optional(),
  })
  .strict();

export const UpdateAppointmentSchema = ActionShape.superRefine(
  (value, ctx) => {
    if (value.action === "RESCHEDULE") {
      if (value.scheduledAt === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledAt"],
          message: "አዲስ የቀንና ሰዓት መረጃ ያስፈልጋል",
        });
      }
    } else {
      for (const field of ["scheduledAt", "location", "message"] as const) {
        if (value[field] !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: "ይህ መስክ በዚህ እርምጃ ሊቀየር አይችልም",
          });
        }
      }
    }

    if (
      value.lastNisehaDate !== undefined &&
      value.action !== "COMPLETE"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lastNisehaDate"],
        message: "የመጨረሻ ንስሐ ቀን ማስተካከል የሚቻለው ቀጠሮ ሲጠናቀቅ ነው",
      });
    }
  }
);
