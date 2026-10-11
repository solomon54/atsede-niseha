// src/app/legacy-support.tsx
"use client";

// Load polyfills at app startup — runs once, patches missing APIs.
import "@/lib/polyfills";

export function LegacySupport() {
  return null;
}
