"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AtSign, Check, Lock, Printer, ReceiptText, RefreshCw, Send, SquareArrowOutUpRight } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import EmployeeToggle from "@/components/employees/EmployeeToggle";
import { printReceipt } from "@/components/finance/cashReceipt";
import { setReceiptContext } from "@/components/finance/receiptContext";
import { Field, FieldLabel, TextInput } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { CENTER_INSTAGRAM_HANDLE, CENTER_LOGO, CENTER_NAME, CENTER_PHONE, CENTER_SHORT } from "@/lib/center";
import {
  RECEIPT_DEFAULTS,
  RECEIPT_FOOTER_MAX,
  RECEIPT_HAS_LOGO,
  RECEIPT_TITLE_MAX,
  type ReceiptBranch,
  type ReceiptProfile,
} from "@/lib/receiptProfile";
import type { TransactionEntry } from "@/lib/transactionEntries";

// YANGI VERSIYA — «SOZLAMALAR → MARKAZ MA'LUMOTLARI» (23-qism, rasmlar «Sozlamalar ·
// Markaz ma'lumotlari», yorug'/qorong'i, 13.11.2026).
//
// • «Asosiy» — markaz nomi, logotip, Instagram, SMS imzosi. Ular SERVER SOZLAMASIDA
//   (lib/center.ts, har markazning .env.local — build paytida koddagi qiymatga
//   aylanadi; ariza, so'rovnoma, hisobotlar, bot ham shundan). Shuning uchun bu yerda
//   faqat ko'rsatiladi (qulf) — bazaga ko'chirish SAVOLLAR'da.
// • «Chek» — TAHRIRLANADI va haqiqiy kassa chekiga ulangan: logotip, sarlavha, pastki
//   matn (GET/PUT /api/center-profile; components/finance/cashReceipt.tsx). Manzil va
//   telefon — joriy filialdan (Sozlamalar → Filiallar). Faqat rahbar saqlaydi.
// • O'ngda «Chek namunasi» — haqiqiy chek qatorlari bilan, forma o'zgarishi darhol
//   ko'rinadi; «Sinab chop etish» — shu namunani (saqlanmagan qiymatlar bilan) bosadi.

const SAMPLE_AMOUNT = 250_000;

/** Namuna yozuv — hozirgi sana/vaqt (Toshkent), faqat mijozda (yuklangach) yasaladi. */
function sampleEntry(): TransactionEntry {
  const now = new Date();
  const tz = "Asia/Tashkent";
  return {
    id: 412,
    date: new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now),
    time: new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now),
    studentName: "Aliyeva Malika",
    amount: SAMPLE_AMOUNT,
    before: 0,
    after: SAMPLE_AMOUNT,
    txType: "payIn",
    txName: "O'quvchi to'lovi",
    paymentType: "Naqd",
    group: "",
    lessonDate: "",
    moderator: "",
    reason: "",
    note: "",
    status: "",
    cashboxId: 0,
  } as TransactionEntry;
}

function fmtSom(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;
}

/** Qulflangan (o'zgartirib bo'lmaydigan) qiymat — rasmdagi uzuq chegarali maydon. */
function LockedValue({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-v2-md border border-dashed border-v2-border-strong bg-v2-surface-2 px-3 py-2 text-v2-body text-v2-text-2">
      <Lock className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {action}
    </div>
  );
}

/** «Asosiy» kartasidagi faqat-o'qish maydoni (ikonka bilan). */
function ReadOnlyInput({ icon, value, empty }: { icon?: ReactNode; value: string; empty: string }) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 text-v2-body">
      {icon}
      <span className={`min-w-0 flex-1 truncate ${value ? "text-v2-text" : "text-v2-text-3"}`}>{value || empty}</span>
      <Lock className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
    </div>
  );
}

