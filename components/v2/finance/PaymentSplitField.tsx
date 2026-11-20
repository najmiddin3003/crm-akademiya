"use client";

import { Split, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { MoneyField, methodDot } from "@/components/v2/form/fields";
import type { PaymentMethod } from "@/lib/paymentMethods";

// ARALASH TO'LOV — «To'lov turi» o'rnida har tur uchun summa (20.11.2026, foydalanuvchi:
// "o'quvchi karta 100 000, naqd 100 000 to'laydi — 2 ta kirim qilishga to'g'ri kelyapti").
// Holat va saqlash — components/finance/useKirimForm.ts (splitMode, splitAmounts …),
// server — lib/cashboxAdjust.ts → applyCashboxKirimSplit (har tur alohida yozuv,
// umumiy kalit bilan; SMS va bot xabari bitta). Ishlatiladi: «To'lov qabul qilish»
// (StudentPaymentModalV2) va «Kassa amali → Kirim» (CashOperationModalV2).

function fmtNum(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("ru-RU").replace(/,/g, " ");
}

/** «To'lov turi» sarlavhasi yonidagi almashtirgich: bitta tur ↔ bir nechta tur. */
export function SplitToggle({ on, onChange, disabled }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      disabled={disabled}
      aria-pressed={on}
      className="-mr-1 inline-flex h-7 items-center gap-1.5 rounded-v2-md px-2 text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg disabled:cursor-not-allowed disabled:opacity-50"
    >
      {on ? <X className="size-3.5" strokeWidth={2} aria-hidden /> : <Split className="size-3.5" strokeWidth={2} aria-hidden />}
      {on ? t("Bitta to'lov turi") : t("Bir nechta to'lov turi")}
    </button>
  );
}

export default function PaymentSplitField({
  methods,
  amounts,
  onChange,
  target,
  total,
  invalid,
  disabled,
}: {
  /** Faol to'lov turlari (sozlamadagi tartibda). */
  methods: PaymentMethod[];
  /** Tur kaliti → summa (raqamlar satri). */
  amounts: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** «To'lanishi kerak» — yoqilgan paytdagi Summa; 0 bo'lsa ko'rsatilmaydi. */
  target: number;
  /** Bo'laklar yig'indisi. */
  total: number;
  /** Saqlashga urinilgan, lekin birorta tur to'ldirilmagan. */
  invalid?: boolean;
  disabled?: boolean;
}) {
  const { t } = useT();
  const remaining = target > 0 ? target - total : 0;
  const filled = methods.filter((m) => (Number(amounts[m.key]) || 0) > 0).length;

  return (
    <div>
      <div className={`divide-y divide-v2-border rounded-v2-md border bg-v2-surface ${invalid ? "border-v2-danger" : "border-v2-border"}`}>
        {methods.map((m) => {
          const value = amounts[m.key] ?? "";
          const empty = !(Number(value) > 0);
          return (
            <div key={m.key} className="grid grid-cols-[minmax(0,1fr)_minmax(8.5rem,1fr)] items-center gap-3 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`size-2 shrink-0 rounded-full ${methodDot(m.key)}`} aria-hidden />
                {/* Nom kesilmaydi («Korporativ karta» tor ekranda ikki qatorga o'tadi) — 20.11.2026 egasi: «ko'zga ko'rinadigan qil». */}
                <span className="min-w-0 break-words text-v2-small font-medium leading-tight text-v2-text">{t(m.name)}</span>
                {/* Qolgan summani shu turga — bitta bosishda (yozilmagan qatorda). */}
                {empty && remaining > 0 && !disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(m.key, String(remaining))}
                    title={t("Qolgan {sum} so'mni shu turga yozish", { sum: fmtNum(remaining) })}
                    className="ml-auto inline-flex h-6 shrink-0 items-center rounded-v2-sm px-1.5 text-v2-caption font-medium text-v2-brand-text hover:bg-v2-brand-bg"
                  >
                    {t("Qolgani")}
                  </button>
                )}
              </div>
              <MoneyField compact value={value} onChange={(v) => onChange(m.key, v)} ariaLabel={t(m.name)} disabled={disabled} />
            </div>
          );
        })}
      </div>
      {/* Yig'indi va «To'lanishi kerak» bilan farq — majburiy emas (qisman to'lov ham bo'ladi). */}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-v2-caption font-normal">
        <span className="text-v2-text-3">
          {filled > 1 ? t("Har to'lov turi alohida yozuv bo'lib saqlanadi, chek bitta") : t("Har to'lov turiga qancha to'langanini yozing")}
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
