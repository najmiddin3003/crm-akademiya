"use client";

import { useEffect, useMemo, useState } from "react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { LEAVE_TABS, type LeaveCategory, type LeaveReason } from "@/lib/studentReports";
import { useT } from "@/components/shared/Language";

// Hisobotlar → Ketish sabablari (href /reports-leave-reasons).
// Referensdagi kabi 4 tab, tanlangan tab bo'yicha jami ketganlar soni va
// sabablar jadvali.
//
// SANA ORALIG'I TANLAGICHI OLIB TASHLANDI. U hech narsa qilmasdi: qatorlar
// bir marta, hech qanday parametrsiz olinardi va tanlangan oraliq faqat
// state'da yotardi. Asosiy sabab esa ma'lumotning O'ZIDA: `leave_reasons`
// kolleksiyasi allaqachon JAMLANGAN qator saqlaydi (LeaveReason:
// id/category/reason/count) — unda ketish SANASI yo'q, ya'ni "shu oraliqda
// necha kishi ketgan" degan savolga javob beradigan maydon mavjud emas.
// Oraliqni yuborish ham foydasiz: /api/student-reports faqat `kind` ni
// tushunadi. Har bir ketish hodisasi sanasi bilan yozilgan yangi model
// paydo bo'lgandagina bu tanlagichni qaytarish mantiqiy bo'ladi.

export default function Page() {
  const { t } = useT();
  const [rows, setRows] = useState<LeaveReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<LeaveCategory>("umumiy");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student-reports?kind=leave-reasons")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(
    () => rows.filter((r) => r.category === tab).sort((a, b) => b.count - a.count),
    [rows, tab],
  );
  const total = useMemo(() => visible.reduce((s, r) => s + r.count, 0), [visible]);

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-1 flex-wrap">
          {LEAVE_TABS.map((tv) => (
            <button
              key={tv.key}
              onClick={() => setTab(tv.key)}
              className={`h-8 px-4 rounded-md text-sm font-medium ${
                tab === tv.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t(tv.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="text-[13px] text-muted-foreground">{t("Umumiy ketgan o'quvchilar")}</div>
        <div className="text-[24px] font-semibold tabular-nums">{total.toLocaleString("ru-RU")}</div>
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border text-[13px] font-semibold">{t("Sababi")}</div>
        <div className="table-scroll">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">{t("Sabab nomi")}</th>
                <th className="px-5 py-3 text-right pr-5">{t("Ketgan o'quvchi soni")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((r, i) => (
                <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-5 py-3">{t(r.reason)}</td>
                  <td className="px-5 py-3 pr-5 text-right tabular-nums font-medium">{r.count}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Ma'lumot topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
