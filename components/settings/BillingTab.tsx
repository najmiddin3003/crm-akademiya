"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useStudents } from "@/hooks/useStudents";
import SettingsNote from "./SettingsNote";
import {
  BILLING_CURRENCY,
  BILLING_DEFAULTS,
  BILLING_PLANS,
  BILLING_TABS,
  BILLING_TEXTS,
} from "@/constants/settingsBilling";

// Umumiy sozlamalar → Obuna. Bu tab asosan KO'RSATUV sahifasi: haqiqiy to'lov
// integratsiyasi (Click/Payme va h.k.) ulanmagan, shu bois "To'lash" hech qanday
// tranzaksiya yaratmaydi va buni XATO uslubida aytadi (ilgari yashil
// "muvaffaqiyat" toastida chiqardi).
//
// Saqlanadigan yagona narsa — tanlangan tarif: { plan } → "system.billing".
// O'quvchilar soni saqlanmaydi, u har ochilganda /api/pupils dan sanaladi.

const STORAGE_KEY = "system.billing";

interface Plan {
  key: string;
  months: number;
  bonusMonths: number;
  label: string;
  bonus: string;
  price: number;
}

interface BillingData {
  plan: string;
}

const PLANS = BILLING_PLANS as Plan[];
const TABS = BILLING_TABS as string[];
const DEFAULTS = BILLING_DEFAULTS as BillingData;

