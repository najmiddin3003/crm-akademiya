"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { ArrowLeft, Eye, ReceiptText, Search, Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import SalaryReceiptModal from "./SalaryReceiptModal";
import type { SalaryRun, SalaryRunItem } from "@/lib/salary";
import { payrollPeriod, payrollPeriodLabel } from "@/lib/salary";
import { invalidateTransactions } from "@/lib/cacheKeys";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Moliya → Oylik chiqarish → Chiqarishlar tarixi (/finance-payroll/history).
// Har bir qator — bitta o'tkazilgan "oylik chiqarish" partiyasining
// umumlashtirilgan hisoboti (/api/salary-runs). AMALLAR ustunida ko'rish
// (per-xodim breakdown) va o'chirish (tasdiqlash bilan) mavjud.
//
// Bu sahifa ilgari bo'limning bosh sahifasi edi; endi bosh sahifada oylik
// HISOB-KITOBI turadi (/finance-payroll), tarixga esa o'sha yerdagi
// "Chiqarishlar tarixi" tugmasi orqali kelinadi.

function fmtSum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " so'm";
}
function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

// "2026-08" → "2026 Avgust"
function monthKeyLabel(key: string | undefined, months: string[]): string {
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  return `${y} ${months[(m - 1) % 12] ?? ""}`;
}
// "26.07.2026 | 16:10" → "26.07.2026"
function datePart(createdAt: string): string {
  return (createdAt || "").split(" ")[0] ?? createdAt;
}

// Chiqarishdagi umumiy XODIM QARZDORLIGI (musbat son). Yangi yozuvlarda
// tayyor maydon bor; undan oldingilarida items[] dagi manfiy qoldiqlardan
// yig'iladi. Ikkalasi ham bo'lmasa — 0, ya'ni qarzdorlik qayd etilmagan.
function debtOf(r: SalaryRun): number {
  if (typeof r.qarzdorlik === "number") return r.qarzdorlik;
  return (r.items ?? []).reduce((s, it) => s + Math.max(-(Number(it.amount) || 0), 0), 0);
}

// Shu chiqarishda kassadan HAQIQATAN chiqarilgan summa. Bu maydon
// qo'shilishidan oldingi chiqarishlar umuman pul chiqarmagan (faqat
// hisobot yozilardi) — ularda 0, ya'ni to'lanmagan bo'lib qolaveradi.
function paidOf(r: SalaryRun): number {
  if (typeof r.tolangan === "number") return r.tolangan;
  return (r.items ?? []).reduce((s, it) => s + (Number(it.paid) || 0), 0);
}

function periodFor(r: SalaryRun) {
  if (r.month) {
    const [y, m] = r.month.split("-").map(Number);
    const daysIn = new Date(y, m, 0).getDate();
    const day = r.createdAt ? Number(datePart(r.createdAt).split(".")[0]) : daysIn;
    return { year: y, month: m - 1, day: Math.min(day || daysIn, daysIn), daysIn };
  }
  return payrollPeriod();
}

