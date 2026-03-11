"use client";

import { CheckCircle, Copy, UserPlus } from "lucide-react";
import React, { useState } from "react";

import { issueInvitationTokens } from "@/features/auth/services/tokenService";
import { StudentInput } from "@/shared/types";

export default function RegisterStudent() {
  const [studentName, setStudentName] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const studentData: StudentInput = {
      secularName: studentName,
      // More fields (christianName, etc.) can be added here
    };

    // Replace with actual logged-in Father UID later
    const fatherId = "FATHER_UID_123";

    const result = await issueInvitationTokens(fatherId, [studentData]);

    if (result.success && result.tokens) {
      setGeneratedToken(result.tokens[0].invitationCode);
    } else {
      alert("Error: " + result.error);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="text-blue-600" size={28} />
        <h2 className="text-2xl font-bold text-gray-800">አዲስ ልጅ መመዝገቢያ</h2>
      </div>

      {!generatedToken ? (
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              የልጁ/የተማሪው ሙሉ ስም
            </label>
            <input
              type="text"
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="ለምሳሌ፡ አበበ ካሳ"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400">
            {loading ? "ኮድ በመፍጠር ላይ..." : "የግብዣ ኮድ አመንጭ"}
          </button>
        </form>
      ) : (
        <div className="bg-green-50 p-6 rounded-lg text-center animate-in fade-in duration-500">
          <CheckCircle className="mx-auto text-green-500 mb-2" size={40} />
          <p className="text-green-800 font-medium mb-4">ኮዱ በትክክል ተፈጥሯል!</p>
          <div className="text-4xl font-mono font-bold tracking-widest text-blue-700 mb-4 bg-white py-4 rounded border-2 border-dashed border-blue-200">
            {generatedToken}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(generatedToken);
              alert("ኮዱ ተገልብጧል!");
            }}
            className="flex items-center justify-center gap-2 mx-auto text-blue-600 hover:underline">
            <Copy size={18} /> ኮዱን ቅዳ (Copy)
          </button>
        </div>
      )}
    </div>
  );
}
