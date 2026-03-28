// src/shared/components/ui/SearchableSelect.tsx
"use client";

import { Check, ChevronsUpDown, Search, XCircle } from "lucide-react";
import React, {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/shared/utils/utils";

interface Props {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  label: string;
  disabled?: boolean;
  allowClear?: boolean; // ⭐ NEW (optional UX improvement)
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  label,
  disabled = false,
  allowClear = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // --------------------------------------------------
  // LOGIC CORE
  // --------------------------------------------------

  // ✅ Check if current value still exists in options
  const isValidValue = useMemo(() => options.includes(value), [options, value]);

  // ⭐ AUTO CLEAN INVALID VALUE (Hierarchy Safe)
  useEffect(() => {
    if (value && !isValidValue) {
      onChange("");
    }
  }, [isValidValue, value, onChange]);

  // Filter options
  const filtered = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return options;
    return options.filter((o) => o.toLowerCase().includes(lowerQuery));
  }, [options, query]);

  const displayLabel = !value || !isValidValue ? placeholder : value;

  // --------------------------------------------------
  // AUTO SCROLL ACTIVE ITEM
  // --------------------------------------------------

  useEffect(() => {
    if (activeIndex !== -1 && listRef.current) {
      const el = listRef.current.children[activeIndex] as HTMLElement;

      el?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  // --------------------------------------------------
  // CLICK OUTSIDE
  // --------------------------------------------------

  useEffect(() => {
    if (!isOpen) return;

    const clickOut = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };

    document.addEventListener("mousedown", clickOut);
    return () => document.removeEventListener("mousedown", clickOut);
  }, [isOpen]);

  // --------------------------------------------------
  // ACTIONS
  // --------------------------------------------------

  const selectOption = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      else setActiveIndex((p) => (p < filtered.length - 1 ? p + 1 : p));
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((p) => (p > 0 ? p - 1 : 0));
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex !== -1 && filtered[activeIndex])
        selectOption(filtered[activeIndex]);
      else if (filtered.length === 1) selectOption(filtered[0]);
    }

    if (e.key === "Escape") setIsOpen(false);
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "sanctuary-input flex items-center justify-between w-full text-left transition-all",
          isOpen && "ring-2 ring-amber-500/20 border-amber-500",
          disabled && "bg-slate-50 cursor-not-allowed opacity-60"
        )}>
        <span
          className={cn(
            "truncate",
            (!value || !isValidValue) && "text-slate-400 font-normal"
          )}>
          {displayLabel}
        </span>

        <div className="flex items-center gap-1">
          {allowClear && value && (
            <XCircle
              size={14}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="text-slate-300 hover:text-slate-500"
            />
          )}

          <ChevronsUpDown
            size={14}
            className={cn(
              "transition-transform duration-200",
              isOpen ? "text-amber-500 rotate-180" : "text-slate-400"
            )}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
          <div className="flex items-center px-3 border-b border-slate-100 bg-slate-50/50">
            <Search size={14} className="text-slate-400" />

            <input
              autoFocus
              value={query}
              placeholder={`Search ${label}...`}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(-1);
              }}
              className="w-full p-3 bg-transparent text-slate-500 text-[12px] font-bold outline-none placeholder:font-normal placeholder:text-slate-400"
            />

            {query && (
              <button
                title="Clear search"
                type="button"
                onClick={() => setQuery("")}
                className="p-1 hover:bg-slate-100 rounded-full">
                <XCircle size={14} className="text-slate-300" />
              </button>
            )}
          </div>

          <div
            ref={listRef}
            className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {filtered.length ? (
              filtered.map((opt, index) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => selectOption(opt)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "w-full flex justify-between px-3 py-2.5 rounded-lg text-[11px] font-bold transition-all text-left",
                    value === opt
                      ? "bg-amber-50 text-amber-700"
                      : activeIndex === index
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50"
                  )}>
                  <span className="truncate">{opt}</span>
                  {value === opt && <Check size={12} />}
                </button>
              ))
            ) : (
              <div className="p-6 text-center">
                <Search size={24} className="mx-auto text-slate-300 mb-2" />
                <p className="text-[11px] text-slate-500 font-medium">
                  ምንም አልተገኘም
                </p>
                <p className="text-[9px] text-slate-400 uppercase mt-1">
                  No results found
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