// toLocaleString brauzer tiliga qarab uzluksiz probel yoki vergul qo'yadi —
// referensda esa oddiy probel, shuning uchun qo'lda ajratamiz.
function formatSum(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// OBUNA TUGASH SANASI HISOBLANMAYDI — shu bois bu yerda addMonths() yo'q.
// Ilgari u `addMonths(BILLING_TRIAL_UNTIL, months + bonusMonths)` deb
// chaqirilardi, ya'ni sana qo'lda yozib qo'yilgan "09.09.2026" dan
// chiqarilardi. Bazada obuna boshlanish/tugash sanasi umuman saqlanmaydi,
// ya'ni hisobning boshlang'ich nuqtasi yo'q — o'ylab topilgan sanadan
// hisoblangan sana ham xuddi shunday o'ylab topilgan bo'lardi. Endi muddat
// "—" bo'lib turadi (BILLING_TEXTS.untilUnknown).

export default function BillingTab() {
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<BillingData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>(TABS[0]);
  // O'quvchilar sonining YAGONA haqiqiy manbasi — `pupils` kolleksiyasi.
  // Arxivdagilar ham sanaladi: yorliq shunchaki "O'quvchilar soni" deydi,
  // holat bo'yicha filtrlash esa yorliqda aytilmagan da'vo bo'lardi.
  const { pupils, loading: pupilsLoading } = useStudents();
  const studentCount = pupils.length;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings?key=${encodeURIComponent(STORAGE_KEY)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        // Defaultlar ustiga — yangi maydon qo'shilganda eski hujjat buzilmaydi.
        setData({ ...DEFAULTS, ...d.values });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Saqlangan kalit noma'lum bo'lsa (tarif ro'yxati o'zgargan bo'lsa) birinchisi.
  const selected = useMemo(
    () => PLANS.find((p) => p.key === data.plan) ?? PLANS[0],
    [data.plan]
  );

  // Tarif tanlanishi darrov saqlanadi — bu tabda alohida "Saqlash" tugmasi yo'q.
  async function selectPlan(key: string) {
    // Allaqachon tanlangan tarifga qayta bosilsa — keraksiz PUT va toast bo'lmasin.
    if (key === data.plan) return;
    const prev = data;
    const next = { ...data, plan: key };
    setData(next);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: STORAGE_KEY, values: next }),
      });
      const resData = await res.json();
      if (!resData.ok) {
        showError(resData.error || "Saqlanmadi");
        setData(prev); // qaytarib qo'yamiz
        return;
      }
      showSuccess("Sozlamalar saqlandi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setData(prev);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap rounded-2xl bg-card border border-border p-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-8 px-3.5 rounded-lg text-[13px] font-medium transition-colors ${
              tab === t ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab !== TABS[0] ? (
        <div className="rounded-2xl bg-card border border-border p-8 text-center text-sm text-muted-foreground">
          {BILLING_TEXTS.gamificationEmpty}
        </div>
      ) : loading ? (
        <div className="rounded-2xl bg-card border border-border p-8">
          <SpinnerBlock />
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-card border border-border p-5">
            <h3 className="text-[15px] font-semibold">{BILLING_TEXTS.title}</h3>
            <p className="text-[12px] text-muted-foreground mt-1">{BILLING_TEXTS.trialNote}</p>

            <div className="divide-y divide-border mt-2">
              <div className="flex items-center justify-between gap-4 py-3">
                <span className="text-[13px]">{BILLING_TEXTS.studentsLabel}</span>
                {/* Hali sanalmagan bo'lsa raqam ko'rsatilmaydi — o'rniga 0
                    yoki eski nusxa qo'yish soxta son bo'lardi. */}
                <span className="text-[13px] font-medium tabular-nums">
                  {pupilsLoading ? "…" : studentCount}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
            {PLANS.map((p) => {
              const on = p.key === selected.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => selectPlan(p.key)}
                  className={`rounded-2xl border p-5 text-left transition-colors ${
                    on ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[15px] font-semibold">{p.label}</span>
                    {/* Bonus oylar faqat uzoq tariflarda bor. */}
                    {p.bonus && (
                      <span className="text-[12px] font-medium text-primary">{p.bonus}</span>
                    )}
                  </div>
                  <div className="text-[13px] text-muted-foreground mt-2">
                    {formatSum(p.price)} {BILLING_CURRENCY}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{BILLING_TEXTS.summaryTitle}</div>
                  {/* Ilgari bu yerda "09.12.2026 gacha" kabi sana turardi va
                      u qattiq yozilgan sinov sanasidan hisoblanardi. Muddat
                      bazada saqlanmaydi, shuning uchun sana o'rniga "—". */}
                  <div className="text-[12px] text-muted-foreground">
                    {BILLING_TEXTS.untilUnknown}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-medium">
                    {selected.label}
                    {selected.bonus ? ` ${selected.bonus}` : ""}
                  </div>
                  {/* Yagona shablon-satr: JSX matn tugunlariga bo'linganda
                      son bilan matn orasidagi probel yo'qolib qolgan edi.
                      Oldingi "x 2000" ko'rinishi ikki marta yolg'on edi:
                      2000 o'ylab topilgan son edi, "x" esa narx o'quvchi
                      soniga ko'paytiriladi deb da'vo qilardi — aslida tarif
                      narxi qat'iy. Endi son haqiqiy, "x" esa olib tashlandi. */}
                  <div className="text-[12px] text-muted-foreground">
                    {pupilsLoading ? "" : `${studentCount} o'quvchi uchun`}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 py-3">
                <span className="text-[13px]">{BILLING_TEXTS.amountLabel}</span>
                <span className="text-[13px] font-medium">
                  {formatSum(selected.price)} {BILLING_CURRENCY}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4">
              {/* Tugma hech qanday tranzaksiya yaratmaydi — buni tugmani
                  bosishdan OLDIN ham aytamiz, keyin ham (xato toasti). */}
              <SettingsNote>
                To&apos;lov tizimi (Click, Payme va h.k.) bu tizimga ulanmagan &mdash; tugma
                tranzaksiya yaratmaydi. Obunani hozircha markaz administratori orqali
                to&apos;lang.
              </SettingsNote>
              <button
                type="button"
                // showSuccess emas: to'lov amalga oshmayapti, ya'ni bu
                // muvaffaqiyat emas. Ilgari yashil toast chiqib, foydalanuvchi
                // to'lov o'tdi deb o'ylashi mumkin edi.
                onClick={() => showError(BILLING_TEXTS.payNote)}
                className="h-10 px-6 shrink-0 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {BILLING_TEXTS.payButton}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
