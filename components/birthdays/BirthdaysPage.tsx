"use client";

import { useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { useLang } from "@/components/shared/Language";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useStudents } from "@/hooks/useStudents";
import { useStaff } from "@/hooks/useStaff";
import { MONTHS, WEEKDAYS_FULL } from "@/lib/i18n";
import { pupilFullName } from "@/lib/pupilsData";
import type { HrEmployeeFull } from "@/components/employees/employeeExtras";
import {
  buildBirthdays,
  filterByKind,
  byDay,
  byMonth,
  firstWeekdayOffset,
  daysInMonth,
  type PersonKind,
  type BirthdayPerson,
} from "@/lib/birthdays";

/** Ism bosilganda ochiladigan profil sahifasi. */
function profileHref(p: BirthdayPerson): string {
  return p.kind === "employee" ? `/management-xodimlar/${p.id}` : `/student-edit/${p.id}`;
}

// Navbardagi "Tug'ilgan kunlar" tugmasi shu sahifaga olib keladi
// (referens: /hr/birthdays?type=monthly&month=N).
//
// ILGARI: kalendardagi hamma sana lib/birthdays.ts dagi xesh-generatordan
// kelardi (`id * 2654435761` dan oy/kun/yil), odamlar esa demo buyurtma
// ro'yxati va statik xodimlar massividan olinardi — ya'ni birorta ham
// haqiqiy tug'ilgan kun ko'rsatilmasdi.
//
// ENDI: o'quvchilar /api/pupils dan (pupils.birthDate), xodimlar
// /api/hr-employees dan (hr_employees.birthDate) o'qiladi va faqat sanasi
// HAQIQATAN kiritilganlar chiqadi. Bazada sana kiritilmagan bo'lsa kalendar
// bo'sh turadi va buning sababi ekranda yozib qo'yiladi.
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
  const today = now;

  // `birthDate` standart to'plamda YO'Q — ataylab so'raymiz.
  // Tug'ilgan sanasi KIRITILGANLAR serverda ajratiladi — ilgari 6 747
  // o'quvchi tortilib, 14 tasi qolardi.
  const { pupils, loading: pupilsLoading } = useStudents({ extra: ["birthDate"] as const, hasBirthDate: true });
  const { employees, loading: staffLoading } = useStaff();
  const loading = pupilsLoading || staffLoading;

  const [kind, setKind] = useState<PersonKind | "all">("all");
  const [view, setView] = useState<"monthly" | "yearly">("monthly");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  // Katak bosilganda o'sha kunning to'liq ro'yxati modalda ochiladi
  // (referensda ham shunday — katakda faqat 3 ta ism sig'adi).
  const [openDay, setOpenDay] = useState<number | null>(null);
  useEscapeClose(openDay !== null ? () => setOpenDay(null) : () => {});

  const all = useMemo(() => {
    const studentSources = pupils.map((p) => ({
      id: p.id,
      name: pupilFullName(p),
      phone: p.phone,
      birthDate: p.birthDate,
    }));
    // `birthDate` hujjatda bor, ammo `HrEmployee` interfeysida hali e'lon
    // qilinmagan (components/employees/employeeExtras.ts izohiga qarang).
    // Arxivdagi xodim ro'yxatda ko'rinmaydi.
    const employeeSources = (employees as HrEmployeeFull[])
      .filter((e) => !e.archReason)
      .map((e) => ({ id: e.id, name: e.name, phone: e.phone, birthDate: e.birthDate }));
    return buildBirthdays(studentSources, employeeSources);
  }, [pupils, employees]);

  const rows = useMemo(() => filterByKind(all, kind), [all, kind]);
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

        {/* Tartib referensdagidek: yil → oy → kim → ko'rinish */}
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
      </div>

      {/* Ma'lumot kelmasdan turib "hech kim yo'q" deyilmaydi: avval
          yuklanmoqda, javob kelgach — rostdan bo'sh bo'lsa sababi bilan. */}
      {loading ? (
        <div className="rounded-[10px] border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
          Yuklanmoqda…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-[13px]">
          {kind === "employee"
            ? "Hech bir xodimga tug'ilgan sana kiritilmagan — sanani \"Xodim qo'shish\" oynasida yoki xodim profilida saqlang."
            : kind === "student"
              ? "Hech bir o'quvchiga tug'ilgan sana kiritilmagan — sanani o'quvchi profilidagi \"Tahrirlash\" tabida saqlang."
              : "Bazada hali birorta tug'ilgan sana yo'q. O'quvchiniki — profildagi \"Tahrirlash\" tabida, xodimniki — xodim kartasida saqlanadi."}
        </div>
      ) : null}

      {/* Referensda hafta sarlavhalari ALOHIDA ramkali blokda, kun kataklari
          esa to'g'ridan-to'g'ri sahifa fonida (umumiy karta yo'q). */}
      {view === "monthly" ? (
        <div className="space-y-3">
          <div className="bd-week rounded-[10px] bg-card border border-border p-5">
            {WEEKDAYS_FULL[lang].map((d) => (
              <div key={d} className="bd-head truncate">{d}</div>
            ))}
          </div>
          <div className="bd-week">
            {cells.map((day, i) => {
              if (day === null) return <div key={`b${i}`} className="bd-cell is-blank" />;
              const list = dayMap.get(day) ?? [];
              const shown = list.slice(0, MAX_PER_DAY);
              const rest = list.length - shown.length;
              const isToday =
                day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
              return (
                <div
                  key={day}
                  onClick={() => list.length > 0 && setOpenDay(day)}
                  className={`bd-cell${list.length ? " is-clickable" : ""}`}
                >
                  <span className={`bd-day${isToday ? " is-today" : ""}`}>{day}</span>
                  {shown.map((p) => (
                    <span
                      key={`${p.kind}-${p.id}`}
                      title={`${p.name} — ${p.kind === "employee" ? "Xodim" : "O'quvchi"}`}
                      className={`bd-chip${p.kind === "employee" ? " is-employee" : ""}`}
                    >
                      {p.name}
                    </span>
                  ))}
                  {rest > 0 && <span className="bd-more">{`+${rest} Ko'proq`}</span>}
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
                  <div className="text-[12px] text-muted-foreground">
                    {loading ? "Yuklanmoqda…" : "Ma'lumot yo'q"}
                  </div>
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

      {/* Kun modali — referensdagidek: sarlavhada to'liq sana, ichida ism +
          telefon kartalari, pastda "Orqaga". Ism bosilsa profilga o'tadi. */}
      {openDay !== null && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpenDay(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3">
              {/* Yagona shablon-satr: JSX'da `{expr} matn&apos;li-so'z`
                  shaklida yozilsa probel yo'qoladi (README'dagi tuzoq). */}
              <h2 className="text-[17px] font-semibold">
                {`${openDay} ${MONTHS[lang][month - 1]} ${year} - Tug'ilgan kunlar`}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto px-5 space-y-2">
              {(dayMap.get(openDay) ?? []).map((p) => (
                <Link
                  key={`${p.kind}-${p.id}`}
                  href={profileHref(p)}
                  onClick={() => setOpenDay(null)}
                  className="block rounded-xl bg-secondary/50 hover:bg-secondary px-4 py-3 transition-colors"
                >
                  <div className="text-[14px] font-medium">{p.name}</div>
                  <div className="text-[12px] text-muted-foreground">
                    Telefon: {p.phone || "—"}
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex justify-end px-5 py-4">
              <button
                onClick={() => setOpenDay(null)}
                className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
              >
                Orqaga
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
