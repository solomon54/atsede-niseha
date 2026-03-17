//src/shared/utils/calendar/ethiopianCalendar.ts
/**
 * Ethiopian Calendar Utilities
 * ------------------------------------------------------------
 * Production-grade utilities for handling Ethiopian calendar
 * logic across the Atsede Niseha system.
 *
 * Features:
 * - Ethiopian ↔ Gregorian conversion
 * - Ethiopian today generator
 * - Pagume support
 * - Age calculation
 * - Future-date prevention
 * - Zod validator helpers
 *
 * These utilities are intentionally framework-agnostic so they
 * can be reused in both server and client environments.
 */

//src/shared/utils/calendar/ethiopianCalendar.ts
/**
 * Ethiopian Calendar Utilities
 * ------------------------------------------------------------
 * Production-grade utilities for handling Ethiopian calendar
 * logic across the Atsede Niseha system.
 *
 * Features:
 * - Ethiopian ↔ Gregorian conversion
 * - Ethiopian today generator
 * - Pagume support
 * - Age calculation
 * - Future-date prevention
 * - Zod validator helpers
 *
 * These utilities are intentionally framework-agnostic so they
 * can be reused in both server and client environments.
 */

/**
 * Ethiopian Calendar Utilities - Sovereign Ledger Edition
 * Optimized for liturgical precision and strict validation.
 */

export interface EthiopianDate {
  year: number;
  month: number;
  day: number;
}

export const ETHIOPIAN_MONTHS = [
  "መስከረም",
  "ጥቅምት",
  "ኅዳር",
  "ታኅሣሥ",
  "ጥር",
  "የካቲት",
  "መጋቢት",
  "ሚያዝያ",
  "ግንቦት",
  "ሰኔ",
  "ሐምሌ",
  "ነሐሴ",
  "ጳጉሜ",
];

/**
 * High-Precision Leap Year Calculation
 * Every 4 years, the year before the Gregorian leap year is an Ethiopian leap year.
 */
export function isEthiopianLeapYear(year: number): boolean {
  return (year + 1) % 4 === 0;
}

export function getEthiopianMonthDays(year: number, month: number): number {
  if (month === 13) return isEthiopianLeapYear(year) ? 6 : 5;
  return 30;
}

/**
 * JDN-Based Elite Conversion (Gregorian -> Ethiopian)
 * This is the gold standard for calendar conversion.
 */
export function gregorianToEthiopian(date: Date): EthiopianDate {
  const era = 1723856; // Ethiopian Era Offset
  const jdn = Math.floor(date.getTime() / 86400000) + 2440588;

  const r = (jdn - era) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);

  const year =
    4 * Math.floor((jdn - era) / 1461) +
    Math.floor(r / 365) -
    Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;

  return { year, month, day };
}

/**
 * Returns today's Ethiopian date adjusted for East Africa Time (UTC+3)
 */
export function getTodayEthiopian(): EthiopianDate {
  const now = new Date();
  // Adjust to EAT (UTC+3) to ensure "Today" matches local Ethiopian time
  const eatOffset = 3 * 60 * 60 * 1000;
  const localDate = new Date(now.getTime() + eatOffset);
  return gregorianToEthiopian(localDate);
}

/**
 * Professional Validator: Allows current day, blocks true future.
 */
export function isFutureEthiopianDate(date: EthiopianDate): boolean {
  const today = getTodayEthiopian();

  if (date.year > today.year) return true;
  if (date.year < today.year) return false;

  // If same year, check month
  if (date.month > today.month) return true;
  if (date.month < today.month) return false;

  // If same month, check day
  return date.day > today.day;
}

/**
 * Age Calculation (Liturgical Precision)
 */
export function calculateEthiopianAge(birth: EthiopianDate): number {
  const today = getTodayEthiopian();
  let age = today.year - birth.year;

  if (
    today.month < birth.month ||
    (today.month === birth.month && today.day < birth.day)
  ) {
    age--;
  }
  return age;
}

export function isValidEthiopianDate(date: EthiopianDate): boolean {
  if (!date.year || date.year < 1) return false;
  if (date.month < 1 || date.month > 13) return false;
  const maxDays = getEthiopianMonthDays(date.year, date.month);
  return date.day >= 1 && date.day <= maxDays;
}

export function formatEthiopianDate(date: EthiopianDate): string {
  if (!date.year) return "---";
  return `${ETHIOPIAN_MONTHS[date.month - 1]} ${date.day}, ${date.year}`;
}
