//src/features/governor/components/AuthorizeFathersForm.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  SpiritualFatherProfile,
  SpiritualFatherSchema,
} from "../services/validators";

interface AuthorizeFormProps {
  onSuccess?: () => void;
}

export default function AuthorizeFathersForm({
  onSuccess,
}: AuthorizeFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SpiritualFatherProfile & { uid: string }>({
    resolver: zodResolver(
      SpiritualFatherSchema.extend({
        uid: z
          .string()
          .min(1, "Auth UID is required from Firebase Authentication"),
      })
    ),
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/governor/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Authority Granted. The Spiritual Father is now registered in the Sanctuary.",
        });
        reset();
        if (onSuccess) onSuccess();
      } else {
        setMessage({
          type: "error",
          text: result.error || "Authorization failed.",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error. The Gate is closed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-bold text-slate-800 mb-4">
        Ordain New Spiritual Father
      </h3>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Firebase User UID
        </label>
        <input
          {...register("uid")}
          className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Paste Auth UID here"
        />
        {errors.uid && (
          <p className="text-red-500 text-xs mt-1">
            {errors.uid.message as string}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Full Name
          </label>
          <input
            {...register("fullName")}
            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          {errors.fullName && (
            <p className="text-red-500 text-xs mt-1">
              {errors.fullName.message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Parish (ደብር)
          </label>
          <input
            {...register("parish")}
            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          {errors.parish && (
            <p className="text-red-500 text-xs mt-1">{errors.parish.message}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400">
        {loading ? "Processing Ordination..." : "Confirm Authority"}
      </button>

      {message && (
        <div
          className={`mt-4 p-3 rounded-md text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}>
          {message.text}
        </div>
      )}
    </form>
  );
}
