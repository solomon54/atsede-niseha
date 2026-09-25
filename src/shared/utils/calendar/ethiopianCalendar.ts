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
  return `${ETHIOPIAN_MONTHS[date.month - 1]} ${date.day} ቀን ${date.year} ዓ.ም.`;
}

/**
 * JDN-Based Ethiopian → Gregorian (inverse of gregorianToEthiopian)
 */
export function ethiopianToGregorian(date: EthiopianDate): Date {
  const era = 1723856;
  const jdn =
    era +
    365 * (date.year - 1) +
    Math.floor(date.year / 4) +
    30 * (date.month - 1) +
    date.day -
    1;

  // JDN → Unix ms (UTC noon-safe via date parts)
  const unixDays = jdn - 2440588;
  return new Date(unixDays * 86400000);
}

export type EthiopianDayPeriod = "ጥዋት" | "እኩለ ቀን" | "ከሰዓት" | "ምሽት" | "ማታ";

export interface EthiopianClockTime {
  /** 1–12 Ethiopian hour */
  hour: number;
  minute: number;
  period: EthiopianDayPeriod;
  isNight: boolean;
}

/**
 * Western local time → traditional Ethiopian clock
 * (Western 06:00 ≈ 12/0 start of ጥዋት cycle; 18:00 ≈ start of ከሰዓት)
 */
export function westernToEthiopianClock(date: Date): EthiopianClockTime {
  const total = date.getHours() * 60 + date.getMinutes();
  const ethTotal = (total - 6 * 60 + 24 * 60) % (24 * 60);
  const ethHour24 = Math.floor(ethTotal / 60);
  const minute = ethTotal % 60;
  
  const h = date.getHours();
  let period: EthiopianDayPeriod;
  
  if (h >= 6 && h < 12) period = "ጥዋት"; // 6:00 AM - 11:59 AM
  else if (h >= 12 && h < 14) period = "እኩለ ቀን"; // 12:00 PM - 1:59 PM
  else if (h >= 14 && h < 17) period = "ከሰዓት"; // 2:00 PM - 4:59 PM
  else if (h >= 17 && h < 20) period = "ምሽት"; // 5:00 PM - 7:59 PM
  else period = "ማታ"; // 8:00 PM - 5:59 AM

  const isNight = ethHour24 >= 12;

  let hour = ethHour24 % 12;
  if (hour === 0) hour = 12;
  return { hour, minute, period, isNight };
}

/**
 * Ethiopian clock + Eth date → JS Date (local wall time approximation via EAT offset storage as ISO)
 */
export function ethiopianDateTimeToDate(
  date: EthiopianDate,
  clock: EthiopianClockTime
): Date {
  const base = ethiopianToGregorian(date);
  // Build UTC date from JDN day, then apply Eth clock → Western hours
  const ethHour24 = (clock.hour % 12) + (clock.isNight ? 12 : 0);
  // Eth 0 = Western 6:00
  const westernMinutes = (ethHour24 * 60 + clock.minute + 6 * 60) % (24 * 60);
  const wh = Math.floor(westernMinutes / 60);
  const wm = westernMinutes % 60;

  // Use calendar Y-M-D from Gregorian conversion in local components
  const g = new Date(base.getTime());
  const y = g.getUTCFullYear();
  const m = g.getUTCMonth();
  const d = g.getUTCDate();
  // Interpret as East Africa local: store as Date with those components in local TZ
  return new Date(y, m, d, wh, wm, 0, 0);
}

export function formatEthiopianDateTime(isoOrDate: string | Date): string {
  const date =
    typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "---";

  const eth = gregorianToEthiopian(date);
  const clock = westernToEthiopianClock(date);
  const hh = String(clock.hour).padStart(2, "0");
  const mm = String(clock.minute).padStart(2, "0");
  return `${formatEthiopianDate(eth)} — ${hh}:${mm} ${clock.period}`;
}

/* ─────────────────────────────────────────────────────────
   COMPACT HELPERS FOR MESSAGING UI
   ───────────────────────────────────────────────────────── */

export const ETHIOPIAN_DAYS_OF_WEEK = [
  "እሑድ",   // Sunday
  "ሰኞ",     // Monday
  "ማክሰኞ",  // Tuesday
  "ረቡዕ",   // Wednesday
  "ሐሙስ",   // Thursday
  "ዓርብ",   // Friday
  "ቅዳሜ",   // Saturday
];

/**
 * Returns Ethiopian time in short format: "2:45 ጥዋት"
 * Used for message bubble timestamps.
 */
export function formatEthiopianTimeShort(timestamp: number | Date): string {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) return "---";
  const clock = westernToEthiopianClock(date);
  const mm = String(clock.minute).padStart(2, "0");
  return `${clock.hour}:${mm} ${clock.period}`;
}

/**
 * Returns short Ethiopian date: "መስከረም 15"
 * Used for conversation list last-message time.
 */
export function formatEthiopianDateShort(timestamp: number | Date): string {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) return "---";
  const eth = gregorianToEthiopian(date);
  return `${ETHIOPIAN_MONTHS[eth.month - 1]} ${eth.day}`;
}

/**
 * Returns date label for message stream separators.
 * - "ዛሬ" (Today)
 * - "ትናንት" (Yesterday)
 * - "ረቡዕ፣ መስከረም 15" (Day of week + date)
 * - "መስከረም 15፣ 2018 ዓ.ም." (Full date if different year)
 */
export function formatEthiopianDateLabel(timestamp: number | Date): string {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) return "---";

  const ethDate = gregorianToEthiopian(date);
  const today = getTodayEthiopian();
  const dayOfWeek = ETHIOPIAN_DAYS_OF_WEEK[date.getDay()];

  // Same date = Today
  if (
    ethDate.year === today.year &&
    ethDate.month === today.month &&
    ethDate.day === today.day
  ) {
    return "ዛሬ";
  }

  // Yesterday check (approximate: subtract 1 day from today)
  let yesterdayDay = today.day - 1;
  let yesterdayMonth = today.month;
  let yesterdayYear = today.year;
  if (yesterdayDay < 1) {
    yesterdayMonth--;
    if (yesterdayMonth < 1) {
      yesterdayMonth = 13;
      yesterdayYear--;
    }
    yesterdayDay = getEthiopianMonthDays(yesterdayYear, yesterdayMonth);
  }
  if (
    ethDate.year === yesterdayYear &&
    ethDate.month === yesterdayMonth &&
    ethDate.day === yesterdayDay
  ) {
    return "ትናንት";
  }

  // Different year
  if (ethDate.year !== today.year) {
    return `${ETHIOPIAN_MONTHS[ethDate.month - 1]} ${ethDate.day}፣ ${ethDate.year} ዓ.ም.`;
  }

  // Same year, different day
  return `${dayOfWeek}፣ ${ETHIOPIAN_MONTHS[ethDate.month - 1]} ${ethDate.day}`;
}

