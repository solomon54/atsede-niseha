//src/shared/components/ui/EthiopianDateInput.tsx
"use client";

import React, { useMemo } from "react";

import {
  ETHIOPIAN_MONTHS,
  getEthiopianMonthDays,
  getTodayEthiopian,
} from "@/shared/utils/calendar/ethiopianCalendar";

interface Props {
  value: {
    year: number;
    month: number;
    day: number;
  };
  onChange: (date: { year: number; month: number; day: number }) => void;
}

/**
 * EthiopianDateInput: A high-precision ecclesiastical date selector.
 * Optimized for Pagume logic and EOTC production standards.
 */
export default function EthiopianDateInput({ value, onChange }: Props) {
  const todayEC = getTodayEthiopian();

  // 1. Generate Year Range (from current EC year back to 1900)
  const years = useMemo(() => {
    const startYear = 1900;
    const endYear = todayEC.year;
    return Array.from(
      { length: endYear - startYear + 1 },
      (_, i) => endYear - i
    );
  }, [todayEC.year]);

  // 2. Calculate Max Days for the selected Month/Year (Handles Pagume Leap Years)
  const maxDays = useMemo(() => {
    if (!value.year || !value.month) return 30;
    return getEthiopianMonthDays(value.year, value.month);
  }, [value.year, value.month]);

  const days = Array.from({ length: maxDays }, (_, i) => i + 1);

  const update = (key: "year" | "month" | "day", val: number) => {
    const newData = { ...value, [key]: val };

    // Auto-adjust day if switching from a 30-day month to Pagume
    if (key === "month" || key === "year") {
      const newMax = getEthiopianMonthDays(newData.year, newData.month);
      if (newData.day > newMax) newData.day = newMax;
    }

    onChange(newData);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* YEAR SELECT */}
      <div className="relative">
        <select
          title="ዓመት ይምረጡ"
          value={value.year || ""}
          onChange={(e) => update("year", Number(e.target.value))}
          className="sanctuary-input appearance-none cursor-pointer hover:border-amber-400 transition-colors">
          <option value="" disabled>
            ዓመት
          </option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* MONTH SELECT */}
      <div className="relative">
        <select
          title="ወር 1-13 "
          value={value.month || ""}
          onChange={(e) => update("month", Number(e.target.value))}
          className="sanctuary-input appearance-none cursor-pointer hover:border-amber-400 transition-colors">
          <option value="" disabled>
            ወር
          </option>
          {ETHIOPIAN_MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* DAY SELECT */}
      <div className="relative">
        <select
          title="ቀን ይምረጡ "
          value={value.day || ""}
          onChange={(e) => update("day", Number(e.target.value))}
          className="sanctuary-input appearance-none cursor-pointer hover:border-amber-400 transition-colors">
          <option value="" disabled>
            ቀን
          </option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
