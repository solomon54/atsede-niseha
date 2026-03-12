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
  fullName: z.string().min(3),
  title: z.string().min(1),
  secularTitle: z.string().optional(),
  email: z.string().email(),
  phone: z.string(),
  diocese: z.string().min(2),
  parish: z.string().min(3),
  academics: z.string().min(2),
  languages: z.array(z.string()),
  photoUrl: z.string().optional(),
});

export type SpiritualFatherProfile = z.infer<typeof SpiritualFatherSchema>;
