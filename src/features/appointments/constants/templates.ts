// src/features/appointments/constants/templates.ts

export const LOCATION_TEMPLATES = [
  "ቤተክርስቲያን",
  "ቤተ ክህነት",
  "በግል ቤት",
  "በስልክ / በርቀት",
] as const;

export const MESSAGE_TEMPLATES = [
  "እባክዎ በተቻለ መጠን ያረጋግጡልኝ።",
  "ከቅዳሴ በኋላ እንገናኝ።",
  "ጥዋት እንገናኝ።",
  "ከሰዓት እንገናኝ።",
  "በሰላም እጠብቅዎታለሁ።",
] as const;

const RECENT_KEY = "atsede_appointment_recent_v1";

export type RecentTemplates = {
  locations: string[];
  messages: string[];
};

export function loadRecentTemplates(): RecentTemplates {
  if (typeof window === "undefined") {
    return { locations: [], messages: [] };
  }
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return { locations: [], messages: [] };
    const parsed = JSON.parse(raw) as RecentTemplates;
    return {
      locations: Array.isArray(parsed.locations) ? parsed.locations.slice(0, 6) : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages.slice(0, 6) : [],
    };
  } catch {
    return { locations: [], messages: [] };
  }
}

export function rememberTemplate(
  kind: "locations" | "messages",
  value: string
) {
  if (typeof window === "undefined") return;
  const v = value.trim();
  if (!v) return;
  const current = loadRecentTemplates();
  const list = [v, ...current[kind].filter((x) => x !== v)].slice(0, 6);
  const next = { ...current, [kind]: list };
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}
