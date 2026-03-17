//src/features/father/components/PortraitPicker.tsx

"use client";

import { AlertTriangle, Camera, Trash2 } from "lucide-react";
import React, { useRef, useState } from "react";

import { cn } from "@/shared/utils/utils";

interface PortraitPickerProps {
  preview: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  error?: string;
}

export function PortraitPicker({
  preview,
  onSelect,
  onRemove,
  error,
}: PortraitPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
    setShowDeleteWarning(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="w-full flex flex-col items-center gap-5">
      {/* ELITE FIX: We use a key based on the error message. 
          When the error changes, the div "re-mounts" and the animation plays again.
      */}
      <div
        key={error}
        className={cn("relative group", error && !preview && "animate-shake")}>
        <div
          onClick={() => fileRef.current?.click()}
          className={cn(
            "w-32 h-32 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer overflow-hidden shadow-sm transition-all duration-300 border-2",
            "hover:shadow-md active:scale-95",
            preview
              ? "border-amber-200 ring-4 ring-amber-50"
              : error
              ? "border-red-400 bg-red-50"
              : "bg-slate-50 border-dashed border-slate-200 hover:border-amber-300 hover:bg-amber-50/30"
          )}>
          {preview ? (
            <img
              src={preview}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              alt="Portrait Preview"
            />
          ) : (
            <Camera
              className={cn(
                "transition-colors duration-300",
                error
                  ? "text-red-400"
                  : "text-slate-300 group-hover:text-amber-400"
              )}
              size={36}
              strokeWidth={1.5}
            />
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
            className="absolute -top-2 -right-2 p-2.5 bg-white text-red-500 rounded-2xl shadow-xl border border-red-50 hover:bg-red-500 hover:text-white transition-all scale-100 active:scale-90">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {showDeleteWarning && (
        <div className="w-full max-w-[240px] animate-in zoom-in-95 fade-in slide-in-from-top-2 duration-200">
          <div className="bg-white border border-red-100 p-4 rounded-2xl shadow-xl flex flex-col items-center text-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
              <AlertTriangle className="text-red-500" size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-900 leading-tight">
                Remove from ledger?
              </p>
              <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-tighter">
                This action cannot be undone
              </p>
            </div>
            <div className="flex w-full gap-2 pt-1">
              <button
                type="button"
                onClick={handleRemove}
                className="flex-1 py-2 bg-red-500 text-white text-[9px] font-black uppercase rounded-lg hover:bg-red-600 transition-colors">
                Delete
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteWarning(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-600 text-[9px] font-black uppercase rounded-lg hover:bg-slate-200 transition-colors">
                Keep
              </button>
            </div>
          </div>
        </div>
      )}

      {error && !preview && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 rounded-full border border-red-100 animate-in fade-in slide-in-from-top-1">
          <span className="text-red-500 text-xs">✕</span>
          <p className="text-[10px] text-red-700 font-bold uppercase tracking-tight">
            {error}
          </p>
        </div>
      )}

      {!preview && !error && (
        <div className="text-center space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Upload Portrait
          </p>
          <p className="text-[8px] text-slate-300 font-medium uppercase">
            JPG, PNG up to 5MB
          </p>
        </div>
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
