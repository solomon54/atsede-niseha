// src/features/student/utils/studentMapper.ts
// ─────────────────────────────────────────────
// Timeline Types & Mapper (MVP)
// ─────────────────────────────────────────────

export type TimelineEventType = "ACADEMIC" | "SPIRITUAL" | "OTHER";

export interface StudentTimelineEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  type: TimelineEventType;
}

// Simple mapper: identity mapping for MVP, fully typed
export function mapTimeline(
  events: StudentTimelineEvent[]
): StudentTimelineEvent[] {
  return events.map(
    (e: StudentTimelineEvent): StudentTimelineEvent => ({
      id: e.id,
      title: e.title,
      description: e.description,
      date: e.date,
      type: e.type,
    })
  );
}
