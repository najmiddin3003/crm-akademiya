"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Pencil, Plus, RefreshCw, Search, Tags, Trash2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { Badge, SegmentPills, fmtNum } from "@/components/v2/students/lists/listKit";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { MAIN_TYPES } from "@/constants/transactionTypes";
import { invalidateTransactionTypes } from "@/hooks/useTransactionTypes";
import type { TransactionType } from "@/lib/transactionTypes";
import TransactionTypeDialogV2 from "./TransactionTypeDialogV2";

// YANGI VERSIYA — SOZLAMALAR → MOLIYA → «KIRIM-CHIQIM TOIFALARI» (/finance-tx-types, rasmsiz —
// Sozlamalar ramkasidagi boshqa ro'yxatlar qolipida, 20.11.2026). Eski versiyada — Moliya →
// Tranzaksiya turi (components/finance/TransactionTypesPage.tsx), o'zgarmagan.
//
// Ma'lumot eski sahifa bilan BITTA: GET /api/transaction-types, DELETE /api/transaction-types/:id
// (+ `invalidateTransactionTypes()`). Bo'limlar (Kirim / Chiqim / Vaucher / Jarima) — tabletkalar,
// soni bilan. Qo'shish/tahrirlash eski versiyada alohida sahifa edi — bu yerda oyna
// (./TransactionTypeDialogV2, so'rov va tekshiruv o'sha). Jadvalda eski ro'yxatda
// ko'rinmagan, lekin turda saqlangan «Mijoz» va miqdor chegarasi ham ko'rsatiladi.

const TH = "sticky top-0 z-[1] whitespace-nowrap bg-v2-surface-2 px-4 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
const TD = "border-t border-v2-border px-4 py-3 align-middle";
const ICON_BTN =
  "inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";

function txtCustomers(tv: TransactionType): string[] {
  return Array.isArray(tv.customerType) ? tv.customerType : tv.customerType ? [tv.customerType] : [];
}

/** Miqdor chegarasi: 0 — chegarasiz. */
function txtLimit(tv: TransactionType): string {
  const min = Number(tv.minAmount) || 0;
  const max = Number(tv.maxAmount) || 0;
  if (min > 0 && max > 0) return `${fmtNum(min)} – ${fmtNum(max)}`;
  if (min > 0) return `≥ ${fmtNum(min)}`;
  if (max > 0) return `≤ ${fmtNum(max)}`;
  return "—";
}

