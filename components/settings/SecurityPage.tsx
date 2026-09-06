"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import PasswordField from "@/components/auth/PasswordField";

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


  return (
    <div className="page-frame container mx-auto max-w-[900px] p-4 space-y-4">
      <h1 className="text-[18px] font-bold tracking-tight">Xavfsizlik</h1>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <h2 className="text-[14px] font-semibold">Parolni o&apos;zgartirish</h2>

        {/* Uchala maydon ham `PasswordField` — ichida ko'rsatish/yashirish
            tugmasi bor. Ilgari bu yerda oddiy `type="password"` inputlar
            turardi va yozilgan parolni tekshirib bo'lmasdi; ko'z ikonkasi
            login va faollashtirish ekranlarida allaqachon bor edi, ya'ni
            bu yerda uni takrorlash emas, o'sha komponentni ishlatish
            kerak edi. */}
        <PasswordField
          id="sec-current"
          label="Joriy parol"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <PasswordField
          id="sec-new"
          label="Yangi parol"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint="Kamida 8 belgi"
        />
        <PasswordField
          id="sec-repeat"
          label="Yangi parolni takrorlang"
          value={repeat}
          onChange={setRepeat}
          autoComplete="new-password"
        />

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
