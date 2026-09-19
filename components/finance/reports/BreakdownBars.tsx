"use client";
import { useT } from "@/components/shared/Language";

// Gorizontal foiz-panjara ("Kirim"/"Chiqim" panellaridagi "Tranzaksiya turi"/
// "To'lov usuli" taqsimoti). `tone` panel rangini belgilaydi (kirim=yashil,
// chiqim=qizil) — track och rang, to'ldirilgan qism shu qatorning O'Z FOIZIGA
// mutanosib kengaytiriladi (qatorlar orasidagi solishtirish emas).
export interface BreakdownRow {
  label: string;
  amount: number;
}

function fmtUZS(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " UZS";
}

export default function BreakdownBars({ rows, tone }: { rows: BreakdownRow[]; tone: "green" | "red" }) {
  const { t } = useT();
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  const trackCls = tone === "green" ? "bg-emerald-100" : "bg-rose-100";
  const fillCls = tone === "green" ? "bg-emerald-500" : "bg-rose-400";

  if (total <= 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{t("Ma'lumot topilmadi")}</div>;
  }

  return (
    <div className="space-y-3">
      {sorted.map((r) => {
        const pct = (r.amount / total) * 100;
        return (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-32 shrink-0 text-[13px] truncate">{t(r.label)}</div>
            <div className={`relative flex-1 h-7 rounded-full overflow-hidden ${trackCls}`}>
              <div className={`h-full rounded-full ${fillCls} flex items-center justify-center transition-all`} style={{ width: `${Math.max(pct, 4)}%` }}>
                {pct >= 8 && <span className="text-[11px] font-semibold text-white">{pct.toFixed(1)} %</span>}
              </div>
              {pct < 8 && <span className="absolute inset-0 flex items-center pl-2 text-[11px] font-medium text-muted-foreground">{pct.toFixed(1)} %</span>}
            </div>
            <div className="w-28 shrink-0 text-right text-[13px] tabular-nums font-medium">{fmtUZS(r.amount)}</div>
          </div>
        );
      })}
    </div>
  );
}
