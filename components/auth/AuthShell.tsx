"use client";

// login/register uchun umumiy vizual qobiq — Sidebar/Navbar mavjud emas
// (bu sahifalar (app) guruhidan tashqarida, to'liq ekranli).
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center bg-secondary/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">Tizimli</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
