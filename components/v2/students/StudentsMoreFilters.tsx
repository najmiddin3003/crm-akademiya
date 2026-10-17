"use client";

import { useState, type ReactNode } from "react";
import { useT } from "@/components/shared/Language";
import V2Select, { type V2SelectOption } from "@/components/v2/ui/V2Select";
import type { StudentFilters } from "@/lib/studentsData";

// «YANA FILTRLAR» OYNASI (design/v2/DESIGN.md → «Sahifa qolipi — ro'yxat», 3-band):
// «Qo'shimcha filtrlar · 10 ta filtr», bo'limlar O'quv / Manba va mas'ul /
// Oraliqlar, pastda izoh, «Tozalash» va «Qo'llash». Tanlov oynada QORALAMA —
// ro'yxat faqat «Qo'llash» bosilganda o'zgaradi (DESIGN → «Filtr paneli»).
// «Tozalash» faqat qoralamani bo'shatadi; yuqoridagi Kurs/Guruh/Holati tegilmaydi.

/** Oynadagi filtrlar — yuqoridagi uchtasi (Kurs, Guruh, Holati) va qidiruv bu yerda yo'q. */
export const MORE_FILTER_KEYS = [
  "teacher",
  "subcourse",
  "category",
  "groupCount",
  "day",
  "oddEven",
  "source",
  "moderator",
  "balanceFrom",
  "balanceTo",
  "coinFrom",
  "coinTo",
] as const satisfies readonly (keyof StudentFilters)[];

export type MoreFilterKey = (typeof MORE_FILTER_KEYS)[number];
export type MoreFilters = Pick<StudentFilters, MoreFilterKey>;

export const EMPTY_MORE_FILTERS: MoreFilters = Object.fromEntries(MORE_FILTER_KEYS.map((k) => [k, ""])) as MoreFilters;

/** Nechta filtr qo'llangan — oraliq (dan–gacha) bitta hisoblanadi. 10 tadan. */
export function countMoreFilters(f: MoreFilters): number {
  const singles = (["teacher", "subcourse", "category", "groupCount", "day", "oddEven", "source", "moderator"] as const).filter((k) => f[k]).length;
  return singles + (f.balanceFrom || f.balanceTo ? 1 : 0) + (f.coinFrom || f.coinTo ? 1 : 0);
}

export function pickMoreFilters(f: StudentFilters): MoreFilters {
  return Object.fromEntries(MORE_FILTER_KEYS.map((k) => [k, f[k]])) as MoreFilters;
}

export interface MoreFilterOptions {
  teacher: string[];
  subcourse: string[];
  category: string[];
  day: string[];
  source: string[];
  moderator: string[];
}

const toOptions = (list: readonly string[]): V2SelectOption[] => list.map((v) => ({ value: v, label: v }));

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-v2-caption text-v2-text-2">{label}</div>
      {children}
    </div>
  );
}

const inputCls =
  "h-9 w-full min-w-0 rounded-v2-md border border-v2-border-field bg-v2-surface! px-3 text-v2-body tabular-nums text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none";

function Range({
  label,
  from,
  to,
  onFrom,
  onTo,
  negative = false,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  /** Balans manfiy bo'lishi mumkin (qarz). */
  negative?: boolean;
}) {
  const { t } = useT();
  const clean = (v: string) => (negative ? v.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "") : v.replace(/\D/g, ""));
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input value={from} onChange={(e) => onFrom(clean(e.target.value))} inputMode="numeric" placeholder={t("dan")} aria-label={`${label} — ${t("dan")}`} className={inputCls} />
        <span className="shrink-0 text-v2-text-3" aria-hidden>
          –
        </span>
        <input value={to} onChange={(e) => onTo(clean(e.target.value))} inputMode="numeric" placeholder={t("gacha")} aria-label={`${label} — ${t("gacha")}`} className={inputCls} />
      </div>
    </Field>
  );
}

export default function StudentsMoreFilters({
  applied,
  options,
  onApply,
}: {
  applied: MoreFilters;
  options: MoreFilterOptions;
  onApply: (next: MoreFilters) => void;
}) {
  const { t } = useT();
  // Oyna har ochilganda qayta yaratiladi (FloatingPanel yopiqda chizilmaydi) —
  // qoralama doim qo'llanganidan boshlanadi.
  const [draft, setDraft] = useState<MoreFilters>(applied);
  const set = (k: MoreFilterKey) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

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
        <span className="text-v2-caption text-v2-text-3">{t("{n} ta filtr", { n: 10 })}</span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <section>
          <h4 className="mb-2 text-v2-caption text-v2-text-3">{t("O'quv")}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("O'qituvchi")}>
              <V2Select label={t("O'qituvchi")} value={draft.teacher} onChange={set("teacher")} options={toOptions(options.teacher)} />
            </Field>
            <Field label={t("Subkurs")}>
              <V2Select label={t("Subkurs")} value={draft.subcourse} onChange={set("subcourse")} options={toOptions(options.subcourse)} />
            </Field>
            <Field label={t("Kategoriya")}>
              <V2Select label={t("Kategoriya")} value={draft.category} onChange={set("category")} options={toOptions(options.category)} />
            </Field>
            <Field label={t("Guruhlar soni")}>
              <V2Select label={t("Guruhlar soni")} value={draft.groupCount} onChange={set("groupCount")} options={toOptions(["0", "1", "2"])} searchable={false} />
            </Field>
            <Field label={t("Kun")}>
              <V2Select label={t("Kun")} value={draft.day} onChange={set("day")} options={toOptions(options.day)} />
            </Field>
            <Field label={t("Toq/Juft kunlar")}>
              <V2Select label={t("Toq/Juft kunlar")} value={draft.oddEven} onChange={set("oddEven")} options={toOptions(["Toq", "Juft"])} searchable={false} />
            </Field>
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-v2-caption text-v2-text-3">{t("Manba va mas'ul")}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("Manba")}>
              <V2Select label={t("Manba")} value={draft.source} onChange={set("source")} options={toOptions(options.source)} />
            </Field>
            <Field label={t("Moderator")}>
              <V2Select label={t("Moderator")} value={draft.moderator} onChange={set("moderator")} options={toOptions(options.moderator)} />
            </Field>
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-v2-caption text-v2-text-3">{t("Oraliqlar")}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Range label={t("Balans, so'm")} from={draft.balanceFrom} to={draft.balanceTo} onFrom={set("balanceFrom")} onTo={set("balanceTo")} negative />
            <Range label={t("Tanga")} from={draft.coinFrom} to={draft.coinTo} onFrom={set("coinFrom")} onTo={set("coinTo")} />
          </div>
        </section>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-v2-border px-4 py-3">
        <span className="mr-auto text-v2-caption text-v2-text-3">{t("Kurs, Guruh va Holati — yuqorida doim ko'rinadi")}</span>
        <button
          type="button"
          onClick={() => setDraft(EMPTY_MORE_FILTERS)}
          className="inline-flex h-9 items-center rounded-v2-md px-3 text-v2-body font-medium text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text"
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
