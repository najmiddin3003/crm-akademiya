"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import AuthShell from "@/components/auth/AuthShell";
import PhoneField, { formatPhoneDigits } from "@/components/auth/PhoneField";
import OtpInput from "@/components/auth/OtpInput";
import PasswordField from "@/components/auth/PasswordField";

type Step = "phone" | "otp" | "password" | "done";

// Frontend-only ro'yxatdan o'tish: hali SMS-shlyuz yo'q, shu bois kod real
// yuborilmaydi va ekranda ko'rsatilmaydi — tasdiqlashda faqat 6 xona
// kiritilgani tekshiriladi. Backend ulanganda shu joyga real SMS-yuborish va
// akkount yaratish chaqiruvlari keladi.
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");

  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (step !== "done") return;
    const t = setTimeout(() => router.push("/"), 1400);
    return () => clearTimeout(t);
  }, [step, router]);

  // OTP bosqichida 120 soniyalik teskari hisob. Vaqt tugagach 0 da to'xtaydi
  // va "Qayta kod yuborish" tugmasi paydo bo'ladi.
  useEffect(() => {
    if (step !== "otp" || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [step, secondsLeft]);

  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    if (phone.length < 9) {
      setPhoneError("To'liq telefon raqamni kiriting");
      return;
    }
    setPhoneError("");
    setOtp("");
    setOtpError("");
    setSecondsLeft(120);
    setStep("otp");
  };

  const resendCode = () => {
    setOtp("");
    setOtpError("");
    setSecondsLeft(120);
  };

  const confirmCode = (e: FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      setOtpError("6 xonali kodni to'liq kiriting");
      return;
    }
    setOtpError("");
    setStep("password");
  };

  const timerLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  const finishRegister = (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setPasswordError("Parol kamida 6 ta belgidan iborat bo'lishi kerak");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Parollar mos kelmadi");
      return;
    }
    setPasswordError("");
    setStep("done");
  };

  return (
    <AuthShell>
      {step === "phone" && (
        <>
          <h1 className="text-lg font-semibold tracking-tight">Ro&apos;yxatdan o&apos;tish</h1>
          <p className="mt-1 text-sm text-muted-foreground">Telefon raqamingizni kiriting, tasdiqlash kodi yuboramiz</p>
          <form onSubmit={sendCode} className="mt-5 space-y-3.5">
            <PhoneField value={phone} onChange={setPhone} />
            {phoneError && <p className="text-[13px] text-red-500">{phoneError}</p>}
            <Button type="submit" className="w-full justify-center">Kod yuborish</Button>
          </form>
        </>
      )}

      {step === "otp" && (
        <>
          <h1 className="text-lg font-semibold tracking-tight">Kodni tasdiqlang</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">+998 {formatPhoneDigits(phone)}</span> raqamiga 6 xonali kod yuborildi
          </p>
          <form onSubmit={confirmCode} className="mt-5 space-y-4">
            <div className="flex justify-center">
              <OtpInput value={otp} onChange={setOtp} />
            </div>
            {otpError && <p className="text-center text-[13px] text-red-500">{otpError}</p>}
            <Button type="submit" className="w-full justify-center">Tasdiqlash</Button>
            {secondsLeft > 0 ? (
              <p className="text-center text-[13px] text-muted-foreground">
                Qayta yuborish{" "}
                <span className="font-semibold tabular-nums text-foreground">{timerLabel}</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={resendCode}
                className="w-full text-center text-[13px] font-medium text-primary hover:underline"
              >
                Qayta kod yuborish
              </button>
            )}
          </form>
        </>
      )}

      {step === "password" && (
        <>
          <h1 className="text-lg font-semibold tracking-tight">Parol o&apos;rnating</h1>
          <p className="mt-1 text-sm text-muted-foreground">O&apos;zingiz xohlagan parolni kiriting</p>
          <form onSubmit={finishRegister} className="mt-5 space-y-3.5">
            <PasswordField label="Parolni kiriting" value={password} onChange={setPassword} />
            <PasswordField label="Parolni tasdiqlang" value={confirmPassword} onChange={setConfirmPassword} />
            {passwordError && <p className="text-[13px] text-red-500">{passwordError}</p>}
            <Button type="submit" className="w-full justify-center">Ro&apos;yxatdan o&apos;tish</Button>
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
          <p className="text-sm font-medium">Ro&apos;yxatdan muvaffaqiyatli o&apos;tdingiz!</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Kirish sahifasiga yo&apos;naltirilmoqda...</p>
        </div>
      )}

      {step !== "done" && (
        <p className="mt-5 text-center text-[13px] text-muted-foreground">
          Akkountingiz bormi?{" "}
          <Link href="/" className="font-medium text-primary hover:underline">
            Kirish
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
