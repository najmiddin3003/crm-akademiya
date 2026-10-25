"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Pencil, Plus } from "lucide-react";
import { useT } from "@/components/shared/Language";
import V2Picker, { type PickerOption } from "@/components/v2/form/V2Picker";
import { fieldCls, type FieldState } from "@/components/v2/form/fields";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import type { Group } from "@/lib/groups";
import { blockSubjects, schemeMax, type UbConfig, type UbScheme, type UbTestRow } from "@/lib/uzbmb";
import { dirLabel, fmtNum, groupLabelOf, isoToDate, type Dir } from "./ubCore";

// YANGI VERSIYA — UZBMB TANLAGICHLARI (rasm «UzBMB · Natija kiritish», 25.10.2026): Test (ostida
// «+ Yangi test» / «Testni tahrirlash»), Guruh (natija kiritilganlari birinchi), Yo'nalish (1-blok va
// 2-blok fani — ikki ustunli ro'yxat), «Maks. ball» qutisi («189 = 93 + 63 + 33»).

/** Maydon yorlig'i (rasmdagi «Yo'nalish [avto]»). */
export function FilterLabel({ children, error = false, auto = false }: { children: ReactNode; error?: boolean; auto?: boolean }) {
  const { t } = useT();
  return (
    <div className={`mb-1.5 flex h-5 items-center gap-1.5 text-v2-small ${error ? "text-v2-danger" : "text-v2-text-2"}`}>
      {children}
      {auto && <span className="rounded-v2-sm bg-v2-brand-bg px-1.5 text-[11px] font-medium leading-4 text-v2-brand-text">{t("avto")}</span>}
    </div>
  );
}

const footBtn =
  "inline-flex h-7 items-center gap-1.5 rounded-v2-sm px-1.5 font-medium text-v2-brand-text hover:bg-v2-brand-bg focus-visible:outline-none focus-visible:shadow-v2-focus";

export function TestPicker({
  tests,
  value,
  onChange,
  withDate = false,
  onNew,
  onEdit,
  loading = false,
  state = "default",
}: {
  tests: UbTestRow[];
  value: number | null;
  onChange: (id: number) => void;
  /** Natijalar ko'rinishida nomi yonida sana («… №3 · 10-oktabr»). */
  withDate?: boolean;
  onNew?: () => void;
  onEdit?: (t: UbTestRow) => void;
  loading?: boolean;
  state?: FieldState;
}) {
  const { t, lang } = useT();
  const options = useMemo<PickerOption[]>(
    () =>
      tests.map((x) => {
        const d = isoToDate(x.date);
        const day = d ? dayMonthLabel(d, lang) : x.date;
        return {
          value: String(x.id),
          label: withDate ? `${x.name} · ${day}` : x.name,
          sublabel: [withDate ? null : day, x.resultCount ? t("{n} natija · {g} guruh", { n: x.resultCount, g: x.groupCount }) : t("natija yo'q")].filter(Boolean).join(" · "),
          keywords: `${x.no} ${day}`,
        };
      }),
    [tests, withDate, lang, t],
  );
  const current = tests.find((x) => x.id === value) ?? null;
  return (
    <V2Picker
      size="sm"
      label={t("Test")}
      value={value === null ? "" : String(value)}
      onChange={(v) => onChange(Number(v))}
      options={options}
      loading={loading}
      placeholder={tests.length ? t("Testni tanlang") : t("Hali test yo'q")}
      searchPlaceholder={t("Testni qidirish")}
      emptyText={t("Test topilmadi")}
      width={340}
      state={state}
      renderValue={(o) => <span className="font-semibold text-v2-text">{o.label}</span>}
      footer={
        onNew || onEdit
          ? (close) => (
              <>
                {onNew ? (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onNew();
                    }}
                    className={footBtn}
                  >
                    <Plus className="size-3.5" strokeWidth={2} aria-hidden />
                    {t("Yangi test")}
                  </button>
                ) : (
                  <span />
                )}
                {onEdit && current && (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onEdit(current);
                    }}
                    className={`${footBtn} text-v2-text-2 hover:bg-v2-surface-2`}
                  >
                    <Pencil className="size-3.5" strokeWidth={1.75} aria-hidden />
                    {t("Testni tahrirlash")}
                  </button>
                )}
              </>
            )
          : undefined
      }
    />
  );
}

