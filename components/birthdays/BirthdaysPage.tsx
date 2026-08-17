"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/components/shared/Language";
import { MONTHS, WEEKDAYS_FULL } from "@/lib/i18n";
import {
  allBirthdays,
  filterByKind,
  byDay,
  byMonth,
  firstWeekdayOffset,
  daysInMonth,
  type PersonKind,
} from "@/lib/birthdays";

// Navbardagi "Tug'ilgan kunlar" tugmasi shu sahifaga olib keladi
// (referens: /hr/birthdays?type=monthly&month=N).
//
// Ikki ko'rinish: OYLIK — dushanbadan boshlanadigan kalendar to'ri, har
// katakda kun raqami va o'sha kuni tug'ilganlar; YILLIK — 12 oy kartasi.
// Oy/kun nomlari navbardagi tilga qarab o'zgaradi (lib/i18n.ts).

const KIND_TABS: { key: PersonKind | "all"; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "student", label: "O'quvchilar" },
  { key: "employee", label: "Xodimlar" },
];

// Katakda ko'rsatiladigan maksimal ism — qolgani "+N Ko'proq" bo'lib yig'iladi
// (referensda ham shunday).
const MAX_PER_DAY = 3;

const tabCls = (active: boolean) =>
  `h-8 px-3.5 rounded-lg text-[13px] font-medium transition-colors ${
    active ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
  }`;

export default function BirthdaysPage() {
  const [lang] = useLang();
  const now = new Date();

  const [kind, setKind] = useState<PersonKind | "all">("all");
  const [view, setView] = useState<"monthly" | "yearly">("monthly");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [openDay, setOpenDay] = useState<number | null>(null);

  const rows = useMemo(() => filterByKind(allBirthdays(), kind), [kind]);
  const dayMap = useMemo(() => byDay(rows, month), [rows, month]);
  const monthLists = useMemo(() => byMonth(rows), [rows]);

  const offset = firstWeekdayOffset(year, month);
  const total = daysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-[18px] font-semibold">Tug&apos;ilgan kunlar</h1>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1 rounded-xl bg-card border border-border p-1.5">
            {KIND_TABS.map((t) => (
              <button key={t.key} onClick={() => setKind(t.key)} className={tabCls(kind === t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl bg-card border border-border p-1.5">
            <button onClick={() => setView("monthly")} className={tabCls(view === "monthly")}>Oylik</button>
            <button onClick={() => setView("yearly")} className={tabCls(view === "yearly")}>Yillik</button>
          </div>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {view === "monthly" && (
            <select
              value={month}
              onChange={(e) => { setMonth(Number(e.target.value)); setOpenDay(null); }}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {MONTHS[lang].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      {view === "monthly" ? (
        <div className="rounded-2xl bg-card border border-border p-3">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {WEEKDAYS_FULL[lang].map((d) => (
              <div key={d} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center truncate">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((day, i) => {
              if (day === null) return <div key={`b${i}`} className="min-h-[104px] rounded-xl bg-secondary/30" />;
              const list = dayMap.get(day) ?? [];
              const shown = openDay === day ? list : list.slice(0, MAX_PER_DAY);
              const rest = list.length - shown.length;
              return (
                <div key={day} className="min-h-[104px] rounded-xl border border-border p-2 flex flex-col gap-1">
                  <div className="text-[12px] font-semibold text-muted-foreground">{day}</div>
                  {shown.map((p) => (
                    <div
                      key={`${p.kind}-${p.id}`}
                      title={`${p.name} — ${p.kind === "employee" ? "Xodim" : "O'quvchi"}`}
                      className={`text-[11px] leading-tight truncate ${p.kind === "employee" ? "text-amber-600" : "text-primary"}`}
                    >
                      {p.name}
                    </div>
                  ))}
                  {rest > 0 && (
                    <button
                      onClick={() => setOpenDay(day)}
                      className="text-[11px] text-muted-foreground hover:text-primary text-left"
                    >
                      +{rest} Ko&apos;proq
                    </button>
                  )}
                  {openDay === day && list.length > MAX_PER_DAY && (
                    <button
                      onClick={() => setOpenDay(null)}
                      className="text-[11px] text-muted-foreground hover:text-primary text-left"
                    >
                      Yig&apos;ish
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
          {MONTHS[lang].map((name, i) => {
            const list = monthLists[i];
            return (
              <div key={name} className="rounded-2xl bg-card border border-border p-4">
                <div className="text-[14px] font-semibold mb-2">{name}</div>
                {list.length === 0 ? (
                  <div className="text-[12px] text-muted-foreground">Ma&apos;lumot yo&apos;q</div>
                ) : (
                  <ul className="space-y-1">
                    {list.slice(0, 8).map((p) => (
                      <li key={`${p.kind}-${p.id}`} className="flex items-center gap-2 text-[12px]">
                        <span className="tabular-nums text-muted-foreground w-5 shrink-0">{p.day}</span>
                        <span className={`truncate ${p.kind === "employee" ? "text-amber-600" : ""}`}>{p.name}</span>
                      </li>
                    ))}
                    {list.length > 8 && (
                      <li className="text-[11px] text-muted-foreground">+{list.length - 8} Ko&apos;proq</li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
