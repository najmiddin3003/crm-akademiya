"use client";

import "@fontsource-variable/onest/wght.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Globe, Loader2, Lock, LogOut, Unlock } from "lucide-react";
import Link from "@/components/ui/Link";
import { setLang, useT } from "@/components/shared/Language";
import PasswordInput from "@/components/v2/form/PasswordInput";
import { Field } from "@/components/v2/form/fields";
import { primaryBtn } from "@/components/v2/ui/buttons";
import { AuthLogo } from "./AuthBrandPanel";

// YANGI VERSIYA — EKRAN QULFI (37-qism, rasmlar «Ekran qulfi», «Qulf — telefon»). Katta soat va sana, avatar
// (qulf belgisi bilan), ism, lavozim · filial, «Qulflangan · 18:12 dan beri», parol, «Ochish», «Parolni unutdim?»
// (chiqib, kirish sahifasidagi tiklash), «Boshqa hisob bilan kirish». 5 marta xato — hisobdan chiqariladi
// (app/api/auth/unlock). Ochilgach oldingi sahifaga qaytadi.

export interface LockInfo {
  fullName: string;
  role: string;
  branch: string;
  avatar: string;
  lockedAt: string | null;
}

const uzHm = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(11, 16);

export default function LockScreenV2({ info }: { info: LockInfo }) {
  const { t, lang, months } = useT();
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 15_000);
    return () => (window.clearTimeout(first), window.clearInterval(id));
  }, []);
  const parts = info.fullName.trim().split(/\s+/);
  const ini = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
  const uz = now ? new Date(now.getTime() + 5 * 3600_000) : null;
  const WD = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  const dateLine = uz ? `${t(WD[uz.getUTCDay()])}, ${uz.getUTCDate()}-${months[uz.getUTCMonth()].toLowerCase()}` : "";

  async function unlock() {
    if (!pass || busy) return;
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pass }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (r?.ok) {
      try {
        localStorage.setItem("tizimli:last-activity", String(Date.now()));
      } catch {}
      if (window.history.length > 1) router.back();
      else router.replace("/home");
      router.refresh();
      return;
    }
    if (r?.loggedOut) {
      router.replace("/");
      router.refresh();
      return;
    }
    setPass("");
    setErr(r?.left ? t("Parol noto'g'ri — yana {n} ta urinish qoldi", { n: r.left }) : t(r?.error || "Parol noto'g'ri"));
  }
  async function logout(to: string) {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace(to);
    router.refresh();
  }

  return (
    <div data-ui="v2" className="relative min-h-screen bg-v2-bg font-v2 text-v2-text">
      <header className="flex items-center justify-between px-4 py-4 sm:px-7">
        <AuthLogo />
        <button type="button" onClick={() => setLang(lang === "uz" ? "uz-cyrl" : lang === "uz-cyrl" ? "en" : "uz")} className="inline-flex items-center gap-1.5 text-v2-small text-v2-text-2">
          <Globe className="size-4" aria-hidden /> {lang === "uz" ? "O'zbekcha" : lang === "uz-cyrl" ? "Ўзбекча" : "English"}
        </button>
      </header>
      <main className="mx-auto flex max-w-[400px] flex-col items-center px-4 pb-10">
        <div className="mt-4 text-[56px] font-semibold leading-none tabular-nums sm:text-[64px]" suppressHydrationWarning>
          {now ? uzHm(now) : " "}
        </div>
        <div className="mt-2 text-v2-body text-v2-text-2">{dateLine}</div>
        <section className="mt-8 w-full rounded-v2-lg border border-v2-border bg-v2-surface p-6 shadow-v2-lg">
          <div className="flex flex-col items-center text-center">
            <span className="relative">
              {info.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- yuklangan rasm
                <img src={info.avatar} alt="" className="size-[72px] rounded-full object-cover" />
              ) : (
                <span className="flex size-[72px] items-center justify-center rounded-full bg-v2-brand text-[24px] font-semibold text-white">{ini}</span>
              )}
              <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border border-v2-border bg-v2-surface text-v2-text-2">
                <Lock className="size-3.5" aria-hidden />
              </span>
            </span>
            <div className="mt-3 text-[18px] font-semibold">{info.fullName}</div>
            <div className="text-v2-small text-v2-text-2">{[t(info.role), info.branch].filter(Boolean).join(" · ")}</div>
            <span className="mt-2 rounded-full bg-v2-surface-2 px-2.5 py-0.5 text-v2-caption font-semibold text-v2-text-2">{info.lockedAt ? t("Qulflangan · {t} dan beri", { t: uzHm(new Date(info.lockedAt)) }) : t("Qulflangan")}</span>
          </div>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void unlock();
            }}
          >
            <Field label={t("Parol")} htmlFor="lock-pass" error={err || undefined}>
              <PasswordInput id="lock-pass" value={pass} onChange={(v) => (setPass(v), setErr(""))} autoComplete="current-password" state={err ? "error" : "default"} />
            </Field>
            <button type="submit" disabled={!pass || busy} className={`${primaryBtn} h-11 w-full justify-center disabled:opacity-60`}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Unlock className="size-4" aria-hidden />} {t("Ochish")}
            </button>
          </form>
          <div className="mt-4 flex items-center justify-between gap-3 text-v2-small">
            <button type="button" onClick={() => void logout("/")} className="font-semibold text-v2-brand">
              {t("Parolni unutdim?")}
            </button>
            <button type="button" onClick={() => void logout("/")} className="inline-flex items-center gap-1.5 text-v2-text-2 hover:text-v2-text">
              <LogOut className="size-4" aria-hidden /> {t("Boshqa hisob bilan kirish")}
            </button>
          </div>
        </section>
        <ul className="mt-4 space-y-2 text-v2-small text-v2-text-2">
          <li className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Ochiq oyna va yozilgan ma'lumot saqlangan — ochgach shu joydan davom etasiz.")}
          </li>
          <li className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("5 marta xato kiritilsa — hisobdan chiqariladi va qayta kirish kerak bo'ladi.")}
          </li>
        </ul>
        <Link href="/" className="sr-only">
          {t("Kirish sahifasi")}
        </Link>
      </main>
    </div>
  );
}
