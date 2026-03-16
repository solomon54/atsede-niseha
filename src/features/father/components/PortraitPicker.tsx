//src/features/father/components/PortraitPicker.tsx

"use client";

import { AlertTriangle, Camera, Trash2 } from "lucide-react";
import React, { useRef, useState } from "react";

import { cn } from "@/shared/utils/utils";

interface PortraitPickerProps {
  preview: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

export function PortraitPicker({
  preview,
  onSelect,
  onRemove,
}: PortraitPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);

  const handleRemove = () => {
    onRemove();
    setShowDeleteWarning(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="relative group">
        <div
          onClick={() => fileRef.current?.click()}
          className={cn(
            "w-28 h-28 rounded-[2rem] flex items-center justify-center cursor-pointer overflow-hidden shadow-inner transition-transform active:scale-95 border-2",
            preview
              ? "border-amber-200"
              : "bg-slate-50 border-dashed border-slate-200"
          )}>
          {preview ? (
            <img
              src={preview}
              className="w-full h-full object-cover"
              alt="preview"
            />
          ) : (
            <Camera className="text-slate-300" size={32} />
          )}
        </div>

        {preview && !showDeleteWarning && (
          <button
            title="Remove Portrait"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteWarning(true);
            }}
            className="absolute -top-2 -right-2 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all scale-100 active:scale-90">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {showDeleteWarning && (
        <div className="w-full max-w-xs animate-in zoom-in-95 fade-in duration-200">
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0" size={18} />
            <div className="flex-1">
              <p className="text-[10px] font-bold text-amber-900 leading-tight">
                Remove portrait from ledger?
              </p>
              <div className="flex gap-4 mt-2">
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-[10px] font-black text-red-600 uppercase">
                  Yes, Remove
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteWarning(false)}
                  className="text-[10px] font-black text-slate-500 uppercase">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!preview && (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Upload Portrait
        </p>
      )}

      <input
        title="Select Portrait"
        type="file"
        ref={fileRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
        }}
      />
    </div>
  );
}
