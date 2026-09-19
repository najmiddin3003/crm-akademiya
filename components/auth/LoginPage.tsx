"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import AuthShell from "@/components/auth/AuthShell";
import PhoneField from "@/components/auth/PhoneField";
import PasswordField from "@/components/auth/PasswordField";
import { useT } from "@/components/shared/Language";

export default function LoginPage() {
  const { t } = useT();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (phone.length < 9 || !password.trim()) {
      setError(t("Telefon raqam va parolni to'liq kiriting"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(t(data.error || "Kirishda xatolik yuz berdi"));
        setLoading(false);
        return;
      }
      router.push("/home");
      router.refresh();
    } catch {
      setError(t("Server bilan bog'lanib bo'lmadi"));
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-lg font-semibold tracking-tight">{t("Kirish")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("Telefon raqam va parolingizni kiriting")}</p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
        <PhoneField value={phone} onChange={setPhone} />
        <PasswordField label={t("Parol")} value={password} onChange={setPassword} />

        {error && <p className="text-[13px] text-red-500">{error}</p>}

        <Button type="submit" className="w-full justify-center" disabled={loading}>
          {loading ? t("Kirilmoqda...") : t("Kirish")}
        </Button>
      </form>

      {/* "Ro'yxatdan o'tish" havolasi OLIB TASHLANDI. Bu tizimda o'z-o'zidan
          ro'yxatdan o'tish yo'q: hisobni admin yaratadi (Boshqaruv →
          Xodimlar), so'ng foydalanuvchiga 72 soat amal qiladigan
          faollashtirish havolasi SMS bilan boradi (lib/invite.ts →
          /activate). O'sha havoladagi sahifa eskisining o'rnini bosadi. */}
    </AuthShell>
  );
}
