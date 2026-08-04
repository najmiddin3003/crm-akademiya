"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpToLine, Pencil } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import { useToast } from "@/components/ui/Toast";
import { createInitialOrders } from "@/lib/ordersData";
import { contractPartsTotal, type FinanceContract } from "@/lib/financeContracts";
import FinanceContractDrawer from "./FinanceContractDrawer";

// Moliya → Shartnoma (sidebar: Moliya > Ma'lumotlar > Shartnoma, href
// /finance-fin-contract). Aktiv/Arxiv — cashboxes'dagi bilan bir xil mahalliy
// `archived: boolean` pattern (manba saytida URL query-parametr edi,
// loyihaning boshqa hech bir sahifasida bunday pattern yo'q, shu sabab
// mavjud select-based konventsiyaga moslashtirildi).
//
// MIQDORI/KUTILAYOTGAN TO'LOV MIQDORI ustunlari shartnoma qismlaridan
// hisoblanadi, TO'LANGAN MIQDOR har doim 0 (to'lov yozib borish oynasi bu
// portda yo'q — add-shartnoma formasida ham ko'rsatilmagan). BALANS —
// boshqa o'quvchi ro'yxati sahifalaridagi (Active/ArchiveStudentsPage) bilan
// bir xil deterministik `genBalance(seed)` formula, o'quvchi id'siga bog'liq.
// "Guruh" filtri — Order.group maydoniga bog'liq (ko'p seed buyurtmalarda
// bo'sh, faqat AddOrderModal orqali qo'shilganlarda to'ldiriladi) — manba
// saytidagi filtrlash mantig'i ko'rsatilmagani uchun to'liq join qilinmagan.

function genBalance(seed: number): number {
  const magnitude = 1_000_000 + ((seed * 137) % 6_000_000);
  return seed % 5 === 0 ? magnitude : -magnitude;
}
function fmtNum(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU").replace(/,/g, " ");
}
function parseCreatedAt(s: string): Date | null {
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

export default function FinanceContractsPage() {
  const { showSuccess, showError } = useToast();
  const orders = useMemo(() => createInitialOrders(), []);

  const [contracts, setContracts] = useState<FinanceContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [group, setGroup] = useState("");
  const [student, setStudent] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FinanceContract | null>(null);
  const [archiveBusyId, setArchiveBusyId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/finance-contracts")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setContracts(d.contracts); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const groupOptions = useMemo(
    () => Array.from(new Set(orders.map((o) => o.group).filter(Boolean))).sort(),
    [orders],
  );
  const studentOptions = useMemo(
    () => Array.from(new Set(contracts.map((c) => c.studentName))).sort(),
    [contracts],
  );

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      if (statusFilter === "archived" ? !c.archived : c.archived) return false;
      if (group) {
        const order = orders.find((o) => o.id === c.studentOrderId);
        if (!order || order.group !== group) return false;
      }
      if (student && c.studentName !== student) return false;
      if (dateRange.start || dateRange.end) {
        const created = parseCreatedAt(c.createdAt);
        if (!created) return false;
        if (dateRange.start && created < dateRange.start) return false;
        if (dateRange.end && created > dateRange.end) return false;
      }
      return true;
    });
  }, [contracts, statusFilter, group, student, dateRange, orders]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const selectCls = "h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-40";

  async function toggleArchive(c: FinanceContract) {
    setArchiveBusyId(c.id);
    try {
      const res = await fetch(`/api/finance-contracts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !c.archived }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Bajarilmadi");
        return;
      }
      setContracts((prev) => prev.map((x) => (x.id === c.id ? (data.contract as FinanceContract) : x)));
      showSuccess(c.archived ? "Arxivdan chiqarildi" : "Arxivga o'tkazildi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setArchiveBusyId(null);
    }
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <span>Shartnoma yaratish</span>
        </button>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as "active" | "archived"); setPage(1); }} className={selectCls}>
              <option value="active">Aktiv</option>
              <option value="archived">Arxiv</option>
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} placeholder="Oraliqni tanlang" className="w-56" />
          <div className="relative">
            <select value={group} onChange={(e) => { setGroup(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">Guruh</option>
              {groupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <div className="w-44">
            <StudentSearchSelect label="" value={student} onChange={(v) => { setStudent(v); setPage(1); }} options={studentOptions} placeholder="O'quvchi" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{filtered.length}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Balans</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Moderator</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Miqdori</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kutilayotgan to&apos;lov miqd...</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;langan miqdor</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Yaratilgan sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Izoh</th>
                <th className="px-3 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {slice.map((c, i) => (
                <tr key={c.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[13px] whitespace-nowrap">
                    <Link href={`/student-edit/${c.studentOrderId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                      {c.studentName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtNum(genBalance(c.studentOrderId))}</td>
                  <td className="px-3 py-3 text-[13px] whitespace-nowrap">
                    <Link href={`/management-xodimlar/${c.moderatorId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                      {c.moderatorName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{c.parts.length}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtNum(contractPartsTotal(c))}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{fmtNum(0)}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">{c.createdAt}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground max-w-[220px] truncate" title={c.comment}>{c.comment || "—"}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => setEditTarget(c)} className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-primary" title="Tahrirlash">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {c.archived ? (
                        <button
                          onClick={() => toggleArchive(c)}
                          disabled={archiveBusyId === c.id}
                          className="h-8 w-8 rounded-md hover:bg-emerald-500/10 hover:text-emerald-600 flex items-center justify-center text-muted-foreground disabled:opacity-50"
                          title="Arxivdan chiqarish"
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleArchive(c)}
                          disabled={archiveBusyId === c.id}
                          className="h-8 w-8 rounded-md hover:bg-amber-500/10 hover:text-amber-600 flex items-center justify-center text-muted-foreground disabled:opacity-50"
                          title="Arxivga o'tkazish"
                        >
                          <ArrowUpToLine className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? "Yuklanmoqda…" : "Shartnoma topilmadi"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {addOpen && (
        <FinanceContractDrawer orders={orders} onClose={() => setAddOpen(false)} onSaved={(c) => setContracts((prev) => [c, ...prev])} />
      )}
      {editTarget && (
        <FinanceContractDrawer
          contract={editTarget}
          orders={orders}
          onClose={() => setEditTarget(null)}
          onSaved={(c) => setContracts((prev) => prev.map((x) => (x.id === c.id ? c : x)))}
        />
      )}
    </div>
  );
}
