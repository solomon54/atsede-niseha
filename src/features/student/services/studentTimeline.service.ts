// src/features/student/services/studentTimeline.service.ts

import { mapTimeline, StudentTimelineEvent } from "../utils/studentMapper";

// ─────────────────────────────────────────────
// TEMP MVP REPOSITORY
// ─────────────────────────────────────────────
const studentRepositoryMVP = {
  async getTimeline(studentId: string): Promise<StudentTimelineEvent[]> {
    // Return mock events for MVP
    return [
      {
        id: "evt1",
        title: "Joined College",
        description: "Student registered at College of Engineering",
        date: "2025-09-01T00:00:00.000Z",
        type: "ACADEMIC",
      },
      {
        id: "evt2",
        title: "Completed Semester 1",
        description: "First semester completed successfully",
        date: "2025-12-15T00:00:00.000Z",
        type: "ACADEMIC",
      },
    ];
  },
};

// ─────────────────────────────────────────────
// STUDENT TIMELINE SERVICE
// ─────────────────────────────────────────────
export class StudentTimelineService {
  static async getTimeline(studentId: string): Promise<StudentTimelineEvent[]> {
    const events = await studentRepositoryMVP.getTimeline(studentId);
    return mapTimeline(events);
  }
}
