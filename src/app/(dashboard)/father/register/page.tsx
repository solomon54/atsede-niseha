// src/app/(dashboard)/father/register/page.tsx
import { redirect } from "next/navigation";

import { getSession } from "@/core/auth/session.service";
import FatherClaimForm from "@/features/father/components/RegisterChildForm";

export default async function FatherRegisterPage() {
  // 1. Get the REAL session from your custom Firebase flow
  const session = await getSession();

  // 2. Strict Access Control
  if (!session) {
    redirect("/login");
  }

  // 3. Extract the real Firebase UID
  // Firebase decoded tokens use 'uid' instead of 'id'
  const fatherId = session.uid;

  return (
    <main className="min-h-screen bg-[#FDFCFB] flex items-center justify-center relative overflow-hidden">
      {/* Background UI remains the same */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-amber-100/40 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-slate-200/50 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-4 flex flex-col items-center py-10">
        <div className="mb-12 text-center space-y-4">
          <div className="mx-auto w-20 h-20 border-2 border-amber-200 rounded-full flex items-center justify-center bg-white shadow-xl shadow-amber-900/5">
            <span className="text-3xl">✞</span>
          </div>
          <div>
            <h2 className="text-4xl font-black font-ethiopic text-slate-900 tracking-tighter">
              ዐጸደ ንስሐ
            </h2>
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-[0.5em]">
              The Priestly Portal
            </p>
          </div>
        </div>

        {/* PASSING REAL FIREBASE UID */}
        <FatherClaimForm fatherId={fatherId} />

        <footer className="mt-12">
          <p className="text-[9px] text-center text-slate-400 font-bold leading-relaxed uppercase tracking-tighter">
            By registering this child, you agree to the <br />
            <span className="text-amber-700">
              Atsede Niseha Covenant of Secrecy
            </span>
          </p>
        </footer>
      </div>
    </main>
  );
}
