// src/shared/types/broadcast.types.ts
export type BroadcastType = "INSTRUCTION" | "LITURGICAL" | "FASTING";

export interface BroadcastMessage {
  id: string;
  type: BroadcastType;
  title: string;
  content: string;
  authorName: string;
  ethDate: string;
  isUrgent?: boolean;
}
