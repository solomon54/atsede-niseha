//src/features/governor/services/validators.ts
import { z } from "zod";

// Allowed regions for your Sovereign System
export const AssignedRegionEnum = z.enum([
  "North",
  "South",
  "East",
  "West",
  "Central",
]);

// Zod schema for a spiritual father profile
export const SpiritualFatherSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  parish: z.string().min(1, "Parish is required"),
  assignedRegion: AssignedRegionEnum.optional(),
});

export type SpiritualFatherProfile = z.infer<typeof SpiritualFatherSchema>;
