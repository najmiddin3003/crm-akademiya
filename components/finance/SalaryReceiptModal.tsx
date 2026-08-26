"use client";

import { Printer, X } from "lucide-react";
import type { SalaryRun, SalaryRunItem } from "@/lib/salary";
import { UZ_MONTHS } from "@/lib/salary";

// Bitta xodimning bitta oylik chiqarishdagi ELEKTRON CHEKI.
//
// Manba — `salary_runs.items[].receipt`, ya'ni chiqarish PAYTIDA muzlatilgan
// kesim. Bu yerda hech narsa qayta hisoblanmaydi: xodimning oyligi, foizi
// yoki soliq ro'yxati keyin o'zgarsa ham chekdagi raqamlar o'zgarmasligi
// kerak — aks holda bir marta bosib berilgan qog'oz bilan ekrandagi chek
// bir-biriga mos kelmay qolardi.
//
// CHOP ETISH: loyihadagi mavjud naqsh (app/globals.css) — `@media print`
// hamma narsani yashiradi va faqat `#salary-receipt-print` ko'rinadi.
// Shu sababli chekning tashqarisidagi hech narsa (sidebar, modal foni,
// tugmalar) qog'ozga tushmaydi.

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}
function fmtSum(n: number): string {
  return fmtNum(n) + " so'm";
}
function monthKeyLabel(key?: string): string {
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  const name = UZ_MONTHS[(m - 1) % 12] ?? "";
  return `${y} ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** Chekdagi bitta qator. */
function Row({
  label,
  value,
  tone = "plain",
  strong = false,
  hint,
}: {
  label: string;
  value: string;
  tone?: "plain" | "plus" | "minus" | "total";
  strong?: boolean;
  hint?: string;
}) {
  const cls =
    tone === "plus" ? "text-emerald-700"
    : tone === "minus" ? "text-rose-700"
    : tone === "total" ? "text-foreground"
    : "text-foreground";
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${strong ? "font-semibold" : ""}`}>
      <span className="text-[12.5px] text-muted-foreground">
        {label}
        {hint && <span className="ml-1 text-[11px] opacity-70">{hint}</span>}
      </span>
      <span className={`text-[13px] tabular-nums whitespace-nowrap ${cls}`}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-dashed border-border" />;
}

