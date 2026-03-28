// src/shared/types/broadcast.types.ts
export type BroadcastType =
  | "INSTRUCTION"
  | "LITURGICAL"
  | "FASTING"
  | "ANNOUNCEMENT"
  | "ORDER"
  | "LESSON";

export interface BroadcastMessage {
  id: string;
  type: BroadcastType;
  title: string;
  content: string;
  authorName: string;
  ethDate: string;
  isUrgent?: boolean;
}

export interface Broadcast {
  id: string;
  fatherId: string;
  fatherName: string;
  title: string;
  content: string;
  type: BroadcastType;
  createdAt: any;
  attachments?: {
    type: "AUDIO" | "PDF" | "IMAGE";
    url: string;
  }[];
}
