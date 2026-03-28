//src/app/offline/page.tsx

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fdfcf6]">
      <div className="text-center">
        <h1 className="text-2xl font-bold font-ethiopic">መስመር ላይ አይደሉም</h1>
        <p className="text-slate-500">
          You are currently outside the digital sanctuary.
        </p>
        <p className="mt-4 text-sm text-amber-700 font-medium italic">
          Cached records remain accessible in your Ledger.
        </p>
      </div>
    </div>
  );
}