export default function SalaryReceiptModal({
  run,
  item,
  onClose,
}: {
  run: SalaryRun;
  item: SalaryRunItem;
  onClose: () => void;
}) {
  const r = item.receipt;
  const name = item.name || `Xodim #${item.employeeId}`;
  const paid = Number(item.paid) || 0;
  const rest = Number(item.amount) || 0;

  // Asos qatorining formulasi — chiqarish paytidagi holat bo'yicha.
  const baseFormula =
    !r ? ""
    : r.salaryType === "foiz"
      ? `${fmtNum(r.collected ?? 0)} × ${r.percent ?? 0}%`
      : `${fmtNum(r.fixedSalary ?? 0)} × ${r.day ?? 0}/${r.daysIn ?? 0} kun`;

  // Soliq chegaraga urganmi (hisoblangan oylikdan oshib ketgan).
  const taxLines = r?.taxLines ?? [];
  const taxRaw = taxLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const taxUsed = Number(r?.tax) || 0;
  const taxCapped = taxRaw > taxUsed;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm no-print" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border no-print sticky top-0 bg-card">
          <h3 className="text-[15px] font-semibold">Oylik cheki</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-secondary"
            aria-label="Yopish"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Qog'ozga TUSHADIGAN qism — id chop etish uslubida ishlatiladi. */}
        <div id="salary-receipt-print" className="px-5 py-4">
          <div className="text-center">
            <div className="text-[15px] font-bold tracking-wide">OYLIK CHEKI</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              № {run.id}-{item.employeeId} · {run.createdAt}
            </div>
            {run.month && (
              <div className="text-[12px] text-muted-foreground">{monthKeyLabel(run.month)} uchun</div>
            )}
          </div>

          <Divider />

          <Row label="Xodim" value={name} strong />
          {r?.turi && <Row label="Vazifasi" value={r.turi} />}
          {r && (
            <Row
              label="Hisob turi"
              value={r.salaryType === "foiz" ? `Foiz ${r.percent ?? 0}%` : "Oklad"}
            />
          )}

          {!r ? (
            // Bu maydon qo'shilishidan OLDINGI chiqarishlarda kesim yo'q —
            // o'ylab topilgan raqam ko'rsatilmaydi, rost aytiladi.
            <>
              <Divider />
              <Row label="To'langan" value={fmtSum(paid)} tone="total" strong />
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                Bu chiqarish batafsil kesim saqlanishidan oldin o&apos;tkazilgan — tarkibiy
                qatorlar (asos, bonus, soliq) qayd etilmagan.
              </p>
            </>
          ) : (
            <>
              <Divider />

              <Row label="Asos" value={fmtSum(r.base ?? 0)} hint={baseFormula ? `(${baseFormula})` : undefined} />
              {(r.bonus ?? 0) > 0 && <Row label="Bonus" value={`+${fmtSum(r.bonus ?? 0)}`} tone="plus" />}
              {(r.jarima ?? 0) > 0 && <Row label="Jarima" value={`−${fmtSum(r.jarima ?? 0)}`} tone="minus" />}
              <Row label="Hisoblangan" value={fmtSum(r.gross ?? 0)} strong />

              {taxLines.length > 0 && (
                <>
                  <Divider />
                  {taxLines.map((l, i) => (
                    <Row
                      key={`${l.name}-${i}`}
                      label={l.name}
                      hint={`(${l.detail})`}
                      value={`−${fmtSum(l.amount)}`}
                      tone="minus"
                    />
                  ))}
                  {taxLines.length > 1 && (
                    <Row label="Soliq jami" value={`−${fmtSum(taxUsed)}`} tone="minus" strong />
                  )}
                  {taxCapped && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      Soliq hisoblangan oylikdan oshgani uchun {fmtSum(taxUsed)} bilan cheklandi.
                    </p>
                  )}
                </>
              )}

              <Divider />

              {(r.paidAvans ?? 0) > 0 && <Row label="Avans olingan" value={`−${fmtSum(r.paidAvans ?? 0)}`} tone="minus" />}
              {(r.paidOylik ?? 0) > 0 && (
                <Row label="Avval to'langan oylik" value={`−${fmtSum(r.paidOylik ?? 0)}`} tone="minus" />
              )}
              {(r.carryOver ?? 0) !== 0 && (
                <Row
                  label={(r.carryOver ?? 0) > 0 ? "O'tgan oydan qolgan" : "O'tgan oydan qarzdorlik"}
                  value={`${(r.carryOver ?? 0) > 0 ? "+" : "−"}${fmtSum(Math.abs(r.carryOver ?? 0))}`}
                  tone={(r.carryOver ?? 0) > 0 ? "plus" : "minus"}
                />
              )}

              <div className="mt-2 rounded-lg bg-secondary/40 px-3 py-2 flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold">Qo&apos;lga tegdi</span>
                <span className="text-[17px] font-bold tabular-nums">{fmtSum(paid)}</span>
              </div>

              {rest !== 0 && (
                <Row
                  label={rest > 0 ? "To'lanmagan qoldiq" : "Xodim qarzdorligi"}
                  value={fmtSum(Math.abs(rest))}
                  tone="minus"
                />
              )}
            </>
          )}

          <Divider />
          <div className="text-[11.5px] text-muted-foreground space-y-0.5">
            {run.cashboxName && (
              <div>
                Kassa: {run.cashboxName}
                {run.methodLabel ? ` · ${run.methodLabel}` : ""}
              </div>
            )}
            <div>Chiqarish № {run.id} · {run.employeeCount} ta xodim</div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border no-print sticky bottom-0 bg-card">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            Yopish
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 inline-flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Chop etish
          </button>
        </div>
      </div>
    </div>
  );
}
