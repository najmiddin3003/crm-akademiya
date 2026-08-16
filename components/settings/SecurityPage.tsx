"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

// Sozlamalar → "Xavfsizlik". Referensda bunday sahifa yo'q — bu bizning
// qo'shimchamiz: mavjud infratuzilma (parol, qurilma sessiyalari, ekran
// qulfi) uchun bitta yig'ma sahifa.

export default function SecurityPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);

  const savePassword = async () => {
    // Takrorni serverga yubormaymiz — mos kelmasa shu yerda to'xtatamiz.
    if (next !== repeat) {
      showError("Parollar mos kelmadi");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Saqlanmadi");
      setCurrent("");
      setNext("");
      setRepeat("");
      showSuccess("Parol o'zgartirildi");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setSaving(false);
    }
  };

  const lockScreen = async () => {
    setLocking(true);
    try {
      await fetch("/api/auth/lock", { method: "POST" });
      router.replace("/lock");
      router.refresh();
    } catch {
      showError("Qulflab bo'lmadi");
      setLocking(false);
    }
  };

  const inputClass =
    "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="page-frame container mx-auto max-w-[900px] p-4 space-y-4">
      <h1 className="text-[18px] font-bold tracking-tight">Xavfsizlik</h1>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <h2 className="text-[14px] font-semibold">Parolni o&apos;zgartirish</h2>

        <div>
          <label htmlFor="sec-current" className="block text-[13px] font-medium mb-1.5">Joriy parol</label>
          <input
            id="sec-current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="sec-new" className="block text-[13px] font-medium mb-1.5">Yangi parol</label>
          <input
            id="sec-new"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
          <p className="mt-1.5 text-[12px] text-muted-foreground">Kamida 8 belgi</p>
        </div>

        <div>
          <label htmlFor="sec-repeat" className="block text-[13px] font-medium mb-1.5">Yangi parolni takrorlang</label>
          <input
            id="sec-repeat"
            type="password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>

        <div>
          <button
            onClick={() => void savePassword()}
            disabled={saving}
            className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            Saqlash
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <h2 className="text-[14px] font-semibold">Aktiv qurilmalar</h2>
        <p className="text-[13px] text-muted-foreground">
          Hisobingizga kirgan qurilmalarni ko&apos;rish va chiqarish.
        </p>
        <button
          onClick={() => router.push("/settings-devices")}
          className="h-10 px-6 rounded-lg border border-border text-sm font-medium hover:bg-secondary"
        >
          Qurilmalarni ko&apos;rish
        </button>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <h2 className="text-[14px] font-semibold">Ekranni qulflash</h2>
        <p className="text-[13px] text-muted-foreground">
          Ish joyidan ketayotganda ekranni qulflab qo&apos;ying — qayta kirish uchun parol so&apos;raladi.
        </p>
        <button
          onClick={() => void lockScreen()}
          disabled={locking}
          className="h-10 px-6 rounded-lg border border-border text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          Qulflash
        </button>
      </div>
    </div>
  );
}
