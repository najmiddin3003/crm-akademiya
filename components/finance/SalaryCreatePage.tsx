"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import type { EmployeePayroll } from "@/lib/salary";

// Moliya → Oylik chiqarish → xodim tanlash (/finance-payroll/create,
// skrinshot 3). Har bir qator /api/salary-runs/employees-payroll'dan (real
// BONUS/JARIMA + demo AVANS/AKLADI, [[project_crm_akademiya_conversion]]ga
// qarang). Checkbox belgilansa yuqorida "Oylik chiqarish" tugmasi paydo
// bo'ladi (foydalanuvchi aniq talabi) — bosilsa tasdiqlash oynasi chiqadi,
// "Ha" bosilsa /api/salary-runs POST qilinadi va ro'yxat sahifasiga qaytadi.

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}

export default function SalaryCreatePage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [employees, setEmployees] = useState<EmployeePayroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/salary-runs/employees-payroll")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setEmployees(d.employees); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const allSelected = employees.length > 0 && selected.size === employees.length;
  const someSelected = selected.size > 0 && !allSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(employees.map((e) => e.id)));
  }
  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const start = (page - 1) * pageSize;
  const slice = employees.slice(start, start + pageSize);

  const selectedCount = useMemo(() => selected.size, [selected]);

  async function confirmPayout() {
    setSaving(true);
    try {
      const res = await fetch("/api/salary-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Oylik chiqarilmadi");
        setSaving(false);
        return;
      }
      showSuccess("Oylik chiqarildi");
      router.push("/finance-payroll");
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-3">
      <div className="flex items-center gap-2">
        {selectedCount > 0 && (
          <button
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
          >
            <Wallet className="w-4 h-4" />
            Oylik chiqarish
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex justify-end px-3 pt-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
            <span className="text-muted-foreground">Umumiy soni:</span>
            <span className="font-bold tabular-nums">{employees.length}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-3 w-10">
                  <input ref={headerCheckboxRef} type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-border w-4 h-4" />
                </th>
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;liq ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Ish haqi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Davomat</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Davomatdan foizi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Bonus</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Avans</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Jarima</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Akladi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;lanmagan</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((e, i) => (
                <tr key={e.id} className={`border-b border-border/50 transition-colors hover:bg-secondary/30 ${selected.has(e.id) ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleOne(e.id)} className="rounded border-border w-4 h-4" />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[13px] font-medium whitespace-nowrap">{e.name}</td>
                  <td className="px-3 py-3 text-[13px] whitespace-nowrap">{e.phone}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtUZS(e.ishHaqi)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{e.davomat}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{e.davomatFoizi}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtUZS(e.bonus)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtUZS(e.avans)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtUZS(e.jarima)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtUZS(e.akladi)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums font-semibold whitespace-nowrap">{fmtUZS(e.tolanmagan)}</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Xodim topilmadi"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={employees.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setConfirmOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">Haqiqatdan ham oylik chiqarishni xohlaysizmi?</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => setConfirmOpen(false)} disabled={saving} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                Yo&apos;q
              </button>
              <button onClick={confirmPayout} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {saving ? "Chiqarilmoqda…" : "Ha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
