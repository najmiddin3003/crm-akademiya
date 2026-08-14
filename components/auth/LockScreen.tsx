"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogOut } from "lucide-react";

// Profil menyusi → "Qulflash" bosilganda chiqadigan ekran.
// Sessiya tugatilmagan — foydalanuvchi tizimda qolgan, faqat ekran yopilgan.
// Ochish uchun o'z paroli so'raladi; "Chiqish" esa sessiyani butunlay tugatadi.

export interface LockScreenProps {
  fullName: string;
  phone: string;
}

export default function LockScreen({ fullName, phone }: LockScreenProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const initials = fullName.trim().charAt(0).toUpperCase() || "A";

  const unlock = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Parol noto'g'ri");
      router.replace("/tasks");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parol noto'g'ri");
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
            {initials}
          </div>
          <div className="text-[15px] font-semibold">{fullName}</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">{phone}</div>

          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[12px] font-medium text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Ekran qulflangan
          </div>
        </div>

        <label className="mt-5 mb-1.5 block text-[13px] font-medium">Parol</label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") void unlock(); }}
          placeholder="Parolingizni kiriting"
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {error && <div className="mt-2 text-[13px] text-rose-600">{error}</div>}

        <button
          onClick={() => void unlock()}
          disabled={!password || busy}
          className="mt-4 h-10 w-full rounded-lg bg-primary text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Tekshirilmoqda…" : "Qulfni ochish"}
        </button>

        <button
          onClick={() => void logout()}
          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" />
          Boshqa hisobga kirish
        </button>
      </div>
    </div>
  );
}
