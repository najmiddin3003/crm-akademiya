"use client";

// Onest — dizayn shrifti (AppShellV2 dagidek; bu sahifa qobiqsiz, shuning uchun o'zi yuklaydi).
import "@fontsource-variable/onest/wght.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Moon, Send, Sun } from "lucide-react";
import { useLang } from "@/components/shared/Language";
import { useTheme } from "@/components/shared/Theme";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { LANGS as LANG_LABELS } from "@/lib/navbar";
import { LANGS, type Lang } from "@/lib/i18n";
import { CV_INSTAGRAM, CV_MAIN_PHONE, CV_TEACHING_ROLES } from "@/constants/managementCv";
import { EMPTY_VALUES, useCvApplyForm, type ApplyBranch, type TextKey, type Values } from "@/components/management/cvApplyForm";
import CvApplySection, { APPLY_STEPS, showProblems, stepProblems, useBirthInput } from "./CvApplyFields";

// YANGI VERSIYA — OMMAVIY ISH ANKETASI /ariza (rasm «Ochiq anketa (#ariza) · Kompyuter», yorug'/
// qorong'i, 25.10.2026, 13-qism):
//   • tepada oq chiziq: «A» belgisi, «Akademiya o'quv markazi / Ishga qabul anketasi» (o'ngda til
//     va tungi rejim — eski sahifadagidek);
//   • «O'qituvchilikka ariza» (vakansiyaga qarab), «4 bo'lim, taxminan 5 daqiqa. Javoblaringizni
//     faqat markaz rahbariyati ko'radi.»; bosqich chizig'i (o'tgani ✓, joriysi halqa);
//   • oq karta — «2. Ma'lumot va tajriba», «Ixtiyoriy savollar alohida belgilangan, qolganlari
//     majburiy»; pastda «← Orqaga» · «2 / 4 bo'lim» · «Keyingisi →» (oxirgisida «Arizani yuborish»).
// Eski sahifadan saqlangan: qoralama (localStorage — matn, rasm, fanlar, bosqich), tuzoq maydoni,
// Google Sheets (`#s=BASE64(url)` havola), yuborilgach ariza raqami ekrani. Eski ko'rinish —
// /ariza?classic=1 (app/ariza/page.tsx).

const DRAFT_KEY = "akademiya_ariza_draft";
const ID = "ar-";

/** Havola ichidagi Google Sheets manzili: /ariza#s=BASE64(url) (eski CvApplyPage bilan bir xil). */
function readSheetsUrlFromHash(): string {
  if (typeof window === "undefined") return "";
  const h = window.location.hash || "";
  if (!h.startsWith("#s=")) return "";
  try {
    const u = atob(decodeURIComponent(h.slice(3)));
    return /^https?:\/\//.test(u) ? u : "";
  } catch {
    return "";
  }
}

interface Draft extends Partial<Values> {
  consent?: boolean;
  _rasm?: string;
  _step?: number;
  _subjects?: string[];
  _ageGroups?: string[];
}