export default function SalaryRunsPage() {
  const { t, months } = useT();
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<SalaryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [query, setQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [detail, setDetail] = useState<SalaryRun | null>(null);
  const [confirmDel, setConfirmDel] = useState<SalaryRun | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Ochilgan chek: qaysi chiqarishning qaysi xodimi.
  const [receipt, setReceipt] = useState<{ run: SalaryRun; item: SalaryRunItem } | null>(null);
  // Xodim ismlari — tafsilot oynasidagi kesim uchun. Yangi chiqarishlar
  // ismni o'z ichida saqlaydi (audit-log), eski yozuvlarda esa faqat
  // employeeId bor, shuning uchun ro'yxatdan qidiriladi.
  const [empNames, setEmpNames] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/salary-runs")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.runs); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // FILIALGA KESILMAGAN ro'yxat (tor proyeksiya) — nima uchun aynan
    // shu endpoint: app/api/hr-employees/ref/route.ts izohiga qarang.
    fetch("/api/hr-employees/ref")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const m = new Map<number, string>();
        for (const e of d.employees as { id: number; name: string }[]) m.set(e.id, e.name);
        setEmpNames(m);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.month) set.add(r.month); });
    return Array.from(set).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (monthFilter !== "all" && r.month !== monthFilter) return false;
      if (!q) return true;
      const hay = `${r.id} ${r.createdAt} ${monthKeyLabel(r.month, months)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, monthFilter, months]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  async function deleteRun() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/salary-runs/${confirmDel.id}`, { method: "DELETE" });
      const data = await res.json();
      invalidateTransactions(); // yangi tranzaksiya yozildi -> kesh bekor
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        setDeleting(false);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== confirmDel.id));
      showSuccess(
        data.refunded > 0
          ? t("Oylik chiqarish o'chirildi — {refunded} kassaga qaytarildi", { refunded: fmtSum(data.refunded) })
          : "Oylik chiqarish o'chirildi",
      );
      setConfirmDel(null);
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        {/* Bitta havola yetarli: hisob-kitob sahifasi ham "orqaga", ham
            "yangi chiqarish" manzili — ikkitasi bir joyga olib borardi. */}
        <Link
          href="/finance-payroll"
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("Oylik hisob-kitobga qaytish")}
        </Link>
        <div className="md:ml-auto flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Qidirish…")}
              className="h-10 pl-9 pr-3 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-[220px]"
            />
          </div>
          <Select value={monthFilter} onChange={(v) => { setMonthFilter(v); setPage(1); }} options={[{ value: "all", label: t("Barcha oylar") }, ...monthOptions.map((m) => ({ value: m, label: monthKeyLabel(m, months) }))]} className="sm:w-[200px]" />
        </div>
      </div>

      {/* Card */}
      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-[15px] font-semibold">{t("Oylik chiqarishlar tarixi")}</h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/10 text-primary text-xs">
            <span className="font-medium">{t("Umumiy soni:")}</span>
            <span className="font-bold tabular-nums">{filtered.length}</span>
          </div>
        </div>
        <div className="table-scroll overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Oylik")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Davomat")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Davomatdan f...")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Bonus")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Avans")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Jarima")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Soliq")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Akladi")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("To'langan")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("To'lanmagan")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Qarzdorlik")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Sana")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap w-24">{t("Amallar")}</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => {
                const p = periodFor(r);
                return (
                  <tr key={r.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                    <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums font-semibold whitespace-nowrap">{t(fmtSum(r.oylik))}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{r.davomat > 0 ? fmtNum(r.davomat) : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{r.davomatFoizi > 0 ? fmtNum(r.davomatFoizi) : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{r.bonus > 0 ? <span className="text-emerald-600 font-medium">{fmtNum(r.bonus)}</span> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{r.avans > 0 ? <span className="text-amber-600 font-medium">{fmtNum(r.avans)}</span> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{r.jarima > 0 ? <span className="text-rose-600 font-medium">{fmtNum(r.jarima)}</span> : <span className="text-muted-foreground">0</span>}</td>
                    {/* Soliq — shu chiqarishda ushlab qolingan summa.
                        Maydon qo'shilishidan oldingi yozuvlarda yo'q. */}
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">
                      {(r.soliq ?? 0) > 0
                        ? <span className="text-rose-600 font-medium">{fmtNum(r.soliq ?? 0)}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{r.akladi > 0 ? fmtNum(r.akladi) : <span className="text-muted-foreground">0</span>}</td>
                    {/* Kassadan chiqarilgan summa — chiqarish "to'langan"
                        ekanini aynan shu ustun ko'rsatadi. */}
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums font-semibold whitespace-nowrap">
                      {paidOf(r) > 0
                        ? <span className="text-emerald-600">{t(fmtSum(paidOf(r)))}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums font-semibold whitespace-nowrap">
                      <span className={r.tolanmagan > 0 ? "text-rose-600" : "text-muted-foreground"}>{t(fmtSum(r.tolanmagan))}</span>
                    </td>
                    {/* Xodimlarning akademiyaga qarzi — to'lanmaganning
                        teskarisi. Keyingi oy hisobidan ushlab qolinadi. */}
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums font-semibold whitespace-nowrap">
                      {debtOf(r) > 0
                        ? <span className="text-amber-600">{t(fmtSum(debtOf(r)))}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-muted-foreground whitespace-nowrap">
                      {datePart(r.createdAt)}
                      {r.month && <> — {monthKeyLabel(r.month, months)} <span className="text-muted-foreground/70">({payrollPeriodLabel(p)})</span></>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetail(r)}
                          className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                          title={t("Ko'rish")}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDel(r)}
                          className="h-8 w-8 rounded-md hover:bg-rose-500/10 inline-flex items-center justify-center text-rose-500 hover:text-rose-600"
                          title={t("O'chirish")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Ma'lumot topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </div>

      {/* Detail modal */}
      {detail && (
        <Modal onClose={() => setDetail(null)} bare size="lg" zIndex={110} panelClassName="p-6">{(modal) => (<>
            <h3 className="text-[16px] font-semibold mb-1">Oylik chiqarish #{detail.id}</h3>
            <div className="text-[12.5px] text-muted-foreground mb-4">
              {datePart(detail.createdAt)}{detail.month && ` — ${monthKeyLabel(detail.month, months)}`} Â· {detail.employeeCount} ta xodim
              {detail.cashboxName && ` Â· ${detail.cashboxName}${detail.methodLabel ? ` (${detail.methodLabel})` : ""}`}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div className="col-span-2 rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("Oylik")}</div>
                <div className="mt-1 font-semibold tabular-nums">{t(fmtSum(detail.oylik))}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("To'langan")}</div>
                <div className="mt-1 font-semibold tabular-nums text-emerald-600">{t(fmtSum(paidOf(detail)))}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("To'lanmagan")}</div>
                <div className="mt-1 font-semibold tabular-nums text-rose-600">{t(fmtSum(detail.tolanmagan))}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("Bonus")}</div>
                <div className="mt-1 tabular-nums text-emerald-600">{fmtNum(detail.bonus)}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("Jarima")}</div>
                <div className="mt-1 tabular-nums text-rose-600">{fmtNum(detail.jarima)}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("Avans")}</div>
                <div className="mt-1 tabular-nums text-amber-600">{fmtNum(detail.avans)}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("Akladi")}</div>
                <div className="mt-1 tabular-nums">{fmtNum(detail.akladi)}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("Soliq")}</div>
                <div className={`mt-1 tabular-nums ${(detail.soliq ?? 0) > 0 ? "text-rose-600" : ""}`}>
                  {fmtNum(detail.soliq ?? 0)}
                </div>
              </div>
              <div className="col-span-2 rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("Xodim qarzdorligi")}</div>
                <div className={`mt-1 font-semibold tabular-nums ${debtOf(detail) > 0 ? "text-amber-600" : ""}`}>
                  {t(fmtSum(debtOf(detail)))}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("keyingi oy hisobidan ushlab qolinadi")}
                </div>
              </div>
            </div>

            {/* Xodimlar kesimi — ism bosilganda xodim profiliga o'tiladi. */}
            {(detail.items?.length ?? 0) > 0 && (
              <div className="mt-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t("Xodimlar kesimi")}
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
                  {detail.items!.map((it) => {
                    const name = it.name || empNames.get(it.employeeId) || t("Xodim #{employeeId}", { employeeId: it.employeeId });
                    const debt = Math.max(-it.amount, 0);
                    const paid = Number(it.paid) || 0;
                    return (
                      <div key={it.employeeId} className="flex items-center justify-between gap-3 px-3 py-2">
                        {/* Chek — shu xodimning oylik hisob-kitobi to'liq
                            ko'rinadigan va chop etsa bo'ladigan oyna. */}
                        <button
                          type="button"
                          onClick={() => setReceipt({ run: detail, item: it })}
                          className="h-7 w-7 shrink-0 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                          title={t("{name} — chekni ko'rish", { name })}
                        >
                          <ReceiptText className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/management-xodimlar/${it.employeeId}`}
                          className="text-[13px] font-medium text-primary hover:underline truncate mr-auto"
                        >
                          {name}
                        </Link>
                        {/* Chiqarilgan pul birinchi o'rinda — qolgan qoldiq
                            yoki qarz esa yonida izoh bo'lib turadi. */}
                        {paid > 0 ? (
                          <span className="text-[13px] tabular-nums font-semibold text-emerald-600 whitespace-nowrap">
                            {t(fmtSum(paid))} <span className="font-normal text-muted-foreground">{t("to'landi")}</span>
                          </span>
                        ) : debt > 0 ? (
                          <span className="text-[13px] tabular-nums font-semibold text-amber-600 whitespace-nowrap">
                            −{t(fmtSum(debt))} <span className="font-normal text-muted-foreground">{t("qarzdor")}</span>
                          </span>
                        ) : (
                          <span className="text-[13px] tabular-nums whitespace-nowrap">
                            {it.amount > 0
                              ? <span className="text-rose-600 font-semibold">{t(fmtSum(it.amount))}</span>
                              : <span className="text-muted-foreground">{t("0 so'm")}</span>}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-5">
              <button
                onClick={modal.close}
                className="h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
              >
                {t("Yopish")}
              </button>
            </div>
          </>)}</Modal>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <Modal onClose={() => setConfirmDel(null)} locked={deleting} bare size="sm" zIndex={110} panelClassName="p-6">{(modal) => (<>
            <p className="text-center text-[15px] font-semibold">
              {t("Haqiqatdan ham bu oylik chiqarishni o'chirishni xohlaysizmi?")}
            </p>
            <p className="text-center text-[12.5px] text-muted-foreground mt-1">
              #{confirmDel.id} Â· {datePart(confirmDel.createdAt)} Â· {t(fmtSum(confirmDel.oylik))}
            </p>
            {/* O'chirish endi pulni ham qaytaradi — foydalanuvchi buni
                oldindan bilishi kerak. */}
            {paidOf(confirmDel) > 0 && (
              <p className="text-center text-[12.5px] text-amber-600 mt-2">
                {`Chiqarilgan ${t(fmtSum(paidOf(confirmDel)))}${
                  confirmDel.cashboxName ? ` "${confirmDel.cashboxName}" kassasiga` : " kassaga"
                } qaytariladi, tranzaksiyalar bekor qilingan deb belgilanadi.`}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={modal.close}
                disabled={deleting}
                className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                {t("Yo'q")}
              </button>
              <button
                onClick={deleteRun}
                disabled={deleting}
                className="h-9 px-6 rounded-lg bg-rose-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? t("O'chirilmoqda…") : t("Ha, o'chirish")}
              </button>
            </div>
          </>)}</Modal>
      )}

      {/* Chek — tafsilot oynasi USTIDA ochiladi (z-[120]), shuning uchun
          yopilganda foydalanuvchi yana xodimlar ro'yxatiga qaytadi. */}
      {receipt && (
        <SalaryReceiptModal
          run={receipt.run}
          item={receipt.item}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
