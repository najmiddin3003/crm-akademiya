"use client";

import { Printer, X } from "lucide-react";
import type { SalaryRun, SalaryRunItem } from "@/lib/salary";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

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
function monthKeyLabel(key: string | undefined, months: string[]): string {
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  return `${y} ${months[(m - 1) % 12] ?? ""}`;
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
  const { t, months } = useT();
  const modal = useModalClose(onClose);
  const r = item.receipt;
  const name = item.name || t("Xodim #{employeeId}", { employeeId: item.employeeId });
  const paid = Number(item.paid) || 0;
  const rest = Number(item.amount) || 0;

  // Asos qatorining formulasi — chiqarish paytidagi holat bo'yicha.
  // `collected` — sof tushum (o'quvchilarga qaytarilgani ayrilgan);
  // qaytarim bo'lsa chekda ham ochiq yoziladi. Eski cheklarda `refunded`
  // yo'q — oddiy ko'rinish.
  const refunded = Number(r?.refunded) || 0;
  const collectedFormula = refunded > 0
    ? t("({refunded} − qaytarim {refunded2})", { refunded: fmtNum((r?.collected ?? 0) + refunded), refunded2: fmtNum(refunded) })
    : fmtNum(r?.collected ?? 0);
  const baseFormula =
    !r ? ""
    : r.salaryType === "foiz"
      ? `${collectedFormula} × ${r.percent ?? 0}%`
      : t("{fixedSalary} × {day}/{daysIn} kun", { fixedSalary: fmtNum(r.fixedSalary ?? 0), day: r.day ?? 0, daysIn: r.daysIn ?? 0 });

  // Soliq chegaraga urganmi (hisoblangan oylikdan oshib ketgan).
  const taxLines = r?.taxLines ?? [];
  const taxRaw = taxLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const taxUsed = Number(r?.tax) || 0;
  const taxCapped = taxRaw > taxUsed;

  return (
    <Modal onClose={onClose} controller={modal} bare zIndex={120} panelClassName="overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border no-print sticky top-0 bg-card">
          <h3 className="text-[15px] font-semibold">{t("Oylik cheki")}</h3>
          <button
            type="button"
            onClick={modal.close}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-secondary"
            aria-label={t("Yopish")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Qog'ozga TUSHADIGAN qism — id chop etish uslubida ishlatiladi. */}
        <div id="salary-receipt-print" className="px-5 py-4">
          <div className="text-center">
            <div className="text-[15px] font-bold tracking-wide">{t("OYLIK CHEKI")}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              № {run.id}-{item.employeeId} · {run.createdAt}
            </div>
            {run.month && (
              <div className="text-[12px] text-muted-foreground">{monthKeyLabel(run.month, months)} uchun</div>
            )}
          </div>

          <Divider />

          <Row label={t("Xodim")} value={name} strong />
          {r?.turi && <Row label={t("Vazifasi")} value={r.turi} />}
          {r && (
            <Row
              label={t("Hisob turi")}
              value={r.salaryType === "foiz" ? t("Foiz {percent}%", { percent: r.percent ?? 0 }) : "Oklad"}
            />
          )}

          {!r ? (
            // Bu maydon qo'shilishidan OLDINGI chiqarishlarda kesim yo'q —
            // o'ylab topilgan raqam ko'rsatilmaydi, rost aytiladi.
            <>
              <Divider />
              <Row label={t("To'langan")} value={t(fmtSum(paid))} tone="total" strong />
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                {t("Bu chiqarish batafsil kesim saqlanishidan oldin o'tkazilgan — tarkibiy qatorlar (asos, bonus, soliq) qayd etilmagan.")}
              </p>
            </>
          ) : (
            <>
              <Divider />

              <Row label={t("Asos")} value={t(fmtSum(r.base ?? 0))} hint={baseFormula ? `(${baseFormula})` : undefined} />
              {(r.bonus ?? 0) > 0 && <Row label={t("Bonus")} value={`+${t(fmtSum(r.bonus ?? 0))}`} tone="plus" />}
              {(r.jarima ?? 0) > 0 && <Row label={t("Jarima")} value={`−${t(fmtSum(r.jarima ?? 0))}`} tone="minus" />}
              <Row label={t("Hisoblangan")} value={t(fmtSum(r.gross ?? 0))} strong />

              {taxLines.length > 0 && (
                <>
                  <Divider />
                  {taxLines.map((l, i) => (
                    <Row
                      key={`${l.name}-${i}`}
                      label={l.name}
                      hint={`(${l.detail})`}
                      value={`−${t(fmtSum(l.amount))}`}
                      tone="minus"
                    />
                  ))}
                  {taxLines.length > 1 && (
                    <Row label={t("Soliq jami")} value={`−${t(fmtSum(taxUsed))}`} tone="minus" strong />
                  )}
                  {taxCapped && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      Soliq hisoblangan oylikdan oshgani uchun {t(fmtSum(taxUsed))} bilan cheklandi.
                    </p>
                  )}
                </>
              )}

              <Divider />

              {(r.paidAvans ?? 0) > 0 && <Row label={t("Avans olingan")} value={`−${t(fmtSum(r.paidAvans ?? 0))}`} tone="minus" />}
              {(r.paidOylik ?? 0) > 0 && (
                <Row label={t("Avval to'langan oylik")} value={`−${t(fmtSum(r.paidOylik ?? 0))}`} tone="minus" />
              )}
              {(r.carryOver ?? 0) !== 0 && (
                <Row
                  label={(r.carryOver ?? 0) > 0 ? t("O'tgan oydan qolgan") : t("O'tgan oydan qarzdorlik")}
                  value={`${(r.carryOver ?? 0) > 0 ? "+" : "−"}${t(fmtSum(Math.abs(r.carryOver ?? 0)))}`}
                  tone={(r.carryOver ?? 0) > 0 ? "plus" : "minus"}
                />
              )}

              {/* Ramka ataylab: chop etishda fon tushmaydi (brauzer sukut
                  bo'yicha fonni bosmaydi), ya'ni bu qator qog'ozda faqat
                  ramka bilan ajralib turadi. */}
              <div className="mt-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold">{t("Qo'lga tegdi")}</span>
                <span className="text-[17px] font-bold tabular-nums">{t(fmtSum(paid))}</span>
              </div>

              {/* KANAL BO'YICHA BO'LINISH — faqat ikki oyoqli chiqarishda.
                  Eski cheklarda bu maydonlar yo'q va ular bitta kanaldan
                  chiqqan; u yerda bo'linishni ko'rsatish o'ylab topilgan
                  raqam bo'lardi. */}
              {(r.paidPlastik ?? 0) > 0 && (
                <div className="mt-1.5 pl-3 space-y-0.5">
                  <Row label={t("↳ kartaga")} value={t(fmtSum(r.paidPlastik ?? 0))} />
                  <Row label={t("↳ naqd")} value={t(fmtSum(r.paidNaqd ?? 0))} />
                </div>
              )}

              {/* Kartaga MO'LJALDAN kam ketgan bo'lsa sababi ochiq
                  aytiladi: qoldiq yetmagan (avans olingan yoki hisoblangan
                  oylik kam). Bu xato emas, arifmetik natija — va bu farq
                  keyingi oyga O'TMAYDI (foydalanuvchi qoidasi, lib/salary.ts).

                  MO'LJAL chekda MUZLATILGAN (`plastikTarget`, 16.09.2026
                  dan): qoida keyin o'zgarsa ham chek o'sha paytdagi raqam
                  bilan solishtiradi. Undan oldingi cheklarda maydon yo'q —
                  ularda o'sha davrning qoidasi (10.09–16.09: oylik summaning
                  DAVRGA to'g'ri keladigan qismi) qayta hisoblanadi, aks holda
                  oy o'rtasidagi eski cheklarda "qoldiq yetmadi" degan yolg'on
                  ogohlantirish chiqardi. */}
              {(() => {
                const full = r.plastikSalary ?? 0;
                const day = r.day ?? 0;
                const daysIn = r.daysIn ?? 0;
                const legacyTarget = daysIn > 0 ? Math.round((full * day) / daysIn) : full;
                const kutilgan = r.plastikTarget ?? (legacyTarget - (r.paidPlastikBefore ?? 0));
                if (full <= 0 || (r.paidPlastik ?? 0) >= kutilgan) return null;
                const prorated = r.plastikTarget === undefined && daysIn > 0 && legacyTarget !== full;
                return (
                  <p className="mt-1.5 text-[11px] text-amber-600">
                    {t("Kartaga {full} mo'ljallangandi", { full: fmtSum(prorated ? legacyTarget : full) })}
                    {prorated && t(" ({full} oylikning {day}/{daysIn} kuni)", { full: fmtSum(full), day, daysIn })}
                    {(r.paidPlastikBefore ?? 0) > 0 && t(", shu oyda avval {paidPlastikBefore} o'tkazilgan", { paidPlastikBefore: fmtSum(r.paidPlastikBefore ?? 0) })}
                    {t(" — lekin qoldiq yetmadi, kartaga {paidPlastik} ketdi.", { paidPlastik: fmtSum(r.paidPlastik ?? 0) })}
                  </p>
                );
              })()}

              {rest !== 0 && (
                <Row
                  label={rest > 0 ? t("To'lanmagan qoldiq") : t("Xodim qarzdorligi")}
                  value={t(fmtSum(Math.abs(rest)))}
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
                {/* Ikki oyoqli chiqarishda `methodLabel` faqat NAQD turini
                    bildiradi — yolg'on bo'lmasligi uchun bu holatda ikkala
                    kanal ham ro'yxatdan chiqariladi. */}
                {run.legs && run.legs.length > 0
                  ? ` · ${run.legs.map((l) => l.label).join(" + ")}`
                  : run.methodLabel ? ` · ${run.methodLabel}` : ""}
              </div>
            )}
            <div>Chiqarish № {run.id} · {run.employeeCount} ta xodim</div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border no-print sticky bottom-0 bg-card">
          <button
            type="button"
            onClick={modal.close}
            className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            {t("Yopish")}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 inline-flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            {t("Chop etish")}
          </button>
        </div>
      </Modal>
  );
}
