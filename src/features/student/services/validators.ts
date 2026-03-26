// services/validators.ts

export function assertStudentId(id: string) {
  if (!id || id.length < 6) {
    throw new Error("Invalid student id");
  }
}
