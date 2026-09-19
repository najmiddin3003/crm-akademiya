"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "@/components/ui/Link";
import Button from "@/components/ui/Button";
import AuthShell from "@/components/auth/AuthShell";
import PhoneField, { formatPhoneDigits } from "@/components/auth/PhoneField";
import OtpInput from "@/components/auth/OtpInput";
import PasswordField from "@/components/auth/PasswordField";
import { useT } from "@/components/shared/Language";

type Step = "loading" | "phone" | "otp" | "password" | "done";

// Xodimni faollashtirish oqimi (real backend'ga ulangan):
//  - Havola bilan (?t=token): token tekshiriladi -> to'g'ridan parol o'rnatish.
//  - Qo'lda: telefon -> SMS kod -> parol.
// Parol o'rnatilgach status='active' bo'lib, kirish sahifasiga yo'naltiriladi.
export default function ActivatePage() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("tv") || "";

  const [step, setStep] = useState<Step>(token ? "loading" : "phone");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [tokenValid, setTokenValid] = useState(false);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Havoladagi tokenni tekshiramiz.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          setTokenValid(true);
          setMaskedPhone(data.phone || "");
          setStep("password");
        } else {
          setError(t(data.error || "Havola yaroqsiz. Telefon raqamingiz orqali davom eting."));
          setStep("phone");
        }
      } catch {
        if (!cancelled) {
          setError(t("Serverga ulanib bo'lmadi."));
          setStep("phone");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  // OTP bosqichida qayta yuborish taymeri.
  useEffect(() => {
    if (step !== "otp" || secondsLeft <= 0) return;
    const tv = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(tv);
  }, [step, secondsLeft]);

  useEffect(() => {
    if (step !== "done") return;
    const tv = setTimeout(() => router.push("/"), 1600);
    return () => clearTimeout(tv);
  }, [step, router]);

  const timerLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  // Telefonni kiritib, SMS kod so'raymiz (mavjud kodni qayta yuboradi).
  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    if (phone.length < 9) {
      setError(t("To'liq telefon raqamni kiriting"));
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t(data.error || "Kod yuborilmadi"));
        return;
      }
      setOtp("");
      setSecondsLeft(120);
      setStep("otp");
    } catch {
      setError(t("Serverga ulanib bo'lmadi."));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setBusy(true);
    setError("");
    try {
      await fetch("/api/auth/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      setOtp("");
      setSecondsLeft(120);
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = (e: FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      setError(t("6 xonali kodni to'liq kiriting"));
      return;
    }
    setError("");
    setStep("password");
  };

  // Parolni o'rnatib akkauntni faollashtiramiz.
  const finish = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError(t("Parol kamida 8 ta belgidan iborat bo'lishi kerak"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("Parollar mos kelmadi"));
      return;
    }
    setError("");
    setBusy(true);
    try {
      const payload = tokenValid
        ? { token, new_password: password }
        : { phone, code: otp, new_password: password };
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t(data.error || "Faollashtirib bo'lmadi"));
        // Kod bilan bog'liq xato bo'lsa, foydalanuvchini kod bosqichiga qaytaramiz.
        if (!tokenValid) setStep("otp");
        return;
      }
      setStep("done");
    } catch {
      setError(t("Serverga ulanib bo'lmadi."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      {step === "loading" && (
        <div className="py-6 text-center text-sm text-muted-foreground">{t("Havola tekshirilmoqda...")}</div>
      )}

      {step === "phone" && (
        <>
          <h1 className="text-lg font-semibold tracking-tight">{t("Akkauntni faollashtirish")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Sizga SMS orqali yuborilgan raqamni kiriting, tasdiqlash kodini yuboramiz")}
          </p>
          <form onSubmit={requestCode} className="mt-5 space-y-3.5">
            <PhoneField value={phone} onChange={setPhone} />
            {error && <p className="text-[13px] text-red-500">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full justify-center">
              {busy ? t("Yuborilmoqda...") : t("Kod yuborish")}
            </Button>
          </form>
        </>
      )}

      {step === "otp" && (
        <>
          <h1 className="text-lg font-semibold tracking-tight">{t("Kodni tasdiqlang")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">+998 {formatPhoneDigits(phone)}</span>{" "}{t("raqamiga 6 xonali kod yuborildi")}
          </p>
          <form onSubmit={confirmCode} className="mt-5 space-y-4">
            <div className="flex justify-center">
              <OtpInput value={otp} onChange={setOtp} />
            </div>
            {error && <p className="text-center text-[13px] text-red-500">{error}</p>}
            <Button type="submit" className="w-full justify-center">{t("Tasdiqlash")}</Button>
            {secondsLeft > 0 ? (
              <p className="text-center text-[13px] text-muted-foreground">
                {t("Qayta yuborish")}{" "}<span className="font-semibold tabular-nums text-foreground">{timerLabel}</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={resendCode}
                disabled={busy}
                className="w-full text-center text-[13px] font-medium text-primary hover:underline"
              >
                {t("Qayta kod yuborish")}
              </button>
            )}
          </form>
        </>
      )}

      <div>
        <h1>{t("Kassalar")}</h1>
        <img src="/images/cashiers.jpg" alt={t("Kassalar")} />

      </div>


      {step === "password" && (
        <>
          <h1 className="text-lg font-semibold tracking-tight">{t("Parol o'rnating")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {maskedPhone ? `${maskedPhone} raqami uchun ` : ""}kamida 8 ta belgili parol kiriting
          </p>
          <form onSubmit={finish} className="mt-5 space-y-3.5">
            <PasswordField label={t("Parolni kiriting")} value={password} onChange={setPassword} />
            <PasswordField label={t("Parolni tasdiqlang")} value={confirmPassword} onChange={setConfirmPassword} />
            {error && <p className="text-[13px] text-red-500">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full justify-center">
              {busy ? t("Saqlanmoqda...") : t("Faollashtirish")}
            </Button>
          </form>
        </>
      )}

      {step === "done" && (
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <p className="text-sm font-medium">{t("Akkaunt faollashtirildi!")}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("Kirish sahifasiga yo'naltirilmoqda...")}</p>
        </div>
      )}

      {step !== "done" && step !== "loading" && (
        <p className="mt-5 text-center text-[13px] text-muted-foreground">
          Akkountingiz faolmi?{" "}
          <Link href="/" className="font-medium text-primary hover:underline">
            {t("Kirish")}
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