export default function CvApplyPageV2({ branches }: { branches: ApplyBranch[] }) {
  const [lang, setLang] = useLang();
  const [isDark, toggleTheme] = useTheme();
  const [website, setWebsite] = useState(""); // tuzoq maydoni — odam ko'rmaydi
  const [sheetsUrl] = useState(readSheetsUrlFromHash);
  const [step, setStep] = useState(1);
  const [reached, setReached] = useState(1);
  const [draftRestored, setDraftRestored] = useState(false);
  const [done, setDone] = useState<{ ref: string; tel: string; files: string } | null>(null);

  const form = useCvApplyForm({ branches, photoRequired: true, consentRequired: true, sheetsUrl, honeypot: website, idPrefix: ID, multiSubject: true });
  const { t, v, setV, setPhoto, setConsent, setSubjects, setAgeGroups } = form;
  const birth = useBirthInput(form);
  const { sync: syncBirth } = birth;
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- qoralama: tiklash (gidratatsiyadan keyin, bir tik kechikib) ---- */
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const d = JSON.parse(raw) as Draft;
        const next: Values = { ...EMPTY_VALUES };
        let any = false;
        for (const k of Object.keys(EMPTY_VALUES) as TextKey[]) {
          if (typeof d[k] === "string" && d[k]) {
            next[k] = d[k] as string;
            any = true;
          }
        }
        // Eski anketa qoralamasi: telefon «+998 (94) …», oylik «4 000 000» — raqamlarga.
        next.phone = next.phone.replace(/\D/g, "");
        next.salary = next.salary.replace(/\D/g, "");
        if (d._rasm) {
          setPhoto(d._rasm);
          any = true;
        }
        if (Array.isArray(d._subjects) && d._subjects.length) setSubjects(d._subjects.filter((x) => typeof x === "string"));
        if (Array.isArray(d._ageGroups) && d._ageGroups.length) setAgeGroups(d._ageGroups.filter((x) => typeof x === "string"));
        if (!any) return;
        setV(next);
        syncBirth(next.birth);
        if (d.consent) setConsent(true);
        const s = Number(d._step);
        if (Number.isInteger(s) && s >= 1 && s <= 4) {
          setStep(s);
          setReached(s);
        }
        setDraftRestored(true);
      } catch {
        // buzilgan qoralama — e'tibor bermaymiz
      }
    }, 0);
    return () => clearTimeout(id);
  }, [setV, setPhoto, setConsent, setSubjects, setAgeGroups, syncBirth]);

  /* ---- qoralama: saqlash ---- */
  const { consent, photo, subjects, ageGroups } = form;
  useEffect(() => {
    if (done) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const base = { ...v, consent, _step: step, _subjects: subjects, _ageGroups: ageGroups };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...base, _rasm: photo }));
      } catch {
        // joy yetmasa (rasm katta) — rasmsiz
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(base));
        } catch {
          /* localStorage o'chirilgan */
        }
      }
    }, 400);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [v, consent, photo, subjects, ageGroups, step, done]);

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* — */
    }
    form.reset();
    birth.sync("");
    setStep(1);
    setReached(1);
    setDraftRestored(false);
  }

  const goTo = (n: number) => {
    setStep(n);
    setReached((r) => Math.max(r, n));
    form.setBad(new Set());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function next(e?: FormEvent) {
    e?.preventDefault();
    if (form.sending) return;
    if (!showProblems(form, stepProblems(form, step, "public"), ID)) return;
    if (step < 4) {
      goTo(step + 1);
      return;
    }
    // Oxirgi bo'lim — yuborishdan oldin hamma bo'lim (qoralamadan qaytganda ham) tekshiriladi.
    for (const s of [1, 2, 3]) {
      const p = stepProblems(form, s, "public");
      if (p.length) {
        setStep(s);
        showProblems(form, p, ID);
        return;
      }
    }
    const r = await form.submit();
    if (!r) {
      setTimeout(() => document.getElementById(`${ID}sendErr`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      return;
    }
    if (draftTimer.current) clearTimeout(draftTimer.current);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* — */
    }
    setDone({ ref: r.ref, tel: form.branchTel, files: r.files.join(", ") });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const teaching = CV_TEACHING_ROLES.includes(v.role);
  const title = !v.role ? t("Ishga ariza") : teaching ? t("O'qituvchilikka ariza") : t("{role} lavozimiga ariza", { role: t(v.role) });
  const tel = (s: string) => `tel:${s.replace(/\s/g, "")}`;

  return (
    <div data-ui="v2" className="min-h-dvh bg-v2-bg font-v2 text-v2-body text-v2-text">
      {/* Tepa chiziq */}
      <header className="border-b border-v2-border bg-v2-surface">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand text-[17px] font-bold text-v2-on-brand" aria-hidden>
            A
          </span>
          <div className="min-w-0">
            <div className="truncate text-v2-body font-semibold text-v2-text">{t("Akademiya o'quv markazi")}</div>
            <div className="truncate text-v2-caption font-normal text-v2-text-2">{t("Ishga qabul anketasi")}</div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <div role="group" aria-label={t("Til")} className="flex rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
              {LANGS.map((code: Lang) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`h-7 rounded-[6px] px-2 text-v2-caption font-medium transition-colors ${lang === code ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2 hover:text-v2-text"}`}
                >
                  {LANG_LABELS[code].code}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? t("Kunduzgi rejim") : t("Tungi rejim")}
              title={isDark ? t("Kunduzgi rejim") : t("Tungi rejim")}
              className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
            >
              {isDark ? <Sun className="size-4" strokeWidth={1.75} /> : <Moon className="size-4" strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[640px] px-4 pb-14 pt-8 sm:pt-12">
        {done ? (
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface px-5 py-8 text-center shadow-v2-sm sm:px-8">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-v2-success-bg text-v2-success" aria-hidden>
              <Check className="size-7" strokeWidth={2.5} />
            </span>
            <h1 className="mt-4 text-[24px] font-semibold leading-8 text-v2-text">{t("Ariza yuborildi")}</h1>
            <p className="mt-1 text-v2-small text-v2-text-2">{t("Ariza raqamingiz — saqlab qo'ying:")}</p>
            <div className="mx-auto mt-2 inline-block rounded-v2-md border border-v2-border bg-v2-surface-2 px-4 py-2 font-mono text-[20px] font-semibold tracking-wider text-v2-text">{done.ref}</div>
            {done.files && <p className="mt-4 text-v2-small text-v2-text-2">{t("Qabul qilingan fayllar: {files}.", { files: done.files })}</p>}
            <p className="mt-2 text-v2-body text-v2-text">{t("Rahmat! Arizangiz ta'lim bo'limiga tushdi. 7 ish kuni ichida telefon orqali bog'lanamiz.")}</p>
            <p className="mt-2 text-v2-small text-v2-text-2">
              {t("Shoshilinch savol bo'lsa filialga o'zingiz qo'ng'iroq qilishingiz mumkin:")}{" "}
              <a href={tel(done.tel)} className="font-medium text-v2-brand-text hover:underline">
                {done.tel}
              </a>
            </p>
            <button type="button" onClick={() => window.location.reload()} className={`${secondaryBtn} mt-6`}>
              {t("Yangi ariza to'ldirish")}
            </button>
          </section>
        ) : (
          <>
            <h1 className="text-[26px] font-semibold leading-8 text-v2-text">{title}</h1>
            <p className="mt-1.5 text-v2-body text-v2-text-2">{t("4 bo'lim, taxminan 5 daqiqa. Javoblaringizni faqat markaz rahbariyati ko'radi.")}</p>

            {draftRestored && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-v2-md bg-v2-info-bg px-3.5 py-2.5 text-v2-small text-v2-text">
                <span>{t("Oldingi qoralama tiklandi.")}</span>
                <button type="button" onClick={clearDraft} className="shrink-0 font-medium text-v2-info hover:underline">
                  {t("Tozalash")}
                </button>
              </div>
            )}

            {/* Bosqich chizig'i */}
            <ol className="mt-6 flex items-center gap-2" aria-label={t("Bo'limlar")}>
              {APPLY_STEPS.map((label, i) => {
                const n = i + 1;
                // O'tilgan bo'lim (orqaga qaytilganda keyingilari ham) — ✓; eng uzoq ochilgani — raqam.
                const isDone = n !== step && n < Math.max(step, reached);
                const current = n === step;
                const canGo = n <= reached && n !== step;
                return (
                  <li key={label} className={`flex min-w-0 items-center gap-2 ${n < APPLY_STEPS.length ? "flex-auto" : "shrink-0"}`} aria-current={current ? "step" : undefined}>
                    <button
                      type="button"
                      disabled={!canGo}
                      onClick={() => goTo(n)}
                      className="flex shrink-0 items-center gap-2 rounded-v2-md text-left focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-default"
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-v2-caption font-semibold tabular-nums ${
                          isDone ? "bg-v2-brand text-v2-on-brand" : current ? "border-2 border-v2-brand text-v2-brand-text" : "border border-v2-border-strong text-v2-text-3"
                        }`}
                      >
                        {isDone ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : n}
                      </span>
                      <span className={`whitespace-nowrap text-v2-small ${current ? "font-semibold text-v2-text" : isDone ? "font-medium text-v2-text" : "text-v2-text-3"} ${current ? "" : "max-sm:hidden"}`}>{t(label)}</span>
                    </button>
                    {n < APPLY_STEPS.length && <span aria-hidden className={`h-px min-w-3 flex-1 ${n < step ? "bg-v2-brand" : "bg-v2-border-strong"}`} />}
                  </li>
                );
              })}
            </ol>

            <form onSubmit={(e) => void next(e)} noValidate className="mt-5">
              <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm sm:p-6" aria-labelledby={`${ID}stepTitle`}>
                <h2 id={`${ID}stepTitle`} className="text-v2-section text-v2-text">
                  {step}. {t(APPLY_STEPS[step - 1])}
                </h2>
                <p className="mb-5 mt-0.5 text-v2-small text-v2-text-2">{t("Ixtiyoriy savollar alohida belgilangan, qolganlari majburiy")}</p>
                <CvApplySection form={form} step={step} mode="public" birth={birth} idPrefix={ID} honeypot={{ value: website, onChange: setWebsite }} />
                {step === 4 && form.sendErr && (
                  <p id={`${ID}sendErr`} role="alert" className="mt-4 rounded-v2-md bg-v2-danger-bg px-3.5 py-3 text-v2-small text-v2-danger">
                    {form.sendErr}
                  </p>
                )}
              </section>

              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div>
                  {step > 1 && (
                    <button type="button" onClick={() => goTo(step - 1)} disabled={form.sending} className={`${secondaryBtn} h-10`}>
                      <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
                      {t("Orqaga")}
                    </button>
                  )}
                </div>
                <span className="text-v2-small tabular-nums text-v2-text-2">{t("{n} / 4 bo'lim", { n: step })}</span>
                <div className="flex justify-end">
                  <button type="submit" disabled={form.sending} className={`${primaryBtn} h-10 disabled:opacity-60`}>
                    {step < 4 ? (
                      <>
                        {t("Keyingisi")}
                        <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                      </>
                    ) : form.sending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        {t("Yuborilmoqda...")}
                      </>
                    ) : (
                      <>
                        <Send className="size-4" strokeWidth={1.75} aria-hidden />
                        {t("Arizani yuborish")}
                      </>
                    )}
                  </button>
                </div>
              </div>
              {step === 4 && <p className="mt-3 text-center text-v2-caption font-normal text-v2-text-3">{t("Yuborganingizdan so'ng ariza raqamingiz chiqadi — uni saqlab qo'ying.")}</p>}
            </form>
          </>
        )}

        <p className="mt-10 text-center text-v2-caption font-normal text-v2-text-3">
          {t("Savollar bo'lsa:")}{" "}
          <a href={tel(CV_MAIN_PHONE)} className="text-v2-text-2 hover:underline">
            {CV_MAIN_PHONE}
          </a>{" "}
          · Instagram{" "}
          <a href="https://instagram.com/akademiya.rasmiy" target="_blank" rel="noopener" className="text-v2-text-2 hover:underline">
            {CV_INSTAGRAM}
          </a>
        </p>
      </main>
    </div>
  );
}