export default function CenterInfoV2() {
  const { t } = useT();
  const { showSuccess } = useToast();
  const [loaded, setLoaded] = useState<{ receipt: ReceiptProfile; branch: ReceiptBranch | null; canEdit: boolean; entry: TransactionEntry } | null>(null);
  const [form, setForm] = useState<ReceiptProfile>(RECEIPT_DEFAULTS);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/center-profile")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d?.ok) {
          setErr(d?.error || "Yuklanmadi");
          return;
        }
        setErr(null);
        setLoaded({ receipt: d.receipt, branch: d.branch ?? null, canEdit: !!d.canEdit, entry: sampleEntry() });
        setForm(d.receipt);
      })
      .catch(() => {
        if (!cancelled) setErr("Serverga ulanib bo'lmadi");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const canEdit = !!loaded?.canEdit;
  const dirty = !!loaded && JSON.stringify(form) !== JSON.stringify(loaded.receipt);
  const titleErr = !form.title.trim() ? t("Chek sarlavhasini kiriting") : null;
  const set = <K extends keyof ReceiptProfile>(k: K, v: ReceiptProfile[K]) => setForm((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!loaded || titleErr) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const d = await fetch("/api/center-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt: form }),
      }).then((r) => r.json());
      if (!d?.ok) {
        setSaveErr(t(d?.error || "Saqlanmadi"));
        return;
      }
      setLoaded({ ...loaded, receipt: d.receipt });
      setForm(d.receipt);
      // Shu oynadagi keyingi cheklar darhol yangi ko'rinishda chiqsin.
      setReceiptContext({ receipt: d.receipt, branch: loaded.branch });
      showSuccess(t("Saqlandi"));
    } catch {
      setSaveErr(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  const branch = loaded?.branch ?? null;
  const logoName = CENTER_LOGO ? CENTER_LOGO.split("/").pop() || CENTER_LOGO : "";
  const smsSignature = `${CENTER_SHORT} · ${t("Murojaat")}: ${CENTER_PHONE.replace(/\s/g, "")}`;
  const entry = loaded?.entry ?? null;
  const [y, m, d] = (entry?.date ?? "").split("-");
  const card = "rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5";

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      <div className="min-w-0 max-w-[44rem]">
        <div className="text-v2-caption text-v2-text-2">{t("Umumiy")}</div>
        <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Markaz ma'lumotlari")}</h1>
        <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Nom, logotip va aloqa. Chek, SMS imzosi va anketa sahifasida shu ma'lumot chiqadi.")}</p>
      </div>

      {err ? (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6">
          <p className="text-v2-body text-v2-text-2">{t(err)}</p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className={`${secondaryBtn} mt-3`}>
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Qayta urinish")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 min-[72rem]:grid-cols-[minmax(0,1fr)_17.5rem]">
          {/* ── Chap: formalar ── */}
          <div className="flex min-w-0 flex-col gap-4">
            <section className={card}>
              <h2 className="text-v2-section text-v2-text">{t("Asosiy")}</h2>
              <div className="mt-4 space-y-4">
                <Field label={t("Markaz nomi")}>
                  <ReadOnlyInput value={CENTER_NAME} empty="—" />
                </Field>
                <div>
                  <FieldLabel>{t("Logotip")}</FieldLabel>
                  <div className="flex items-center gap-3">
                    {CENTER_LOGO ? (
                      // Logotip /sorovnoma'niki — OQ, rangli fon uchun: v2 «logotip» plashkasida
                      // (components/imtihon/PublicResultsPage.tsx kabi).
                      <span className="inline-flex h-14 shrink-0 items-center rounded-v2-md bg-v2-logo px-3">
                        {/* eslint-disable-next-line @next/next/no-img-element -- markaz logotipi, oddiy rasm */}
                        <img src={CENTER_LOGO} alt="" className="h-7 w-auto max-w-[10rem] object-contain" />
                      </span>
                    ) : (
                      <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand text-[22px] font-semibold text-v2-on-brand">
                        {CENTER_NAME.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-v2-body font-medium text-v2-text">{logoName || t("Logotip yo'q")}</div>
                      <div className="text-v2-caption text-v2-text-2">{t("So'rovnoma, natijalar sahifasi va chekda")}</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("Instagram")}>
                    <ReadOnlyInput icon={<AtSign className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />} value={CENTER_INSTAGRAM_HANDLE} empty={t("Kiritilmagan")} />
                  </Field>
                  <Field label={t("Telegram kanal")} optional>
                    <ReadOnlyInput icon={<Send className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />} value="" empty={t("Kiritilmagan")} />
                  </Field>
                </div>
                <Field label={t("SMS imzosi")} hint={t("To'lov SMS'i oxirida turadi. Shablon Eskiz'da tasdiqlangan — o'zgartirish uchun shablonni qayta tasdiqlatish kerak.")}>
                  <LockedValue>{smsSignature}</LockedValue>
                </Field>
                <p className="rounded-v2-md bg-v2-surface-2 px-3 py-2 text-v2-caption text-v2-text-2">
                  {t("Markaz nomi, logotip va Instagram server sozlamasida — ariza, so'rovnoma, hisobotlar va bot ham shundan oladi. O'zgartirish uchun Tizimli yordamiga yozing.")}
                </p>
              </div>
            </section>

            <section className={card}>
              <h2 className="flex items-center gap-2 text-v2-section text-v2-text">
                <ReceiptText className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                {t("Chek")}
              </h2>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-v2-md bg-v2-surface-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-v2-body font-medium text-v2-text">{t("Chekda logotip")}</div>
                    <div className="text-v2-caption text-v2-text-2">{RECEIPT_HAS_LOGO ? t("Yuqorida, markaz nomi ustida") : t("Markaz logotipi kiritilmagan")}</div>
                  </div>
                  <EmployeeToggle
                    checked={form.showLogo}
                    disabled={!canEdit || !RECEIPT_HAS_LOGO || saving}
                    title={t("Chekda logotip")}
                    onChange={(on) => set("showLogo", on)}
                  />
                </div>
                <Field label={t("Sarlavha")} htmlFor="rc-title" error={loaded && titleErr ? titleErr : null}>
                  <TextInput
                    id="rc-title"
                    value={form.title}
                    maxLength={RECEIPT_TITLE_MAX}
                    disabled={!canEdit}
                    onChange={(e) => set("title", e.target.value)}
                    state={loaded && titleErr ? "error" : "default"}
                  />
                </Field>
                <Field label={t("Manzil va telefon")} hint={t("Har filialda o'z manzili va telefoni chiqadi.")}>
                  <LockedValue
                    action={
                      <Link href="/management-filiallar" className="shrink-0 text-v2-small font-semibold text-v2-brand-text hover:underline">
                        {t("Filiallar")}
                      </Link>
                    }
                  >
                    {t("Joriy filialdan")}
                    {branch && [branch.address, branch.phone].filter(Boolean).length > 0
                      ? ` · ${[branch.address, branch.phone].filter(Boolean).join(" · ")}`
                      : ` · ${t("manzil kiritilmagan")}`}
                  </LockedValue>
                </Field>
                <Field label={t("Pastki matn")} htmlFor="rc-foot">
                  <TextInput id="rc-foot" value={form.footer} maxLength={RECEIPT_FOOTER_MAX} disabled={!canEdit} onChange={(e) => set("footer", e.target.value)} />
                </Field>
              </div>
            </section>

            {loaded && !canEdit && <p className="text-v2-small text-v2-text-2">{t("Chek sozlamasini faqat rahbar o'zgartiradi.")}</p>}
            {saveErr && <p className="text-v2-small text-v2-danger">{saveErr}</p>}
            {canEdit && (
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => loaded && setForm(loaded.receipt)} disabled={!dirty || saving} className={`${secondaryBtn} disabled:opacity-50`}>
                  {t("Bekor qilish")}
                </button>
                <button type="button" onClick={() => void save()} disabled={!dirty || saving || !!titleErr} className={`${primaryBtn} disabled:opacity-50`}>
                  <Check className="size-4" strokeWidth={2} aria-hidden />
                  {saving ? t("Saqlanmoqda...") : t("Saqlash")}
                </button>
              </div>
            )}
            <Link
              href="/settings-general?tab=general"
              className="inline-flex items-center gap-1.5 self-start text-v2-small text-v2-text-2 underline-offset-2 hover:text-v2-text hover:underline"
            >
              <SquareArrowOutUpRight className="size-3.5" strokeWidth={1.75} aria-hidden />
              {t("Funksionallik, bayram kunlari, oferta va boshqa umumiy sozlamalar — eski ko'rinishda")}
            </Link>
          </div>

          {/* ── O'ng: chek namunasi ── */}
          <aside className="flex flex-col gap-3 min-[72rem]:sticky min-[72rem]:top-4">
            <div className="flex items-center justify-between">
              <span className="text-v2-small text-v2-text-2">{t("Chek namunasi")}</span>
              <span className="rounded-v2-sm border border-dashed border-v2-warning px-1.5 py-px text-v2-caption text-v2-warning">{t("Namuna")}</span>
            </div>
            <div className="rounded-v2-lg border border-v2-border bg-v2-surface-2 p-4">
              {/* Chek har doim oq qog'ozda (bosma kabi) — tungi rejimda ham. */}
              <div className="mx-auto w-full max-w-[15rem] rounded-[4px] bg-white px-4 py-4 text-[12px] leading-[1.45] text-[#0f172a] shadow-v2-md">
                {form.showLogo && CENTER_LOGO && (
                  // Chekda logotip QORA (oq logotip oq qog'ozda ko'rinmaydi) — cashReceipt.tsx `.logo` kabi.
                  // eslint-disable-next-line @next/next/no-img-element -- chek namunasi
                  <img src={CENTER_LOGO} alt="" className="mx-auto mb-1.5 h-8 w-auto max-w-[70%] object-contain brightness-0" />
                )}
                <div className="text-center text-[13px] font-bold">{form.title || "—"}</div>
                {branch &&
                  [branch.address, branch.phone].filter(Boolean).map((l) => (
                    <div key={l} className="text-center text-[11px] text-[#64748b]">
                      {l}
                    </div>
                  ))}
                <div className="mt-2 text-center text-[12px] font-bold tracking-wide">{t("KIRIM CHEKI")}</div>
                <div className="my-2 border-t border-dashed border-[#cbd5e1]" />
                {entry ? (
                  [
                    [t("Chek №"), String(entry.id)],
                    [t("Sana"), `${d}.${m}.${y} | ${entry.time}`],
                    [t("O'quvchi"), entry.studentName],
                    [t("Kassa"), t("Asosiy kassa")],
                    [t("Tranzaksiya"), t(entry.txName)],
                    [t("To'lov turi"), t(entry.paymentType)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 py-px">
                    <span className="text-[#64748b]">{k}</span>
                    <span className="text-right font-medium">{v}</span>
                  </div>
                )) : (
                  <div className="space-y-2 py-1" aria-hidden>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-3 animate-pulse rounded bg-[#eceff2]" />
                    ))}
                  </div>
                )}
                <div className="my-2 border-t border-dashed border-[#cbd5e1]" />
                <div className="flex items-baseline justify-between">
                  <span className="italic text-[#64748b]">{t("Jami")}</span>
                  <span className="text-[15px] font-bold tabular-nums">{t(fmtSom(SAMPLE_AMOUNT))}</span>
                </div>
                {form.footer && (
                  <>
                    <div className="my-2 border-t border-dashed border-[#cbd5e1]" />
                    <div className="text-center text-[11px] italic text-[#64748b]">{form.footer}</div>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => entry && printReceipt(entry, t("Asosiy kassa"), { receipt: form, branch })}
              disabled={!entry}
              className={`${secondaryBtn} w-full justify-center disabled:opacity-50`}
            >
              <Printer className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Sinab chop etish")}
            </button>
            <p className="text-v2-caption text-v2-text-2">
              {t("Har to'lovdan keyin «Chek chiqarish» tugmasi shu ko'rinishda chop etadi. Saqlanmagan o'zgarishlar ham sinovda ko'rinadi.")}
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
