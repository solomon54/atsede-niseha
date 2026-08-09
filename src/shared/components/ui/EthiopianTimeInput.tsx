// src/shared/components/ui/EthiopianTimeInput.tsx
"use client";

import type { EthiopianClockTime, EthiopianDayPeriod } from "@/shared/utils/calendar/ethiopianCalendar";
import { cn } from "@/shared/utils/utils";

type Props = {
  value: EthiopianClockTime;
  onChange: (v: EthiopianClockTime) => void;
  invalid?: boolean;
};

const PERIODS: EthiopianDayPeriod[] = ["ጥዋት", "ከሰዓት"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

export default function EthiopianTimeInput({ value, onChange, invalid }: Props) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-2",
        invalid && "rounded-xl ring-1 ring-red-200"
      )}>
      <select
        title="ሰዓት"
        value={value.hour}
        onChange={(e) =>
          onChange({ ...value, hour: Number(e.target.value) })
        }
        className="sanctuary-input appearance-none cursor-pointer">
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h} ሰዓት
          </option>
        ))}
      </select>

      <select
        title="ደቂቃ"
        value={value.minute - (value.minute % 5)}
        onChange={(e) =>
          onChange({ ...value, minute: Number(e.target.value) })
        }
        className="sanctuary-input appearance-none cursor-pointer">
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")} ደቂቃ
          </option>
        ))}
      </select>

      <select
        title="ክፍለ ቀን"
        value={value.period}
        onChange={(e) =>
          onChange({
            ...value,
            period: e.target.value as EthiopianDayPeriod,
          })
        }
        className="sanctuary-input appearance-none cursor-pointer font-semibold text-[#9b2d30]">
        {PERIODS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}
