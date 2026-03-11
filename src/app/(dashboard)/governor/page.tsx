//src/app/(dashboard)/governor/page.tsx

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import AuthorizeFathersForm from "@/features/governor/components/AuthorizeFathersForm";
import { adminDb } from "@/services/firebase/admin";

export default async function GovernorDashboard() {
  const headerList = await headers();
  const role = headerList.get("x-ats-role");
  const userId = headerList.get("x-ats-user-id");

  // Safety check: Only the Governor enters here
  if (role !== "GOVERNOR") {
    redirect("/unauthorized");
  }

  // Real data fetch from your "Sanctuary" (Firestore)
  const fathersSnapshot = await adminDb.collection("Fathers").count().get();
  const studentsSnapshot = await adminDb.collection("Students").count().get();

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Governor Control Center
        </h1>
        <p className="text-slate-500">System Administrator: {userId}</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fathers Count Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            Total Fathers
          </h3>
          <p className="text-4xl font-bold text-indigo-600 mt-2">
            {fathersSnapshot.data().count}
          </p>
        </div>

        {/* Students Count Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            Total Students
          </h3>
          <p className="text-4xl font-bold text-emerald-600 mt-2">
            {studentsSnapshot.data().count}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
        <div className="lg:col-span-1">
          <AuthorizeFathersForm />
        </div>

        <div className="lg:col-span-2">
          {/* This is where your Directory Table will go next */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex items-center justify-center text-slate-400">
            Fathers Directory Table Coming Soon...
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">
          System Health
        </h2>
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-center gap-3">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-emerald-700 font-medium">
            Sovereign Gatekeeper Active (Middleware Verified)
          </span>
        </div>
      </section>
    </div>
  );
}
