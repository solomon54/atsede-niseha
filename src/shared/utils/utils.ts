import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind classes safely using clsx and tailwind-merge.
 * This prevents style conflicts (e.g., 'p-4' vs 'p-8').
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
