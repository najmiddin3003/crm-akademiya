"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, Plus, Search, Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import type { SalaryRun } from "@/lib/salary";
import { UZ_MONTHS, payrollPeriod, payrollPeriodLabel } from "@/lib/salary";

// Moliya → Oylik chiqarish (/finance-payroll). Har bir qator — bitta
// o'tkazilgan "oylik chiqarish" partiyasining umumlashtirilgan hisoboti
// (/api/salary-runs). AMALLAR ustunida ko'rish (per-xodim breakdown) va
// o'chirish (tasdiqlash bilan) mavjud — "Oylik chiqarish" tugmasi xodim
// tanlash sahifasiga o'tadi (/finance-payroll/create).

function fmtSum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " so'm";
}
function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

// "2026-08" → "2026 Avgust"
function monthKeyLabel(key?: string): string {
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  const name = UZ_MONTHS[(m - 1) % 12] ?? "";
  return `${y} ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}
// "26.07.2026 | 16:10" → "26.07.2026"
function datePart(createdAt: string): string {
  return (createdAt || "").split(" ")[0] ?? createdAt;
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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/salary-runs")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.runs); })
      .finally(() => { if (!cancelled) setLoading(false); });
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
      const hay = `${r.id} ${r.createdAt} ${monthKeyLabel(r.month)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, monthFilter]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  async function deleteRun() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/salary-runs/${confirmDel.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        setDeleting(false);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== confirmDel.id));
      showSuccess("Oylik chiqarish o'chirildi");
      setConfirmDel(null);
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <Link
          href="/finance-payroll/create"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Oylik chiqarish
        </Link>
        <div className="md:ml-auto flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Qidirish…"
              className="h-10 pl-9 pr-3 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-[220px]"
            />
          </div>
          <div className="relative">
            <select
              value={monthFilter}
              onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
              className="h-10 pl-3 pr-9 rounded-lg border border-border bg-card text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-[200px]"
            >
              <option value="all">Barcha oylar</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>{monthKeyLabel(m)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-[15px] font-semibold">Oylik chiqarishlar tarixi</h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/10 text-primary text-xs">
            <span className="font-medium">Umumiy soni:</span>
            <span className="font-bold tabular-nums">{filtered.length}</span>
          </div>
        </div>
        <div className="table-scroll overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Oylik</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Davomat</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Davomatdan f...</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Bonus</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Avans</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Jarima</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Akladi</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">To&apos;lanmagan</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Sana</th>
                <th className="text-right px-3 py-3 whitespace-nowrap w-24">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => {
                const p = periodFor(r);
                return (
                  <tr key={r.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                    <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums font-semibold whitespace-nowrap">{fmtSum(r.oylik)}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{r.davomat > 0 ? fmtNum(r.davomat) : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{r.davomatFoizi > 0 ? fmtNum(r.davomatFoizi) : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{r.bonus > 0 ? <span className="text-emerald-600 font-medium">{fmtNum(r.bonus)}</span> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{r.avans > 0 ? <span className="text-amber-600 font-medium">{fmtNum(r.avans)}</span> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{r.jarima > 0 ? <span className="text-rose-600 font-medium">{fmtNum(r.jarima)}</span> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{r.akladi > 0 ? fmtNum(r.akladi) : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums font-semibold whitespace-nowrap">
                      <span className={r.tolanmagan > 0 ? "text-rose-600" : "text-muted-foreground"}>{fmtSum(r.tolanmagan)}</span>
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-muted-foreground whitespace-nowrap">
                      {datePart(r.createdAt)}
                      {r.month && <> — {monthKeyLabel(r.month)} <span className="text-muted-foreground/70">({payrollPeriodLabel(p)})</span></>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetail(r)}
                          className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                          title="Ko'rish"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDel(r)}
                          className="h-8 w-8 rounded-md hover:bg-rose-500/10 inline-flex items-center justify-center text-rose-500 hover:text-rose-600"
                          title="O'chirish"
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
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-6">
            <h3 className="text-[16px] font-semibold mb-1">Oylik chiqarish #{detail.id}</h3>
            <div className="text-[12.5px] text-muted-foreground mb-4">
              {datePart(detail.createdAt)}{detail.month && ` — ${monthKeyLabel(detail.month)}`} · {detail.employeeCount} ta xodim
            </div>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Oylik</div>
                <div className="mt-1 font-semibold tabular-nums">{fmtSum(detail.oylik)}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">To&apos;lanmagan</div>
                <div className="mt-1 font-semibold tabular-nums text-rose-600">{fmtSum(detail.tolanmagan)}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Bonus</div>
                <div className="mt-1 tabular-nums text-emerald-600">{fmtNum(detail.bonus)}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Jarima</div>
                <div className="mt-1 tabular-nums text-rose-600">{fmtNum(detail.jarima)}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Avans</div>
                <div className="mt-1 tabular-nums text-amber-600">{fmtNum(detail.avans)}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Akladi</div>
                <div className="mt-1 tabular-nums">{fmtNum(detail.akladi)}</div>
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setDetail(null)}
                className="h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setConfirmDel(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">
              Haqiqatdan ham bu oylik chiqarishni o&apos;chirishni xohlaysizmi?
            </p>
            <p className="text-center text-[12.5px] text-muted-foreground mt-1">
              #{confirmDel.id} · {datePart(confirmDel.createdAt)} · {fmtSum(confirmDel.oylik)}
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setConfirmDel(null)}
                disabled={deleting}
                className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                Yo&apos;q
              </button>
              <button
                onClick={deleteRun}
                disabled={deleting}
                className="h-9 px-6 rounded-lg bg-rose-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? "O'chirilmoqda…" : "Ha, o'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
