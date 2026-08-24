"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpToLine, Pencil } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useStudents } from "@/hooks/useStudents";
import { useGroups } from "@/hooks/useGroups";
import { contractPartsTotal, type FinanceContract } from "@/lib/financeContracts";
import FinanceContractDrawer from "./FinanceContractDrawer";

// Moliya → Shartnoma (sidebar: Moliya > Ma'lumotlar > Shartnoma, href
// /finance-fin-contract). Aktiv/Arxiv — cashboxes'dagi bilan bir xil mahalliy
// `archived: boolean` pattern (manba saytida URL query-parametr edi,
// loyihaning boshqa hech bir sahifasida bunday pattern yo'q, shu sabab
// mavjud select-based konventsiyaga moslashtirildi).
//
// ILGARI BU SAHIFA SOXTA EDI, endi tuzatildi:
//   • BALANS ustuni `genBalance(seed)` — o'quvchi id'sidan `(id*137)%6000000`
//     formulasi bilan "o'ylab topilgan" pul edi. Endi HAQIQIY manba:
//     /api/students/balances (transaction_entries'dagi bekor qilinmagan
//     payIn yozuvlari yig'indisi — loyihadagi yagona haqiqiy balans).
//   • O'quvchi/guruh ro'yxatlari `createInitialOrders()` — 502 ta soxta
//     buyurtma generatoridan olinardi. Endi o'quvchilar /api/pupils dan
//     (useStudents), guruhlar /api/groups dan (useGroups) keladi va guruh
//     filtri `group.studentIds` orqali HAQIQIY bog'lanish bo'yicha ishlaydi.
//   • TO'LANGAN MIQDOR har qatorda literal `0` chizilardi. Bu fakt da'vosi:
//     "bu shartnoma bo'yicha hech narsa to'lanmagan". Aslida schema'da
//     shartnoma qismini to'lovga bog'laydigan maydon YO'Q
//     (transaction_entries yozuvida contractId/partId yo'q), shuning uchun
//     endi "—" chiziladi.
//
// MIQDORI/KUTILAYOTGAN TO'LOV MIQDORI ustunlari shartnoma qismlaridan
// hisoblanadi (haqiqiy: qismlar soni va ularning yig'indisi).

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
  // O'quvchilar bazadan: ism → karta (id, profil havolasi uchun).
  const { students, byName: studentByName } = useStudents();
  const { groups } = useGroups();

  const [contracts, setContracts] = useState<FinanceContract[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
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
    // Balanslar alohida — jadval shartnomalarsiz ham chiziladi, balans esa
    // kechroq kelsa faqat shu ustun yangilanadi.
    fetch("/api/students/balances")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setBalances(d.balances); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const nameKey = (n: string) => n.trim().toLowerCase();

  // Guruh ro'yxati — bazadagi haqiqiy guruhlar (nomi bo'sh bo'lganini
  // ko'rsatishdan ma'no yo'q).
  const groupOptions = useMemo(
    () => Array.from(new Set(groups.map((g) => g.name).filter(Boolean))).sort(),
    [groups],
  );
  // O'quvchi filtri — shartnomasi bor o'quvchilar (jadvalda ko'rinadiganlar).
  const studentOptions = useMemo(
    () => Array.from(new Set(contracts.map((c) => c.studentName))).sort(),
    [contracts],
  );

  // Tanlangan guruhdagi o'quvchilar (pupils.id) — guruh filtri shu to'plam
  // orqali ishlaydi. Ilgari filtr soxta `Order.group` maydoniga qarardi.
  const groupPupilIds = useMemo(() => {
    if (!group) return null;
    const ids = new Set<number>();
    for (const g of groups) {
      if (g.name !== group) continue;
      for (const id of g.studentIds ?? []) ids.add(id);
    }
    return ids;
  }, [group, groups]);

  // Shartnomadagi o'quvchi kartasi ismi bo'yicha topiladi (yozuvda ism
  // saqlanadi; `studentOrderId` — o'quvchi profiliga havola uchun id).
  const pupilOf = (c: FinanceContract) => studentByName.get(nameKey(c.studentName));

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      if (statusFilter === "archived" ? !c.archived : c.archived) return false;
      if (groupPupilIds) {
        const pupil = studentByName.get(nameKey(c.studentName));
        const pupilId = pupil?.id ?? c.studentOrderId;
        if (!groupPupilIds.has(pupilId)) return false;
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
  }, [contracts, statusFilter, groupPupilIds, student, dateRange, studentByName]);

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
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
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

      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
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
              {slice.map((c, i) => {
                const pupil = pupilOf(c);
                return (
                  <tr key={c.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                    <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                    <td className="px-3 py-3 text-[13px] whitespace-nowrap">
                      {/* `?src=list` — profil sahifasi id'ni MongoDB `pupils`
                          dan qidirsin (o'quvchi kartasi shu yerda). */}
                      <Link href={`/student-edit/${pupil?.id ?? c.studentOrderId}?src=list`} className="font-medium text-foreground hover:text-primary hover:underline">
                        {c.studentName}
                      </Link>
                    </td>
                    {/* Ro'yxatda yo'q o'quvchi = hali birorta to'lov yozuvi
                        yo'q, ya'ni 0 — bu taxmin emas, hisoblangan qiymat
                        (Kirim oynasidagi bilan bir xil qoida). */}
                    <td className="px-3 py-3 text-[13px] tabular-nums">{fmtNum(balances[nameKey(c.studentName)] ?? 0)}</td>
                    <td className="px-3 py-3 text-[13px] whitespace-nowrap">
                      {c.moderatorId ? (
                        <Link href={`/management-xodimlar/${c.moderatorId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                          {c.moderatorName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{c.moderatorName || "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[13px] tabular-nums">{c.parts.length}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums">{fmtNum(contractPartsTotal(c))}</td>
                    {/* To'lovni shartnomaga bog'laydigan maydon schema'da yo'q
                        (transaction_entries'da contractId yo'q) — 0 yozish
                        "to'lanmagan" degan yolg'on da'vo bo'lardi. */}
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
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
                );
              })}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Shartnoma topilmadi"}</td>
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
        <FinanceContractDrawer students={students} onClose={() => setAddOpen(false)} onSaved={(c) => setContracts((prev) => [c, ...prev])} />
      )}
      {editTarget && (
        <FinanceContractDrawer
          contract={editTarget}
          students={students}
          onClose={() => setEditTarget(null)}
          onSaved={(c) => setContracts((prev) => prev.map((x) => (x.id === c.id ? c : x)))}
        />
      )}
    </div>
  );
}
