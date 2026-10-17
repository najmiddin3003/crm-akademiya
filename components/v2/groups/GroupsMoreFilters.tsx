"use client";

import { useState, type ReactNode } from "react";
import { useT } from "@/components/shared/Language";
import V2Select, { type V2SelectOption } from "@/components/v2/ui/V2Select";
import { GROUP_FORMATS } from "@/constants/groups";
import type { GroupFilters } from "@/lib/groupsList";

// GURUHLAR — «YANA FILTRLAR» OYNASI (O'quvchilar sahifasidagi oyna andozasi:
// design/v2/DESIGN.md → «Sahifa qolipi — ro'yxat», 3-band). Rasmda oyna
// ochilmagan — tarkibi eski sahifadagi qolgan filtrlar (Kun, Toq/Juft, dars
// vaqti oralig'i, Xona) + yangi «Ta'lim turi» (design/v2/SAVOLLAR.md, 42).
// Tanlov QORALAMA — ro'yxat faqat «Qo'llash» bosilganda o'zgaradi.

export const GROUP_MORE_KEYS = ["day", "oddEven", "startTime", "endTime", "room", "eduType"] as const satisfies readonly (keyof GroupFilters)[];

export type GroupMoreKey = (typeof GROUP_MORE_KEYS)[number];
export type GroupMoreFilters = Pick<GroupFilters, GroupMoreKey>;

export const EMPTY_GROUP_MORE: GroupMoreFilters = Object.fromEntries(GROUP_MORE_KEYS.map((k) => [k, ""])) as GroupMoreFilters;

/** Oynadagi filtrlar soni — vaqt oralig'i (dan–gacha) bitta. */
export const GROUP_MORE_TOTAL = 5;

export function countGroupMore(f: GroupMoreFilters): number {
  return (["day", "oddEven", "room", "eduType"] as const).filter((k) => f[k]).length + (f.startTime || f.endTime ? 1 : 0);
}

export function pickGroupMore(f: GroupFilters): GroupMoreFilters {
  return Object.fromEntries(GROUP_MORE_KEYS.map((k) => [k, f[k]])) as GroupMoreFilters;
}

/** 06:00 … 22:00, har 30 daqiqa — dars vaqtlari shu to'rda («14:00 - 16:00»). */
const TIMES: V2SelectOption[] = Array.from({ length: 33 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  const v = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return { value: v, label: v };
});

const toOptions = (list: readonly string[]): V2SelectOption[] => list.map((v) => ({ value: v, label: v }));

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-v2-caption text-v2-text-2">{label}</div>
      {children}
    </div>
  );
}

export default function GroupsMoreFilters({
  applied,
  options,
  onApply,
}: {
  applied: GroupMoreFilters;
  options: { day: string[]; room: string[] };
  onApply: (next: GroupMoreFilters) => void;
}) {
  const { t } = useT();
  // Oyna har ochilganda qayta yaratiladi — qoralama qo'llanganidan boshlanadi.
  const [draft, setDraft] = useState<GroupMoreFilters>(applied);
  const set = (k: GroupMoreKey) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

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
        <span className="text-v2-caption text-v2-text-3">{t("{n} ta filtr", { n: GROUP_MORE_TOTAL })}</span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <section>
          <h4 className="mb-2 text-v2-caption text-v2-text-3">{t("Dars jadvali")}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("Kun")}>
              <V2Select label={t("Kun")} value={draft.day} onChange={set("day")} options={toOptions(options.day)} />
            </Field>
            <Field label={t("Toq/Juft kunlar")}>
              <V2Select
                label={t("Toq/Juft kunlar")}
                value={draft.oddEven}
                onChange={set("oddEven")}
                options={[
                  { value: "Toq", label: "Toq kunlar" },
                  { value: "Juft", label: "Juft kunlar" },
                ]}
                searchable={false}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("Dars vaqti")}>
                <div className="flex items-center gap-2">
                  <V2Select label={`${t("Dars vaqti")} — ${t("dan")}`} placeholder={t("dan")} value={draft.startTime} onChange={set("startTime")} options={TIMES} searchable={false} />
                  <span className="shrink-0 text-v2-text-3" aria-hidden>
                    –
                  </span>
                  <V2Select label={`${t("Dars vaqti")} — ${t("gacha")}`} placeholder={t("gacha")} value={draft.endTime} onChange={set("endTime")} options={TIMES} searchable={false} />
                </div>
              </Field>
            </div>
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-v2-caption text-v2-text-3">{t("Joy va format")}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("Xona")}>
              <V2Select label={t("Xona")} value={draft.room} onChange={set("room")} options={toOptions(options.room)} />
            </Field>
            <Field label={t("Ta'lim turi")}>
              <V2Select label={t("Ta'lim turi")} value={draft.eduType} onChange={set("eduType")} options={toOptions(GROUP_FORMATS)} searchable={false} />
            </Field>
          </div>
        </section>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-v2-border px-4 py-3">
        <span className="mr-auto text-v2-caption text-v2-text-3">{t("Kurs, O'qituvchi va Guruh holati — yuqorida doim ko'rinadi")}</span>
        <button
          type="button"
          onClick={() => setDraft(EMPTY_GROUP_MORE)}
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
