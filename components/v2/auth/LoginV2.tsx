"use client";

// Onest — dizayn shrifti (qobiqsiz sahifa — o'zi yuklaydi, AppShellV2 dagidek).
import "@fontsource-variable/onest/wght.css";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { useT } from "@/components/shared/Language";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { Field, PhoneField, TextInput, formatLocalPhone, type FieldState } from "@/components/v2/form/fields";
import { primaryBtn } from "@/components/v2/ui/buttons";
import AuthBrandPanel, { AuthLogo } from "./AuthBrandPanel";
import BranchPickV2, { type BranchChoice } from "./BranchPickV2";

// YANGI VERSIYA — KIRISH SAHIFASI «/» (rasm «Kirish sahifasi», yorug'/qorong'i, 25.10.2026, 14-qism):
//   • chapda teal panel (AuthBrandPanel), o'ngda «Tizimga kirish», «Telefon raqamingiz va
//     parolingizni kiriting»; Telefon (+998 bo'lagi), Parol (ko'z tugmasi); «Meni eslab qol» va
//     «Parolni unutdim?»; «→] Kirish»; ostida 🛡 «Login yoki parol bo'lmasa …» qutisi;
//   • «Meni eslab qol» belgilanmasa — sessiya brauzer yopilguncha (POST /api/auth/login `remember`);
//   • «Parolni unutdim?» — telefon → SMS kod → yangi parol (mavjud forgot/reset-password API'lari;
//     rasmda yo'q, shu sahifa ichida);
//   • kirgach bir nechta filial bo'lsa — «Filial tanlash» (BranchPickV2), aks holda bosh sahifa.
// Eski ko'rinish — `/?classic=1` (app/page.tsx).

type Step = "login" | "forgot" | "reset";

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  state = "default",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  state?: FieldState;
}) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextInput id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} state={state} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t("Parolni yashirish") : t("Parolni ko'rsatish")}
        title={show ? t("Parolni yashirish") : t("Parolni ko'rsatish")}
        className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
      >
        {show ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
      </button>
    </div>
  );
}

