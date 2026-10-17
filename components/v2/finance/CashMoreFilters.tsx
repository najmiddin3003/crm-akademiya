"use client";

import { useState, type ReactNode } from "react";
import { useT } from "@/components/shared/Language";
import V2Select from "@/components/v2/ui/V2Select";

// KASSALAR → TRANZAKSIYALAR — «YANA» OYNASI. Rasmda oyna ochilmagan; tarkibi
// eski sahifadagi qolgan filtrlar: Tranzaksiya turi (katalogdagi nom), ustoz
// («Oyligiga» — kimning oyligiga ta'sir qiladi) va yangi «Holati» (tasdiq
// kutayotgan ko'chirmalar / bekor qilinganlar). Qoralama — «Qo'llash» bilan.

export interface CashMore {
  txName: string;
  teacher: string;
  /** "" | "waiting" | "cancelled" */
  status: string;
}

export const EMPTY_CASH_MORE: CashMore = { txName: "", teacher: "", status: "" };

export function countCashMore(f: CashMore): number {
  return (["txName", "teacher", "status"] as const).filter((k) => f[k]).length;
}

export const CASH_STATUS_OPTIONS = [
  { value: "waiting", label: "Tasdiq kutmoqda" },
  { value: "cancelled", label: "Bekor qilingan" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-v2-caption text-v2-text-2">{label}</div>
      {children}
    </div>
  );
}

export default function CashMoreFilters({
  applied,
  txNames,
  teachers,
  onApply,
}: {
  applied: CashMore;
  txNames: string[];
  teachers: string[];
  onApply: (next: CashMore) => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState<CashMore>(applied);
  const set = (k: keyof CashMore) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
      className="flex min-h-0 flex-col"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-v2-border px-4 py-3">
        <h3 className="text-v2-section text-v2-text">{t("Qo'shimcha filtrlar")}</h3>
        <span className="text-v2-caption text-v2-text-3">{t("{n} ta filtr", { n: 3 })}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <Field label={t("Tranzaksiya turi")}>
          <V2Select label={t("Tranzaksiya turi")} value={draft.txName} onChange={set("txName")} options={txNames.map((v) => ({ value: v, label: v }))} />
        </Field>
        <Field label={t("Oyligiga (ustoz)")}>
          <V2Select label={t("Oyligiga (ustoz)")} value={draft.teacher} onChange={set("teacher")} options={teachers.map((v) => ({ value: v, label: v }))} />
        </Field>
        <Field label={t("Holati")}>
          <V2Select label={t("Holati")} value={draft.status} onChange={set("status")} options={CASH_STATUS_OPTIONS} searchable={false} />
        </Field>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-v2-border px-4 py-3">
        <button
          type="button"
          onClick={() => setDraft(EMPTY_CASH_MORE)}
          className="ml-auto inline-flex h-9 items-center rounded-v2-md px-3 text-v2-body font-medium text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text"
        >
          {t("Tozalash")}
        </button>
        <button type="submit" className="inline-flex h-9 items-center rounded-v2-md bg-v2-brand px-4 text-v2-body font-semibold text-v2-on-brand transition-[filter] hover:brightness-95">
          {t("Qo'llash")}
        </button>
      </div>
    </form>
  );
}