export function GroupPicker({
  groups,
  value,
  onChange,
  counts,
  loading = false,
  state = "default",
}: {
  groups: Group[];
  value: number | null;
  onChange: (id: number) => void;
  /** Shu testda guruh bilan saqlangan natijalar soni — ular ro'yxat boshida. */
  counts: Map<number, number>;
  loading?: boolean;
  state?: FieldState;
}) {
  const { t } = useT();
  const options = useMemo<PickerOption[]>(() => {
    const live = groups.filter((g) => g.status !== "archive");
    const withRes = live.filter((g) => (counts.get(g.id) ?? 0) > 0).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
    const rest = live.filter((g) => !(counts.get(g.id) ?? 0)).sort((a, b) => groupLabelOf(a).localeCompare(groupLabelOf(b), "uz"));
    const opt = (g: Group, heading?: string): PickerOption => ({
      value: String(g.id),
      label: groupLabelOf(g),
      sublabel: g.teacher || undefined,
      hint: counts.get(g.id) ? t("{n} natija", { n: counts.get(g.id) ?? 0 }) : t("{n} o'quvchi", { n: g.studentIds?.length ?? g.students ?? 0 }),
      lead: <span className={`mt-1 size-2 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />,
      group: heading,
      keywords: `${g.name} ${g.teacher} ${g.course} ${g.level}`,
    });
    return [...withRes.map((g) => opt(g, t("Natija kiritilgan"))), ...rest.map((g) => opt(g, withRes.length ? t("Boshqa guruhlar") : undefined))];
  }, [groups, counts, t]);
  return (
    <V2Picker
      size="sm"
      label={t("Guruh")}
      value={value === null ? "" : String(value)}
      onChange={(v) => onChange(Number(v))}
      options={options}
      loading={loading && !options.length}
      placeholder={t("Guruhni tanlang")}
      searchable
      searchPlaceholder={t("Guruh yoki o'qituvchi")}
      emptyText={t("Guruh topilmadi")}
      width={360}
      state={state}
      renderValue={(o) => <span className="font-semibold text-v2-text">{o.label}</span>}
    />
  );
}

/**
 * Yo'nalish — ikki ustun: 1-blok va 2-blok fani (sozlamadagi blok fanlari). 2-blok tanlangach
 * (ikkalasi ham bo'lsa) yopiladi; bir xil fan ikkala blokda bo'lmaydi.
 */
export function DirectionPicker({ config, value, onChange, state = "default" }: { config: UbConfig | null; value: Dir; onChange: (d: Dir) => void; state?: FieldState }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const subjects = useMemo(() => {
    const list = config ? blockSubjects(config).map((s) => s.name) : [];
    // Sozlamada faolsizlantirilgan, lekin shu varaqda saqlangan fan ham ko'rinsin.
    for (const name of [value.b1s, value.b2s]) if (name && !list.includes(name)) list.push(name);
    return list;
  }, [config, value.b1s, value.b2s]);

  const column = (title: string, key: "b1s" | "b2s") => (
    <div className="min-w-0 flex-1">
      <div className="px-2.5 pb-1 pt-2 text-v2-caption text-v2-text-3">{title}</div>
      <div role="listbox" aria-label={title} className="space-y-px">
        {subjects.map((name) => {
          const on = value[key] === name;
          const other = key === "b1s" ? value.b2s : value.b1s;
          const taken = other === name;
          return (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => {
                const next = { ...value, [key]: name };
                // Bir xil fan ikkinchi blokda turgan bo'lsa — o'sha bo'shaydi.
                if (taken) next[key === "b1s" ? "b2s" : "b1s"] = "";
                onChange(next);
                if (key === "b2s" && next.b1s && next.b2s) {
                  setOpen(false);
                  btnRef.current?.focus();
                }
              }}
              className={`flex w-full items-center gap-2 rounded-v2-md px-2.5 py-1.5 text-left text-v2-small transition-colors ${
                on ? "bg-v2-brand-bg font-semibold text-v2-text" : "text-v2-text hover:bg-v2-surface-2"
              } ${taken && !on ? "text-v2-text-3" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate">{name}</span>
              {on && <Check className="size-4 shrink-0 text-v2-brand-text" strokeWidth={2} aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("Yo'nalish")}
        disabled={!config}
        onClick={() => setOpen((o) => !o)}
        className={fieldCls(state, `flex items-center gap-2 text-left ${open ? "border-v2-brand shadow-v2-focus" : ""}`, "sm")}
      >
        <span className="min-w-0 flex-1 truncate text-v2-body">
          {value.b1s || value.b2s ? <span className="font-semibold text-v2-text">{dirLabel(value) || `… — ${value.b2s}`}</span> : <span className="text-v2-text-3">{t("Yo'nalishni tanlang")}</span>}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </button>
      <FloatingPanel open={open} anchorRef={btnRef} onClose={() => setOpen(false)} width={380} maxHeight={380} role="dialog" ariaLabel={t("Yo'nalish")}>
        <div className="flex min-h-0 flex-1 gap-1 overflow-y-auto p-1">
          {column(t("1-blok fani"), "b1s")}
          <span className="w-px shrink-0 self-stretch bg-v2-border" aria-hidden />
          {column(t("2-blok fani"), "b2s")}
        </div>
        <div className="shrink-0 border-t border-v2-border px-3 py-2 text-v2-caption text-v2-text-3">{t("Fanlar ro'yxati — Sozlamalar → Imtihon fanlari")}</div>
      </FloatingPanel>
    </>
  );
}

/** «189 = 93 + 63 + 33» — testning ball tuzilishi (o'zgarmaydi). */
export function MaxBallBox({ scheme }: { scheme: UbScheme | null }) {
  const { t, lang } = useT();
  const max = scheme ? schemeMax(scheme) : null;
  return (
    <div className="flex h-9 items-center gap-2 rounded-v2-md border border-v2-border bg-v2-surface px-3" aria-label={t("Maks. ball")}>
      {max ? (
        <>
          <span className="text-v2-body font-semibold tabular-nums text-v2-text">{fmtNum(max.total, lang)}</span>
          <span className="truncate text-v2-caption font-normal tabular-nums text-v2-text-3">
            = {fmtNum(max.b1, lang)} + {fmtNum(max.b2, lang)} + {fmtNum(max.maj, lang)}
          </span>
        </>
      ) : (
        <span className="text-v2-small text-v2-text-3">—</span>
      )}
    </div>
  );
}