function Alert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-v2-md px-3 py-2 text-v2-small ${tone === "error" ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-success-bg text-v2-success"}`}>
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export default function LoginV2() {
  const { t } = useT();
  const router = useRouter();
  const [step, setStep] = useState<Step>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<{ name: string; branches: BranchChoice[]; lastBranchId: number | null } | null>(null);
  // Parolni tiklash
  const [code, setCode] = useState("");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (step !== "reset" || seconds <= 0) return;
    const id = window.setTimeout(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [step, seconds]);

  const goHome = () => {
    router.push("/home");
    router.refresh();
  };
  const toStep = (s: Step) => {
    setStep(s);
    setError("");
    if (s !== "login") setNotice("");
  };

  async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string; status: number }> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: Boolean(d.ok), error: d.error, status: res.status };
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (phone.length < 9 || !password.trim()) {
      setError(t("Telefon raqam va parolni to'liq kiriting"));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await post("/api/auth/login", { phone, password, remember });
      if (!r.ok) {
        setError(t(r.error || "Kirishda xatolik yuz berdi"));
        setBusy(false);
        return;
      }
      // Bir nechta filial — «Filial tanlash»; bitta yoki javob kelmasa — to'g'ri bosh sahifa.
      const b = await fetch("/api/auth/branches", { cache: "no-store" })
        .then((res) => res.json())
        .catch(() => null);
      if (b?.ok && Array.isArray(b.branches) && b.branches.length > 1) {
        setChoice({ name: String(b.name ?? ""), branches: b.branches as BranchChoice[], lastBranchId: typeof b.lastBranchId === "number" ? b.lastBranchId : null });
        setBusy(false);
        return;
      }
      goHome();
    } catch {
      setError(t("Server bilan bog'lanib bo'lmadi"));
      setBusy(false);
    }
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (phone.length < 9) {
      setError(t("To'liq telefon raqamni kiriting"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await post("/api/auth/forgot-password", { phone });
      if (!r.ok) setError(t(r.error || "Kod yuborilmadi"));
      else {
        setStep("reset");
        setSeconds(60);
        setCode("");
        setPass1("");
        setPass2("");
      }
    } catch {
      setError(t("Server bilan bog'lanib bo'lmadi"));
    }
    setBusy(false);
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (code.length !== 6) return setError(t("6 xonali kodni to'liq kiriting"));
    if (pass1.length < 8) return setError(t("Parol kamida 8 ta belgidan iborat bo'lishi kerak"));
    if (pass1 !== pass2) return setError(t("Parollar mos kelmadi"));
    setBusy(true);
    setError("");
    try {
      const r = await post("/api/auth/reset-password", { phone, code, new_password: pass1 });
      if (!r.ok) setError(t(r.error || "Parol saqlanmadi"));
      else {
        setStep("login");
        setPassword("");
        setNotice(t("Parol yangilandi — yangi parol bilan kiring"));
      }
    } catch {
      setError(t("Server bilan bog'lanib bo'lmadi"));
    }
    setBusy(false);
  }

  if (choice) return <BranchPickV2 name={choice.name} branches={choice.branches} lastBranchId={choice.lastBranchId} onDone={goHome} />;

  const backLink = (
    <button type="button" onClick={() => toStep("login")} className="inline-flex items-center gap-1.5 rounded-v2-sm text-v2-small font-medium text-v2-text-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus">
      <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
      {t("Kirishga qaytish")}
    </button>
  );

  return (
    <div data-ui="v2" className="flex min-h-dvh bg-v2-bg font-v2 text-v2-body text-v2-text">
      <AuthBrandPanel />
      <main className="flex min-w-0 flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[368px]">
          <div className="mb-8 lg:hidden">
            <AuthLogo />
          </div>

          {step === "login" && (
            <>
              <h1 className="text-[24px] font-semibold leading-8 text-v2-text">{t("Tizimga kirish")}</h1>
              <p className="mt-1 text-v2-body text-v2-text-2">{t("Telefon raqamingiz va parolingizni kiriting")}</p>
              <form onSubmit={(e) => void onLogin(e)} noValidate className="mt-7 space-y-4">
                <Field label={t("Telefon raqam")} htmlFor="login-phone">
                  <PhoneField id="login-phone" value={phone} onChange={setPhone} state={error && phone.length < 9 ? "error" : "default"} />
                </Field>
                <Field label={t("Parol")} htmlFor="login-password">
                  <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" state={error && !password.trim() ? "error" : "default"} />
                </Field>
                <div className="flex items-center justify-between gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-v2-small text-v2-text">
                    <V2Checkbox checked={remember} onChange={setRemember} label={t("Meni eslab qol")} />
                    <span>{t("Meni eslab qol")}</span>
                  </label>
                  <button type="button" onClick={() => toStep("forgot")} className="rounded-v2-sm text-v2-small font-semibold text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
                    {t("Parolni unutdim?")}
                  </button>
                </div>
                {notice && <Alert tone="success">{notice}</Alert>}
                {error && <Alert tone="error">{error}</Alert>}
                <button type="submit" disabled={busy} className={`${primaryBtn} h-11 w-full justify-center disabled:opacity-60`}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogIn className="size-4" strokeWidth={2} aria-hidden />}
                  {busy ? t("Kirilmoqda...") : t("Kirish")}
                </button>
              </form>
              <div className="mt-7 flex items-start gap-2 rounded-v2-lg border border-v2-border bg-v2-surface px-3 py-3 text-[12px] font-normal leading-[18px] text-v2-text-2">
                <ShieldCheck className="mt-px size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                <p>{t("Login yoki parol bo'lmasa, markaz rahbariga murojaat qiling. Begona qurilmada «Meni eslab qol»ni belgilamang.")}</p>
              </div>
            </>
          )}

          {step === "forgot" && (
            <>
              {backLink}
              <h1 className="mt-5 text-[24px] font-semibold leading-8 text-v2-text">{t("Parolni tiklash")}</h1>
              <p className="mt-1 text-v2-body text-v2-text-2">{t("Telefon raqamingizga SMS orqali tasdiqlash kodi yuboramiz.")}</p>
              <form onSubmit={(e) => void sendCode(e)} noValidate className="mt-7 space-y-4">
                <Field label={t("Telefon raqam")} htmlFor="forgot-phone">
                  <PhoneField id="forgot-phone" value={phone} onChange={setPhone} state={error ? "error" : "default"} />
                </Field>
                {error && <Alert tone="error">{error}</Alert>}
                <button type="submit" disabled={busy} className={`${primaryBtn} h-11 w-full justify-center disabled:opacity-60`}>
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {busy ? t("Yuborilmoqda...") : t("Kod yuborish")}
                </button>
              </form>
            </>
          )}

          {step === "reset" && (
            <>
              {backLink}
              <h1 className="mt-5 text-[24px] font-semibold leading-8 text-v2-text">{t("Yangi parol")}</h1>
              <p className="mt-1 text-v2-body text-v2-text-2">
                <span className="tabular-nums">+998 {formatLocalPhone(phone)}</span> {t("raqamiga 6 xonali kod yuborildi")}
              </p>
              <form onSubmit={(e) => void onReset(e)} noValidate className="mt-7 space-y-4">
                <Field label={t("SMS kod")} htmlFor="reset-code">
                  <TextInput
                    id="reset-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    className="text-center text-[18px] font-semibold tracking-[0.5em] tabular-nums"
                  />
                </Field>
                <Field label={t("Yangi parol")} htmlFor="reset-pass1" hint={t("Kamida 8 ta belgi")}>
                  <PasswordInput id="reset-pass1" value={pass1} onChange={setPass1} autoComplete="new-password" />
                </Field>
                <Field label={t("Parolni tasdiqlang")} htmlFor="reset-pass2">
                  <PasswordInput id="reset-pass2" value={pass2} onChange={setPass2} autoComplete="new-password" />
                </Field>
                {error && <Alert tone="error">{error}</Alert>}
                <button type="submit" disabled={busy} className={`${primaryBtn} h-11 w-full justify-center disabled:opacity-60`}>
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {busy ? t("Saqlanmoqda...") : t("Parolni saqlash")}
                </button>
                <div className="text-center">
                  {seconds > 0 ? (
                    <span className="text-v2-small text-v2-text-3 tabular-nums">{t("Qayta kod yuborish")} · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
                  ) : (
                    <button type="button" onClick={() => void sendCode()} disabled={busy} className="rounded-v2-sm text-v2-small font-semibold text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
                      {t("Qayta kod yuborish")}
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
