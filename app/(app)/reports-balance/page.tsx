"use client";

import { useEffect, useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";

// Hisobotlar → Balans (href /reports-balance). Ma'lumot /api/reports/balance
// dan — xodimlar bo'yicha Bonus/Jarima/Avans jamlanmasi va shundan kelib
// chiqadigan "Ish haqi" qoldig'i. Pastda referensdagi kabi "Jami" qatori.
//
// SANA ORALIG'I TANLAGICHI OLIB TASHLANDI. Ilgari sahifada DateRangePicker
// turardi, lekin tanlangan oraliq hech qayerga ketmasdi: /api/reports/balance
// na `from`, na `to` parametrini qabul qiladi va qaytargan qatorda (BalanceRow:
// id/name/phone/salary/bonus/advance/penalty) umuman SANA MAYDONI YO'Q — ya'ni
// qatorlarni klientda ham ajratib bo'lmasdi. Foydalanuvchi oraliq tanlagach
// jadval o'zgarmasdi, lekin filtrlangandek ko'rinardi — bu yolg'on edi.
//
// Oraliq bo'yicha filtrlash TEXNIK JIHATDAN mumkin: jamlanma manbalarining
// hammasida sana bor (`bonuses.createdAt`, `penalties.createdAt` —
// "DD.MM.YYYY HH:mm"; `transaction_entries.date` — "YYYY-MM-DD"). Buning uchun
// app/api/reports/balance/route.ts ga from/to qo'shilishi kerak; u fayl bu
// bo'limga tegishli emas, shuning uchun bu yerda tanlagich shunchaki olib
// tashlandi (ishlamaydigan boshqaruvni qoldirgandan ko'ra yaxshiroq).

interface BalanceRow {
  id: number;
  name: string;
  phone: string;
  salary: number;
  bonus: number;
  advance: number;
  penalty: number;
}

const fmtUZS = (n: number) => n.toLocaleString("ru-RU") + " UZS";

export default function Page() {
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/balance")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          salary: acc.salary + r.salary,
          bonus: acc.bonus + r.bonus,
          advance: acc.advance + r.advance,
          penalty: acc.penalty + r.penalty,
        }),
        { salary: 0, bonus: 0, advance: 0, penalty: 0 },
      ),
    [rows],
  );

  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">To&apos;liq ismi</th>
                <th className="px-5 py-3 text-left">Telefon raqam</th>
                <th className="px-5 py-3 text-right">Ish haqi</th>
                <th className="px-5 py-3 text-right">Bonus</th>
                <th className="px-5 py-3 text-right">Avans</th>
                <th className="px-5 py-3 text-right pr-5">Jarima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((r, i) => (
                <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 font-medium">{r.name}</td>
                  <td className="px-5 py-3 tabular-nums text-[13px]">{r.phone || "—"}</td>
                  <td className={`px-5 py-3 text-right tabular-nums ${r.salary < 0 ? "text-rose-600" : ""}`}>{fmtUZS(r.salary)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtUZS(r.bonus)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtUZS(r.advance)}</td>
                  <td className="px-5 py-3 pr-5 text-right tabular-nums">{fmtUZS(r.penalty)}</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Ma'lumot topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-primary/5 border-t border-border font-semibold">
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3">Jami:</td>
                  <td className="px-5 py-3" />
                  <td className={`px-5 py-3 text-right tabular-nums ${totals.salary < 0 ? "text-rose-600" : ""}`}>{fmtUZS(totals.salary)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtUZS(totals.bonus)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtUZS(totals.advance)}</td>
                  <td className="px-5 py-3 pr-5 text-right tabular-nums">{fmtUZS(totals.penalty)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <Pagination
          totalItems={rows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
