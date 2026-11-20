"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Info, ReceiptText, RefreshCw, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useLang, useT } from "@/components/shared/Language";
import { usePersonHref } from "@/components/shared/PersonDirectory";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import { Badge, PageHead, PageShell, SummaryLine, B, fmtNum } from "@/components/v2/students/lists/listKit";
import V2DateRange, { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { TX_TYPE_LABELS } from "@/lib/cashEntriesExport";
import type { CashboxName } from "@/lib/cashboxes";
import type { TransactionEntry } from "@/lib/transactionEntries";

// YANGI VERSIYA — MOLIYA → «TRANZAKSIYALAR» (/finance-transactions, rasmsiz — Kassalar
// sahifasidagi «Tranzaksiyalar» paneli va O'quvchilar ro'yxati qolipida, 20.11.2026).
//
// Sof jurnal (eski sahifadagidek qo'shish/tahrir/o'chirish yo'q). Ma'lumot va filtrlar eski
// sahifa bilan BITTA: /api/cashboxes?names=1, /api/transaction-entries/students,
// /api/transaction-entries?page&limit&cashboxId&txType&status&studentName&dateFrom&dateTo —
// filtrlash ham, sahifalash ham SERVERDA. Eski 15 ustun 11 taga yig'ildi (hech biri tushib
// qolmadi): Summa + To'lov turi, Tranzaksiya turi + nomi, Guruh + Dars sanasi, Sabab + Izoh.
//
// SANA: tanlangan kun MAHALLIY sana bo'yicha yuboriladi (Kassalar paneli bilan bir xil).
// Eski sahifa `toISOString()` ishlatadi — Toshkentda (UTC+5) u bir kun oldingi sanani
// yuboradi (SAVOLLAR — moliya-b).

// Qiymatlar eski sahifadagi bilan bir xil (`?txType=`); yozuvdagi «(payIn)» qo'shimchasisiz —
// Kassalar panelidagi tanlov kabi.
const TX_TYPES = [
  { value: "payIn", label: "Kirim" },
  { value: "payOut", label: "Chiqim" },
  { value: "transfer", label: "Ko'chirish" },
];
const STATUSES = [
  { value: "waiting", label: "Kutilmoqda" },
  { value: "cancelled", label: "Bekor qilingan" },
];

function txeToIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function txeDay(e: TransactionEntry): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.date || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
/** null → «—» (eski sahifadagi fmtUZS bilan bir xil ma'no), manfiy — «−». */
function txeNum(n: number | null | undefined): string {
  return n == null ? "—" : fmtNum(n);
}

/** Ism — profilga havola (katalogda topilsa), aks holda oddiy matn; bo'sh — «—». */
function TxePerson({ name, kind, strong = false }: { name: string; kind?: "staff" | "student"; strong?: boolean }) {
  const text = (name || "").trim();
  const href = usePersonHref(text, kind);
  if (!text) return <span className="text-v2-text-3">—</span>;
  const cls = `block truncate ${strong ? "font-semibold text-v2-text" : "text-v2-text"}`;
  if (!href) return <span className={cls} title={text}>{text}</span>;
  return (
    <Link href={href} title={text} className={`${cls} underline-offset-2 hover:text-v2-brand-text hover:underline`}>
      {text}
    </Link>
  );
}

const TH = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 px-2.5 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
const TD = "px-2.5 py-2.5 align-middle";
const COLS = 11;

export default function TransactionEntriesV2() {
  const { t } = useT();
  const [lang] = useLang();
  const canCash = useCanOpen("/finance-cash");

  const [cashboxes, setCashboxes] = useState<CashboxName[]>([]);
  const [studentOptions, setStudentOptions] = useState<string[]>([]);

  const [cashboxId, setCashboxId] = useState("");
  const [txType, setTxType] = useState("");
  const [status, setStatus] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [student, setStudent] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [entries, setEntries] = useState<TransactionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  // Ekrandagi javob qaysi so'rovniki — `loading` shundan (effektda sinxron setState yo'q).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const seqRef = useRef(0);

  // Kassalar va «O'quvchi» filtri ro'yxati — bir marta (eski sahifa bilan bir xil manba).
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/cashboxes?names=1").then((r) => r.json()),
      fetch("/api/transaction-entries/students").then((r) => r.json()),
    ])
      .then(([cb, st]) => {
        if (cancelled) return;
        if (cb?.ok) setCashboxes(cb.cashboxes);
        if (st?.ok) setStudentOptions(st.students);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const query = useMemo(() => {
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (cashboxId) qs.set("cashboxId", cashboxId);
    if (txType) qs.set("txType", txType);
    if (status) qs.set("status", status);
    if (student) qs.set("studentName", student);
    if (dateRange.start) qs.set("dateFrom", txeToIso(dateRange.start));
    if (dateRange.end) qs.set("dateTo", txeToIso(dateRange.end));
    return qs.toString();
  }, [page, pageSize, cashboxId, txType, status, student, dateRange]);

  const reqKey = `${query}|${retry}`;
  useEffect(() => {
    const seq = ++seqRef.current;
    const key = `${query}|${retry}`;
    fetch(`/api/transaction-entries?${query}`)
      .then((r) => r.json())
      .then((d) => {
        if (seq !== seqRef.current) return;
        if (!d?.ok) throw new Error(d?.error || "yuklab bo'lmadi");
        setEntries(d.entries);
        setTotal(d.total);
        setError(false);
        setLoadedKey(key);
      })
      .catch(() => {
        if (seq !== seqRef.current) return;
        setEntries([]);
        setTotal(0);
        setError(true);
        setLoadedKey(key);
      });
  }, [query, retry]);

  const loading = loadedKey !== reqKey;
  const firstLoad = loadedKey === null;
  const start = (page - 1) * pageSize;
  const nameById = useMemo(() => new Map(cashboxes.map((c) => [c.id, c.name])), [cashboxes]);

  const anyFilter = !!(cashboxId || txType || status || student || dateRange.start);
  const clearAll = () => {
    setCashboxId("");
    setTxType("");
    setStatus("");
    setStudent("");
    setDateRange({ start: null, end: null });
    setPage(1);
  };
  const on = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <PageShell>
      <PageHead
        title={t("Tranzaksiyalar")}
        subtitle={
          <>
            {cashboxId ? nameById.get(Number(cashboxId)) ?? t("Barcha kassalar") : t("Barcha kassalar")} · {t("kassalardagi kirim, chiqim va ko'chirmalar jurnali")}
          </>
        }
      />

      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        {cashboxes.length > 0 && (
          <V2Select variant="chip" label={t("Kassa")} value={cashboxId} onChange={on(setCashboxId)} options={cashboxes.map((c) => ({ value: String(c.id), label: c.name }))} />
        )}
        <V2Select variant="chip" label={t("Turi")} value={txType} onChange={on(setTxType)} options={TX_TYPES} searchable={false} />
        <V2Select variant="chip" label={t("Holati")} value={status} onChange={on(setStatus)} options={STATUSES} searchable={false} />
        <V2Select variant="chip" label={t("O'quvchi")} value={student} onChange={on(setStudent)} options={studentOptions.map((n) => ({ value: n, label: n }))} searchable />
        <V2DateRange value={dateRange} onChange={on(setDateRange)} align="start" />
        {anyFilter && (
          <button type="button" onClick={clearAll} className="inline-flex h-9 items-center gap-1 rounded-v2-md px-2 text-v2-small text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
            <X className="size-3.5" strokeWidth={2} aria-hidden />
            {t("Tozalash")}
          </button>
        )}
      </div>

      <SummaryLine items={[<span key="n">{t("Umumiy soni:")} <B>{firstLoad || error ? "—" : fmtNum(total)}</B></span>]} />

      {/* Jadval */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full min-w-[1240px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${TH} w-14 pl-4`}>№</th>
                <th className={TH}>{t("Sana")}</th>
                <th className={TH}>{t("O'quvchi")}</th>
                <th className={`${TH} text-right`}>{t("Summa, so'm")}</th>
                <th className={`${TH} text-right`}>{t("Oldingi miqdor")}</th>
                <th className={`${TH} text-right`}>{t("Keyingi miqdor")}</th>
                <th className={TH}>{t("Tranzaksiya turi")}</th>
                <th className={TH}>{t("Guruh")}</th>
                <th className={TH}>{t("Moderator")}</th>
                <th className={TH}>{t("Sababi")} · {t("Izoh")}</th>
                <th className={`${TH} pr-4`}>{t("Holati")}</th>
              </tr>
            </thead>
            <tbody className={loading && entries.length > 0 ? "opacity-60 transition-opacity" : ""}>
              {loading && entries.length === 0 &&
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={`sk${i}`} className="h-14 border-b border-v2-border" aria-hidden>
                    <td className={`${TD} pl-4`}><div className="h-3 w-6 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-28 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-36 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="ml-auto h-3 w-20 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="ml-auto h-3 w-16 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="ml-auto h-3 w-16 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-24 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-24 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-24 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-28 rounded bg-v2-skeleton" /></td>
                    <td className={`${TD} pr-4`}><div className="h-3 w-14 rounded bg-v2-skeleton" /></td>
                  </tr>
                ))}

              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={COLS} className="p-5">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <ReceiptText className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {error ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Ma'lumotni yuklab bo'lmadi")}</div>
                          <button type="button" onClick={() => setRetry((n) => n + 1)} className={`${secondaryBtn} mt-2`}>
                            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                            {t("Qayta urinish")}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Tranzaksiya topilmadi")}</div>
                          {anyFilter && (
                            <>
                              <p className="text-v2-small text-v2-text-2">{t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}</p>
                              <button type="button" onClick={clearAll} className={`${secondaryBtn} mt-2`}>
                                {t("Filtrlarni tozalash")}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {entries.map((e, i) => {
                const cancelled = e.status === "cancelled";
                const waiting = e.status === "waiting";
                const dir = e.txType === "transfer" ? "transfer" : e.amount >= 0 ? "in" : "out";
                const day = txeDay(e);
                const amountCls = cancelled ? "text-v2-text-3 line-through" : e.amount >= 0 ? "text-v2-success" : "text-v2-danger";
                const reasonNote = [e.reason, e.note].filter(Boolean);
                return (
                  <tr key={e.id} className={`h-14 border-b border-v2-border last:border-b-0 ${ROW_TINT.hover} ${cancelled ? "opacity-70" : ""}`}>
                    <td className={`${TD} pl-4 tabular-nums text-v2-text-3`}>{start + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap tabular-nums text-v2-text-2`}>
                      {day ? dayMonthLabel(day, lang) : e.date} <span className="text-v2-text-3">|</span> {e.time}
                    </td>
                    <td className={`${TD} max-w-[220px]`}>
                      <TxePerson name={e.studentName} strong />
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right`}>
                      <div className={`font-semibold tabular-nums ${amountCls}`}>
                        {e.amount > 0 ? "+" : ""}
                        {fmtNum(e.amount)}
                      </div>
                      <div className="text-v2-caption text-v2-text-3">{e.paymentType ? t(e.paymentType) : "—"}</div>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right tabular-nums text-v2-text-2`}>{txeNum(e.before)}</td>
                    <td className={`${TD} whitespace-nowrap text-right tabular-nums text-v2-text-2`}>{txeNum(e.after)}</td>
                    <td className={`${TD} max-w-[220px]`}>
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-v2-sm ${
                            dir === "in" ? "bg-v2-success-bg text-v2-success" : dir === "out" ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-warning-bg text-v2-warning"
                          }`}
                          aria-hidden
                        >
                          {dir === "in" ? <ArrowDownLeft className="size-3.5" strokeWidth={2} /> : dir === "out" ? <ArrowUpRight className="size-3.5" strokeWidth={2} /> : <ArrowLeftRight className="size-3.5" strokeWidth={1.75} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-v2-text">{t(TX_TYPE_LABELS[e.txType] || e.txType)}</span>
                          <span className="block truncate text-v2-caption text-v2-text-3" title={e.txName || undefined}>{e.txName || "—"}</span>
                        </span>
                      </div>
                    </td>
                    <td className={`${TD} max-w-[200px]`}>
                      <span className="block truncate text-v2-text" title={e.group || undefined}>{e.group || "—"}</span>
                      {e.lessonDate && <span className="block truncate text-v2-caption text-v2-text-3">{t("Dars sanasi")}: {e.lessonDate}</span>}
                    </td>
                    <td className={`${TD} max-w-[180px]`}>
                      <TxePerson name={e.moderator} kind="staff" />
                    </td>
                    <td className={`${TD} max-w-[240px]`} title={reasonNote.join("\n") || undefined}>
                      {reasonNote.length === 0 ? (
                        <span className="text-v2-text-3">—</span>
                      ) : (
                        <>
                          {e.reason && <span className="block truncate text-v2-text-2">{e.reason}</span>}
                          {e.note && <span className="block truncate text-v2-caption text-v2-text-3">{e.note}</span>}
                        </>
                      )}
                    </td>
                    <td className={`${TD} pr-4`}>
                      {cancelled ? (
                        <Badge tone="danger">{t("Bekor qilingan")}</Badge>
                      ) : waiting ? (
                        <Badge tone="warning">{t("Kutilmoqda")}</Badge>
                      ) : e.status ? (
                        <span className="text-v2-text-2">{e.status}</span>
                      ) : (
                        <span className="text-v2-text-3">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <V2Pagination
          totalItems={error ? 0 : total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>

      <p className="flex items-start gap-2 text-v2-caption text-v2-text-2">
        <Info className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
        <span>
          {t("Faqat ko'rish uchun jurnal: kirim, chiqim va ko'chirish kassa amali orqali yoziladi.")}{" "}
          {canCash && (
            <Link href="/finance-cash" className="font-semibold text-v2-brand-text hover:underline">
              {t("Kassalar")} →
            </Link>
          )}
        </span>
      </p>
    </PageShell>
  );
}