export default function TransactionTypesV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [types, setTypes] = useState<TransactionType[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<string>(MAIN_TYPES[0].key);
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ type: TransactionType | null } | null>(null);
  const [delTarget, setDelTarget] = useState<TransactionType | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Ikki marta bosilsa ikkinchi DELETE ketmasin (eski oynada tugma o'chiq turardi).
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/transaction-types")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) {
          setTypes(d.types);
          setFailed(false);
        } else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = () => setVersion((v) => v + 1);
  const all = useMemo(() => types ?? [], [types]);
  const count = (key: string) => all.filter((tv) => tv.mainType === key).length;
  const needle = q.trim().toLowerCase();
  const visible = useMemo(() => all.filter((tv) => tv.mainType === tab && (!needle || tv.name.toLowerCase().includes(needle))), [all, tab, needle]);
  const tabLabel = t(MAIN_TYPES.find((m) => m.key === tab)?.label ?? tab);

  async function confirmDelete() {
    if (!delTarget || busyRef.current) return;
    const tv = delTarget;
    busyRef.current = true;
    setDeleting(true);
    try {
      const res = await fetch(`/api/transaction-types/${tv.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        return;
      }
      invalidateTransactionTypes();
      setTypes((prev) => (prev ? prev.filter((x) => x.id !== tv.id) : prev));
      showSuccess(t("Tranzaksiya turi o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      busyRef.current = false;
      setDeleting(false);
      setDelTarget(null);
    }
  }

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[40rem]">
          <div className="text-v2-caption text-v2-text-2">{t("Moliya")}</div>
          <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Kirim-chiqim toifalari")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {t("Kassa amalidagi «Tranzaksiya turi» ro'yxati. «Mijoz» belgisi kassa oynasida kimni tanlash so'ralishini hal qiladi.")}
          </p>
        </div>
        <button type="button" onClick={() => setDialog({ type: null })} disabled={!types} className={`${primaryBtn} disabled:opacity-60`}>
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {t("Toifa qo'shish")}
        </button>
      </div>

      {failed && !types ? (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6">
          <p className="text-v2-body text-v2-text-2">{t("Ma'lumotni yuklab bo'lmadi")}</p>
          <button type="button" onClick={reload} className={`${secondaryBtn} mt-3`}>
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Qayta urinish")}
          </button>
        </div>
      ) : (
        <>
          {/* 2. Bo'limlar + qidiruv */}
          <div className="flex flex-wrap items-center gap-2">
            <SegmentPills items={MAIN_TYPES.map((m) => ({ key: m.key, label: t(m.label), count: count(m.key) }))} value={tab} onChange={setTab} />
            <div className="relative ml-auto w-full sm:w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                placeholder={t("Toifa nomi")}
                aria-label={t("Toifa nomi")}
                className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
              />
            </div>
          </div>

          {/* 3. Jadval */}
          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-v2-body">
                <thead>
                  <tr>
                    <th className={TH}>{t("Nomi")}</th>
                    <th className={TH}>{t("Mijoz")}</th>
                    <th className={TH}>{t("Miqdor chegarasi")}</th>
                    <th className={TH}>{t("Kategoriyasi")}</th>
                    <th className={`${TH} w-24`}>
                      <span className="sr-only">{t("Amallar")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!types &&
                    Array.from({ length: 6 }, (_, i) => (
                      <tr key={`sk${i}`} aria-hidden>
                        <td className={TD}><div className="h-3 w-40 rounded bg-v2-skeleton" /></td>
                        <td className={TD}><div className="h-5 w-28 rounded bg-v2-skeleton" /></td>
                        <td className={TD}><div className="h-3 w-20 rounded bg-v2-skeleton" /></td>
                        <td className={TD}><div className="h-5 w-16 rounded-v2-full bg-v2-skeleton" /></td>
                        <td className={TD} />
                      </tr>
                    ))}
                  {types && visible.length === 0 && (
                    <tr>
                      <td colSpan={5} className="border-t border-v2-border p-5">
                        <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                          <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                            <Tags className="size-5" strokeWidth={1.75} aria-hidden />
                          </span>
                          <div className="text-v2-section text-v2-text">{needle ? t("Topilmadi") : t("«{name}» bo'limida hali toifa yo'q", { name: tabLabel })}</div>
                          {!needle && (
                            <button type="button" onClick={() => setDialog({ type: null })} className={`${primaryBtn} mt-2`}>
                              <Plus className="size-4" strokeWidth={2} aria-hidden />
                              {t("Toifa qo'shish")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {visible.map((tv) => {
                    const customers = txtCustomers(tv);
                    const expense = tv.category === "Chiqim";
                    return (
                      <tr key={tv.id} className={ROW_TINT.hover}>
                        <td className={TD}>
                          <button
                            type="button"
                            onClick={() => setDialog({ type: tv })}
                            className="text-left font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus"
                          >
                            {tv.name}
                          </button>
                        </td>
                        <td className={TD}>
                          {customers.length === 0 ? (
                            <span className="text-v2-text-3">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {customers.map((c) => (
                                <span key={c} className="inline-flex items-center rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1.5 py-0.5 text-v2-caption text-v2-text-2">
                                  {t(c)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className={`${TD} whitespace-nowrap tabular-nums text-v2-text-2`}>{txtLimit(tv)}</td>
                        <td className={TD}>
                          {tv.category ? <Badge tone={expense ? "danger" : "success"}>{t(tv.category)}</Badge> : <span className="text-v2-text-3">—</span>}
                        </td>
                        <td className={TD}>
                          <div className="flex items-center justify-end gap-0.5">
                            <button type="button" onClick={() => setDialog({ type: tv })} title={t("Tahrirlash")} aria-label={`${tv.name} — ${t("Tahrirlash")}`} className={ICON_BTN}>
                              <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDelTarget(tv)}
                              title={t("O'chirish")}
                              aria-label={`${tv.name} — ${t("O'chirish")}`}
                              className={`${ICON_BTN} hover:bg-v2-danger-bg hover:text-v2-danger`}
                            >
                              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Izoh */}
          <div className="space-y-1.5 text-v2-caption text-v2-text-2">
            <p className="flex items-start gap-2">
              <Info className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <span>{t("«Kategoriyasi» — jadvaldagi belgi; toifa qaysi bo'limda chiqishi undan mustaqil (masalan Vaucher bo'limidagi toifa «Kirim» bo'lishi mumkin).")}</span>
            </p>
            <p className="flex items-start gap-2">
              <Info className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <span>{t("Miqdor chegarasi 0 bo'lsa — chegarasiz.")}</span>
            </p>
          </div>
        </>
      )}

      {dialog && <TransactionTypeDialogV2 type={dialog.type} mainType={tab} onClose={() => setDialog(null)} onSaved={reload} />}
      {delTarget && (
        <V2Confirm
          title={t("Toifani o'chirasizmi?")}
          body={t("«{n}» ro'yxatdan olib tashlanadi.", { n: delTarget.name })}
          confirmLabel={deleting ? t("O'chirilmoqda…") : t("O'chirish")}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDelTarget(null)}
        />
      )}
    </div>
  );
}
