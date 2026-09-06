"use client";

import { useState } from "react";
import { X } from "lucide-react";
import MoneyInput from "@/components/ui/MoneyInput";

// Boshqaruv → Xodimlar jadvalidagi PLASTIK tugmachasi bosilganda chiqadigan
// oyna: xodimga plastik karta orqali beriladigan oylik summasi.
//
// SOLIQ OYNASIDAN FARQI — bu yerda TANLOV YO'Q, summa QO'LDA yoziladi.
// Sabab: har kimda har xil (2 000 000, 4 000 000, 1 750 000) va ularni
// Sozlamalarda oldindan sanab chiqib bo'lmaydi. Shu bois EmployeeTaxModal
// dagi ro'yxat yuklash, nofaol yozuvlarni filtrlash va boshlang'ich
// tanlovni muzlatish murakkabligi bu yerda KERAK EMAS.
//
// Kiritilgan summa IKKI ishga ketadi (lib/hrEmployees.ts izohiga qarang):
// "Plastik qismidan" bazali soliqning asosi, va oylik chiqarishda karta
// oyog'ining maqsadi.

export default function EmployeePlastikModal({
  employeeName,
  current,
  onClose,
  onSave,
}: {
  employeeName: string;
  /** Hozirgi summa; `null` — biriktirilmagan. */
  current: number | null;
  onClose: () => void;
  onSave: (next: number | null) => Promise<void> | void;
}) {
  // DIQQAT: `current ? String(current) : ""` YOZILMAYDI. 0 ham, null ham
  // bo'sh satrga aylanib ketardi va "biriktirilmagan" bilan "0 so'm"
  // farqi yo'qolardi. (EmployeeSalaryConfigModal da aynan shu naqsh xato
  // sifatida turibdi — takrorlanmasin.)
  const [digits, setDigits] = useState<string>(current == null ? "" : String(current));
  const [saving, setSaving] = useState(false);

  const amount = digits === "" ? null : Number(digits);
  const invalid = amount !== null && !(amount > 0);

  async function save(next: number | null) {
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-[15px] font-semibold">Plastik oylik</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">{employeeName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-secondary"
            aria-label="Yopish"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-[12.5px] text-muted-foreground">
            Bu xodimga oyiga plastik karta orqali qancha o&apos;tkaziladi? Qolgan qismi naqd beriladi.
          </p>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium" htmlFor="plastik-amount">
              Oyiga
            </label>
            <div className="relative">
              <MoneyInput
                id="plastik-amount"
                value={digits}
                onChange={setDigits}
                placeholder="2 000 000"
                autoFocus
                className="h-10 w-full rounded-lg border border-border bg-card pl-3 pr-14 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                so&apos;m
              </span>
            </div>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Soliq shu summadan hisoblanadi (Sozlamalar &rarr; Moliya &rarr; Soliq da
            &ldquo;Plastik qismidan&rdquo; asosi tanlangan qoidalar bo&apos;yicha) va jami
            oylikdan ushlanadi &mdash; kartaga aynan yozilgan summa tushadi.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-border">
          {/* Biriktirishni butunlay olib tashlash — bo'sh maydonni saqlash
              bilan bir xil natija, lekin niyat ochiq ko'rinib turadi. */}
          <button
            type="button"
            onClick={() => save(null)}
            disabled={saving || current == null}
            className="h-9 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary disabled:opacity-40"
          >
            Biriktirilmagan qilish
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={() => save(amount)}
              disabled={saving || invalid}
              className="h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
