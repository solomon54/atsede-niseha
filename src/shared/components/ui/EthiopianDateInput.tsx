//src/shared/components/ui/EthiopianDateInput.tsx
"use client";

import React from "react";

import { ETHIOPIAN_MONTHS } from "@/shared/utils/calendar/ethiopianCalendar";

interface Props {
  value: {
    year: number;
    month: number;
    day: number;
  };
  onChange: (date: { year: number; month: number; day: number }) => void;
}

export default function EthiopianDateInput({ value, onChange }: Props) {
  const today = new Date().getFullYear() - 8;

  const update = (key: "year" | "month" | "day", val: number) => {
    onChange({
      ...value,
      [key]: val,
    });
  };

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {/* Year */}
      <input
        type="number"
        value={value.year}
        onChange={(e) => update("year", Number(e.target.value))}
        className="sanctuary-input font-mono"
        placeholder="ዓመት"
        max={today}
      />

      {/* Month */}
      <select
        title="month"
        value={value.month}
        onChange={(e) => update("month", Number(e.target.value))}
        className="sanctuary-input">
        {ETHIOPIAN_MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>

      {/* Day */}
      <input
        title="day"
        type="number"
        value={value.day}
        onChange={(e) => update("day", Number(e.target.value))}
        className="sanctuary-input font-mono"
        min={1}
        max={30}
      />
    </div>
  );
}
