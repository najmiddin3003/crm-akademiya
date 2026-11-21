"use client";

import { CalendarRange, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { MoneyField } from "@/components/v2/form/fields";

// BIR NECHTA OY — «Qaysi oy uchun» da har tanlangan oy uchun summa (21.11.2026; so'rov
// 04.10: "bir nechta oyni tanlashi kerak, tanlangan oy pastida input ochilsin, unga o'sha
// oyga qancha kirim bo'lishini yozsin, bu faqat 1 tadan ko'p oy tanlanganda amal qilsin").
// Holat — components/finance/useKirimForm.ts (monthMode, monthSel, monthAmounts …),
// server — lib/cashboxAdjust.ts → applyCashboxKirimSplit (har oy alohida yozuv, bo'lakda
// `periodMonth`; chek bitta). Ishlatiladi: «To'lov qabul qilish» (StudentPaymentModalV2) va
// «Kassa amali → Kirim» (CashOperationModalV2). Oylar chiplarda tanlanadi (MonthChips,
// `selected`), bu yerda — tanlanganlarning summasi.

function fmtNum(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("ru-RU").replace(/,/g, " ");
}

/** «Qaysi oy uchun» sarlavhasi yonidagi almashtirgich: bitta oy ↔ bir nechta oy. */
export function MonthModeToggle({ on, onChange, disabled }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      disabled={disabled}
      aria-pressed={on}
      className="-mr-1 inline-flex h-7 items-center gap-1.5 rounded-v2-md px-2 text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg disabled:cursor-not-allowed disabled:opacity-50"
    >
      {on ? <X className="size-3.5" strokeWidth={2} aria-hidden /> : <CalendarRange className="size-3.5" strokeWidth={2} aria-hidden />}
      {on ? t("Bitta oy") : t("Bir nechta oy")}
    </button>
  );
}

export default function MonthSplitField({
  selected,
  amounts,
  onChange,
  onRemove,
  target,
  total,
  invalid,
  disabled,
}: {
  /** Tanlangan oylar ("YYYY-MM", o'sish tartibida). */
  selected: string[];
  /** Oy → summa (raqamlar satri). */
  amounts: Record<string, string>;
  onChange: (month: string, value: string) => void;
  /** Oyni ro'yxatdan olib tashlash (oxirgisi qoladi). */
  onRemove: (month: string) => void;
  /** «To'lanishi kerak» — yoqilgan paytdagi Summa; 0 bo'lsa ko'rsatilmaydi. */
  target: number;
  /** Oylar yig'indisi. */
  total: number;
  /** Saqlashga urinilgan, lekin birorta oyga summa yozilmagan. */
  invalid?: boolean;
  disabled?: boolean;
}) {
  const { t, months } = useT();
  const remaining = target > 0 ? target - total : 0;
  const filled = selected.filter((m) => (Number(amounts[m]) || 0) > 0).length;

  return (
    <div>
      <div className={`divide-y divide-v2-border rounded-v2-md border bg-v2-surface ${invalid ? "border-v2-danger" : "border-v2-border"}`}>
        {selected.map((m) => {
          const value = amounts[m] ?? "";
          const empty = !(Number(value) > 0);
          const name = `${months[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`;
          return (
            <div key={m} className="grid grid-cols-[minmax(0,1fr)_minmax(8.5rem,1fr)_auto] items-center gap-2 py-2 pl-3 pr-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 break-words text-v2-small font-medium leading-tight tabular-nums text-v2-text">{name}</span>
                {/* Qolgan summani shu oyga — bitta bosishda (yozilmagan qatorda). */}
                {empty && remaining > 0 && !disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(m, String(remaining))}
                    title={t("Qolgan {sum} so'mni shu oyga yozish", { sum: fmtNum(remaining) })}
                    className="ml-auto inline-flex h-6 shrink-0 items-center rounded-v2-sm px-1.5 text-v2-caption font-medium text-v2-brand-text hover:bg-v2-brand-bg"
                  >
                    {t("Qolgani")}
                  </button>
                )}
              </div>
              <MoneyField compact value={value} onChange={(v) => onChange(m, v)} ariaLabel={name} disabled={disabled} />
              {selected.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onRemove(m)}
                  disabled={disabled}
                  aria-label={t("{month} ni olib tashlash", { month: name })}
                  className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-3 hover:bg-v2-hover hover:text-v2-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="size-4" strokeWidth={1.75} aria-hidden />
                </button>
              ) : (
                <span className="size-8" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
      {/* Yig'indi va «To'lanishi kerak» bilan farq — majburiy emas (qisman to'lov ham bo'ladi). */}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-v2-caption font-normal">
        <span className="text-v2-text-3">
          {filled > 1 ? t("Har oy alohida yozuv bo'lib saqlanadi, chek bitta") : t("Oylarni tanlang va har oyga qancha to'langanini yozing")}
        </span>
        <span className="tabular-nums text-v2-text-2">
          {t("Jami")}: <b className="font-semibold text-v2-text">{fmtNum(total)} {t("so'm")}</b>
          {target > 0 && remaining > 0 && <span className="ml-2 text-v2-warning">{t("yana {sum} qoldi", { sum: `${fmtNum(remaining)} ${t("so'm")}` })}</span>}
          {target > 0 && remaining < 0 && <span className="ml-2 text-v2-warning">{t("{sum} ortiqcha", { sum: `${fmtNum(-remaining)} ${t("so'm")}` })}</span>}
        </span>
      </div>
    </div>
  );
}
