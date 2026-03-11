export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <h1 className="text-4xl font-bold text-slate-900 mb-2">Access Denied</h1>
      <p className="text-slate-600 mb-6 max-w-md">
        Your current account does not have the &quot;Governor&quot; authority
        required to enter this sanctuary.
      </p>
      <a
        href="/login"
        className="text-indigo-600 font-semibold hover:underline">
        Return to Login
      </a>
    </div>
  );
}
