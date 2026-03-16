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

export interface EthiopianDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Ethiopian months metadata
 */
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
 * Ethiopian leap year check
 * Every 4 years: (year + 1) % 4 === 0
 */
export function isEthiopianLeapYear(year: number): boolean {
  return (year + 1) % 4 === 0;
}

/**
 * Returns number of days in Ethiopian month
 */
export function getEthiopianMonthDays(year: number, month: number): number {
  if (month === 13) {
    return isEthiopianLeapYear(year) ? 6 : 5;
  }
  return 30;
}

/**
 * Converts Gregorian → Ethiopian
 * Algorithm based on Julian Day conversion.
 */
export function gregorianToEthiopian(date: Date): EthiopianDate {
  const gYear = date.getFullYear();
  const gMonth = date.getMonth() + 1;
  const gDay = date.getDate();

  const newYearDay = gYear % 4 === 3 ? 12 : 11;

  const gDayOfYear = Math.floor(
    (Date.UTC(gYear, gMonth - 1, gDay) - Date.UTC(gYear, 0, 0)) / 86400000
  );

  let eYear = gYear - 8;
  let eDayOfYear = gDayOfYear - newYearDay;

  if (eDayOfYear <= 0) {
    eYear--;
    eDayOfYear += isEthiopianLeapYear(eYear) ? 366 : 365;
  }

  const eMonth = Math.floor((eDayOfYear - 1) / 30) + 1;
  const eDay = ((eDayOfYear - 1) % 30) + 1;

  return { year: eYear, month: eMonth, day: eDay };
}

/**
 * Converts Ethiopian → Gregorian
 */
export function ethiopianToGregorian(
  year: number,
  month: number,
  day: number
): Date {
  const gYear = year + 8;

  const newYearDay = gYear % 4 === 3 ? 12 : 11;

  const dayOfYear = (month - 1) * 30 + day;

  const gDate = new Date(gYear, 0, newYearDay);
  gDate.setDate(gDate.getDate() + dayOfYear - 1);

  return gDate;
}

/**
 * Returns today's Ethiopian date
 */
export function getTodayEthiopian(): EthiopianDate {
  return gregorianToEthiopian(new Date());
}

/**
 * Prevents future dates
 */
export function isFutureEthiopianDate(date: EthiopianDate): boolean {
  const today = getTodayEthiopian();

  if (date.year > today.year) return true;
  if (date.year === today.year && date.month > today.month) return true;
  if (
    date.year === today.year &&
    date.month === today.month &&
    date.day > today.day
  )
    return true;

  return false;
}

/**
 * Calculates age based on Ethiopian birthdate
 */
export function calculateEthiopianAge(
  birth: EthiopianDate,
  reference: EthiopianDate = getTodayEthiopian()
): number {
  let age = reference.year - birth.year;

  if (
    reference.month < birth.month ||
    (reference.month === birth.month && reference.day < birth.day)
  ) {
    age--;
  }

  return age;
}

/**
 * Validates Ethiopian date structure
 */
export function isValidEthiopianDate(date: EthiopianDate): boolean {
  if (date.month < 1 || date.month > 13) return false;

  const maxDays = getEthiopianMonthDays(date.year, date.month);

  if (date.day < 1 || date.day > maxDays) return false;

  return true;
}

/**
 * Formats Ethiopian date
 */
export function formatEthiopianDate(date: EthiopianDate): string {
  const monthName = ETHIOPIAN_MONTHS[date.month - 1];

  return `${monthName} ${date.day} / ${date.year}`;
}

/**
 * Serializes Ethiopian date for database storage
 */
export function serializeEthiopianDate(date: EthiopianDate): string {
  const m = String(date.month).padStart(2, "0");
  const d = String(date.day).padStart(2, "0");

  return `${date.year}-${m}-${d}`;
}

/**
 * Parses serialized Ethiopian date
 */
export function parseEthiopianDate(value: string): EthiopianDate {
  const [year, month, day] = value.split("-").map(Number);

  return {
    year,
    month,
    day,
  };
}
