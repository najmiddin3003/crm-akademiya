"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, ChevronDown, ChevronRight, CircleAlert, Phone } from "lucide-react";
import Link from "@/components/ui/Link";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { useBranch } from "@/components/shared/BranchContext";
import { useT, type TFn } from "@/components/shared/Language";
import { Segmented } from "@/components/v2/form/fields";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import V2DateRange, { rangeLabel } from "@/components/v2/ui/V2DateRange";
import V2Select from "@/components/v2/ui/V2Select";
import { branchPool } from "@/lib/branchPools";
import type { AbsenceStreak, AttendanceGroupRow, AttendanceReport } from "@/lib/reportAttendance";
import type { ReportDef } from "@/lib/reportsCatalog";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { dateOfIso, fileSafe, fmtNum, fmtPhone, initialsOf, isoOf } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell, ReportTable, type TableCol } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → DAVOMAT → «GURUHLAR BO'YICHA» (27-qism, rasmlar 51/52 —
// yorug'/qorong'i, 14.11.2026):
//   • filtrlar: sana oralig'i, Filial, Kurs; o'ngda «Guruhlar bo'yicha | O'qituvchilar bo'yicha»
//     (ikkinchisi — /reports/davomat-oqituvchilar, filtrlar so'rov qatorida o'tadi va shu
//     yerdan o'qiladi: ?from=&to=&branch=&course=);
//   • ko'rsatkichlar: O'rtacha davomat, Darslar, Qoldirilgan, Ketma-ket 2+ qoldirgan;
//   • jadval: filial qatori (ochiladi) → guruhlar; Darslar, O'quvchi-dars, Qatnashish,
//     Sababli, Sababsiz, Ketma-ket 2+; Jami;
//   • «Ketma-ket 2 va undan ko'p dars qoldirganlar» — ota-ona telefoni (tel: havola).
// Hisob — lib/reportAttendance.ts (Nazorat → Davomat analitikasi bilan bir xil belgilar).
// DARSLAR = belgilangan + belgilanmagan (rejadagi, belgisi yo'q) — shunda «68 / 70» va
// «2 belgilanmagan» doim bir-biriga mos (jadvaldan tashqari kunga qo'yilgan belgi ham dars).

type Resp = Pick<AttendanceReport, "from" | "to" | "historyStart" | "totals" | "courses"> & {
  ok: true;
  groups: AttendanceGroupRow[];
  streaks: AbsenceStreak[];
  branches: { id: number; name: string }[];
};

interface Agg {
  groups: number;
  lessons: number;
  marked: number;
  unmarked: number;
  marks: number;
  present: number;
  excused: number;
  unexcused: number;
  streak2: number;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const th = "h-9 px-4 text-v2-caption font-medium text-v2-text-2";
const td = "px-4 py-2.5 align-middle";
const num = "text-right tabular-nums";

const pctText = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const rateOf = (a: Pick<Agg, "marks" | "present">) => (a.marks ? a.present / a.marks : null);

function aggOf(rows: readonly AttendanceGroupRow[]): Agg {
  const a: Agg = { groups: 0, lessons: 0, marked: 0, unmarked: 0, marks: 0, present: 0, excused: 0, unexcused: 0, streak2: 0 };
  for (const g of rows) {
    a.groups += 1;
    a.lessons += g.marked + g.unmarked;
    a.marked += g.marked;
    a.unmarked += g.unmarked;
    a.marks += g.marks;
    a.present += g.present;
    a.excused += g.excused;
    a.unexcused += g.unexcused;
    a.streak2 += g.streak2 ?? 0;
  }
  return a;
}

/** «+998941118855» — tel: havola (bazada 9 yoki 12 raqam). */
function telHref(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length >= 9 ? `tel:+998${d.slice(-9)}` : `tel:${d}`;
}

export default function DavomatGuruhlarReport({ report, author }: { report: ReportDef; author: string }) {
  const { t, lang } = useT();
  const f = useReportFmt();
  const today = useToday();
  const router = useRouter();
  const sp = useSearchParams();
  const branchCtx = useBranch();
  const branchOptions = useBranchOptions();

  // Filtrlar — so'rov qatoridan («O'qituvchilar bo'yicha»dan qaytganda o'sha davr va filial).
  const [range, setRange] = useState<DateRange>(() => {
    const qf = sp.get("from") ?? "";
    const qt = sp.get("to") ?? "";
    const to = ISO.test(qt) ? (qt > today ? today : qt) : today;
    const from = ISO.test(qf) && qf <= to ? qf : `${to.slice(0, 7)}-01`;
    return { start: dateOfIso(from), end: dateOfIso(to) };
  });
  const [branch, setBranch] = useState(() => sp.get("branch") ?? "");
  const [course, setCourse] = useState(() => sp.get("course") ?? "");
  const [opened, setOpened] = useState<Set<number> | null>(null);

  const branchId = branchOptions.some((b) => b.value === branch) ? branch : "";
  const rawFrom = range.start ? isoOf(range.start) : `${today.slice(0, 7)}-01`;
  const rawTo = range.start ? isoOf(range.end ?? range.start) : today;
  const to = rawTo > today ? today : rawTo;
  const from = rawFrom > to ? to : rawFrom;
  const qs = new URLSearchParams({ from, to, ...(branchId ? { branch: branchId } : {}), ...(course ? { course } : {}) }).toString();

  // So'rov qatorida filial bo'lsa — filiallar ro'yxati kelguncha kutiladi (aks holda avval «Barchasi» so'ralardi).
  const { data, loading, stale, error, reload } = useReportData<Resp>(branch && branchCtx.loading ? null : `/api/reports/attendance-groups?${qs}`);
  const rows = useMemo(() => data?.groups ?? [], [data?.groups]);
  const streaks = data?.streaks ?? [];
  const tot = useMemo(() => aggOf(rows), [rows]);
  const totRate = rateOf(tot);

  const branchName = branchId ? (branchOptions.find((b) => b.value === branchId)?.label ?? "") : t("Barcha filiallar");
  const period = rangeLabel(range, lang, t);
  const courseOptions = useMemo(() => (data?.courses ?? []).map((c) => ({ value: c, label: c })), [data?.courses]);
  // 1+2 Chortoq — bitta hovuz (lib/branchPools.ts): guruh va o'quvchilar kesimida bitta qator,
  // «O'qituvchilar bo'yicha» va «Faol o'quvchilar» bilan bir xil.
  const buildingName = (id: number) => {
    const head = branchPool(id)[0];
    const b = data?.branches.find((x) => x.id === head) ?? data?.branches.find((x) => x.id === id);
    return b ? b.name : `#${id}`;
  };

  const tree = useMemo(() => {
    const by = new Map<number, AttendanceGroupRow[]>();
    for (const g of rows) {
      const key = branchPool(g.branchId)[0];
      const list = by.get(key);
      if (list) list.push(g);
      else by.set(key, [g]);
    }
    return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([id, groups]) => ({ id, groups, agg: aggOf(groups) }));
  }, [rows]);
  // Sukut: bitta filial bo'lsa — o'sha, aks holda navbar filiali ochiq.
  const openByDefault = (id: number) => tree.length === 1 || (branchCtx.branchId != null && id === branchPool(branchCtx.branchId)[0]);
  const isOpen = (id: number) => (opened ? opened.has(id) : openByDefault(id));
  const toggle = (id: number) =>
    setOpened((prev) => {
      const next = new Set(prev ?? tree.filter((b) => openByDefault(b.id)).map((b) => b.id));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** «9- va 12-oktabr», «6-, 8- va 10-oktabr», «30-sentabr va 2-oktabr»; inglizchada «October 9 and 12». */
  const datesText = (dates: readonly string[]) => {
    const parts = dates.map((iso, i) => {
      const sameNext = dates[i + 1]?.slice(0, 7) === iso.slice(0, 7);
      const samePrev = dates[i - 1]?.slice(0, 7) === iso.slice(0, 7);
      const day = String(Number(iso.slice(8, 10)));
      if (lang === "en") return samePrev ? day : f.dayMonth(iso);
      return sameNext ? `${day}-` : f.dayMonth(iso);
    });
    if (parts.length < 2) return parts[0] ?? "—";
    return `${parts.slice(0, -1).join(", ")} ${t("va")} ${parts[parts.length - 1]}`;
  };
  const groupTitle = (g: Pick<AttendanceGroupRow, "course" | "level" | "label">) => [g.course, g.level].filter(Boolean).join(" · ") || g.label;
  const streakInfo = (s: AbsenceStreak) => [s.course, s.level, buildingName(s.branchId)].filter(Boolean).join(" · ");

  const notes = {
    rate: t("Qatnashish = kelgan (kechikkan va birinchi darsga kelgan ham) ÷ belgilangan o'quvchi-dars. Belgilanmagan darslar foizga kirmaydi —"),
    rateLink: t("Nazorat → Davomat qilinmagan guruhlar"),
    streak: t(
      "Ketma-ket qoldirgan — o'quvchining shu guruhdagi oxirgi belgilari ketma-ket «sababsiz» (2 va undan ko'p); keyingi darsga kelsa ro'yxatdan chiqadi. Izoh — davomat belgisidagi izoh. Ota-ona raqami kiritilmagan bo'lsa — o'quvchining o'z raqami.",
    ),
  };

  function getDoc(): ExportDoc | null {
    if (!data) return null;
    const group = (g: AttendanceGroupRow) => [
      buildingName(g.branchId),
      [g.label, g.level].filter(Boolean).join(" · "),
      g.teacher || null,
      g.marked,
      g.noSchedule ? null : g.marked + g.unmarked,
      g.unmarked,
      g.marks,
      pctText(g.rate),
      g.excused,
      g.unexcused,
      g.streak2 ?? 0,
    ];
    return {
      title: t("{name} hisoboti", { name: `${t("Davomat")} · ${t(report.title)}` }),
      fileBase: `${fileSafe(`${t("Davomat")} ${t(report.title)}`)}-${to}`,
      center: t(CENTER_NAME),
      branchLabel: branchName,
      dateLabel: f.fullDate(today),
      author,
      filters: [period, branchName, course || t("Barcha kurslar")].join(" · "),
      kpis: [
        { label: t("O'rtacha davomat"), value: `${pctText(totRate)} (${t("{a} / {b} o'quvchi-dars", { a: fmtNum(tot.present), b: fmtNum(tot.marks) })})` },
        { label: t("Darslar"), value: `${fmtNum(tot.lessons)} (${t("{a} belgilangan · {b} belgilanmagan", { a: fmtNum(tot.marked), b: fmtNum(tot.unmarked) })})` },
        { label: t("Qoldirilgan"), value: `${fmtNum(tot.excused + tot.unexcused)} (${t("{a} sababli · {b} sababsiz", { a: fmtNum(tot.excused), b: fmtNum(tot.unexcused) })})` },
        { label: t("Ketma-ket 2+ qoldirgan"), value: t("{n} o'quvchi", { n: streaks.length }) },
      ],
      sections: [
        {
          title: t("Guruhlar bo'yicha"),
          columns: [
            { label: t("Filial") },
            { label: t("Guruh") },
            { label: t("O'qituvchi") },
            { label: t("Belgilangan"), numeric: true },
            { label: t("Darslar"), numeric: true },
            { label: t("Belgilanmagan"), numeric: true },
            { label: t("O'quvchi-dars"), numeric: true },
            { label: t("Qatnashish") },
            { label: t("Sababli"), numeric: true },
            { label: t("Sababsiz"), numeric: true },
            { label: t("Ketma-ket 2+"), numeric: true },
          ],
          rows: tree.flatMap((b) => b.groups.map(group)),
          total: [t("Jami"), t("{n} guruh", { n: tot.groups }), null, tot.marked, tot.lessons, tot.unmarked, tot.marks, pctText(totRate), tot.excused, tot.unexcused, tot.streak2],
        },
        {
          title: t("Ketma-ket 2 va undan ko'p dars qoldirganlar"),
          columns: [
            { label: "№" },
            { label: t("O'quvchi") },
            { label: t("Guruh") },
            { label: t("Filial") },
            { label: t("Qaysi darslar") },
            { label: t("Ketma-ket"), numeric: true },
            { label: t("Izoh") },
            { label: t("Ota-ona telefoni"), key: "phone" },
          ],
          rows: streaks.map((s, i) => [
            i + 1,
            s.name,
            [s.course, s.level].filter(Boolean).join(" · ") || s.groupLabel,
            buildingName(s.branchId),
            datesText(s.dates),
            s.count,
            s.note || null,
            s.phone ? fmtPhone(s.phone) : null,
          ]),
        },
      ],
      notes: [`${notes.rate} ${notes.rateLink}.`, notes.streak],
      footer: DOC_FOOTER,
    };
  }

  const header: { key: string; label: string; right?: boolean }[] = [
    { key: "g", label: t("Guruh") },
    { key: "l", label: t("Darslar"), right: true },
    { key: "m", label: t("O'quvchi-dars"), right: true },
    { key: "r", label: t("Qatnashish"), right: true },
    { key: "e", label: t("Sababli"), right: true },
    { key: "u", label: t("Sababsiz"), right: true },
    { key: "s", label: t("Ketma-ket 2+"), right: true },
  ];

  const streakCols: TableCol<AbsenceStreak>[] = [
    {
      key: "p",
      label: t("O'quvchi"),
      className: "min-w-[220px]",
      render: (s) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-v2-border bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
            {initialsOf(s.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-v2-text">{s.name}</span>
            <span className="block truncate text-v2-caption text-v2-text-2" title={s.groupLabel}>
              {streakInfo(s)}
            </span>
          </span>
        </span>
      ),
    },
    { key: "d", label: t("Qaysi darslar"), render: (s) => <span className="whitespace-nowrap text-v2-text">{datesText(s.dates)}</span> },
    {
      key: "c",
      label: t("Ketma-ket"),
      render: (s) => (
        <span className="inline-flex h-6 items-center whitespace-nowrap rounded-v2-full bg-v2-danger-bg px-2 text-v2-caption font-semibold text-v2-danger">{t("{n} dars", { n: s.count })}</span>
      ),
    },
    {
      key: "n",
      label: t("Izoh"),
      className: "min-w-[180px] max-w-[300px]",
      render: (s) => (s.note ? <span className="line-clamp-2 text-v2-small text-v2-text-2">{s.note}</span> : null),
    },
    {
      key: "t",
      label: t("Ota-ona telefoni"),
      align: "right",
      render: (s) =>
        s.phone ? (
          <a
            href={telHref(s.phone)}
            title={s.parentPhone ? t("Qo'ng'iroq qilish") : t("O'quvchining o'z raqami — ota-ona raqami kiritilmagan")}
            className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-v2-md border border-v2-border bg-v2-surface px-3 font-semibold tabular-nums text-v2-text shadow-v2-sm transition-colors hover:bg-v2-hover focus-visible:shadow-v2-focus focus-visible:outline-none"
          >
            <Phone className="size-4 text-v2-success" strokeWidth={1.75} aria-hidden />
            {fmtPhone(s.phone)}
          </a>
        ) : (
          <span className="text-v2-text-3">—</span>
        ),
    },
  ];

  return (
    <ReportShell
      report={report}
      subtitle={`${t("Qatnashish foizi va qoldirilgan darslar")} · ${branchId ? branchName : t("barcha filiallar")}`}
      getDoc={getDoc}
      exportReady={!!data && !stale}
      pdfToggles={[{ key: "phone", label: "Ota-ona telefonlari" }]}
      filters={
        <>
          <V2DateRange value={range} onChange={setRange} allowAll={false} align="start" />
          <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branchId} onChange={setBranch} options={branchOptions} searchable={false} />
          <V2Select variant="value" label={t("Kurs")} emptyLabel="Hammasi" value={course} onChange={setCourse} options={courseOptions} />
        </>
      }
      filtersEnd={
        <div className="w-[340px] max-w-full">
          <Segmented
            value="groups"
            onChange={(v) => {
              if (v === "teachers") router.push(`/reports/davomat-oqituvchilar?${qs}`);
            }}
            label={t("Davomat hisoboti ko'rinishi")}
            options={[
              { value: "groups", label: t("Guruhlar bo'yicha") },
              { value: "teachers", label: t("O'qituvchilar bo'yicha") },
            ]}
          />
        </div>
      }
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}

      <div className={stale ? "opacity-60 transition-opacity" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            { key: "r", label: t("O'rtacha davomat"), value: pctText(totRate), sub: t("{a} / {b} o'quvchi-dars", { a: fmtNum(tot.present), b: fmtNum(tot.marks) }) },
            { key: "l", label: t("Darslar"), value: fmtNum(tot.lessons), sub: t("{a} belgilangan · {b} belgilanmagan", { a: fmtNum(tot.marked), b: fmtNum(tot.unmarked) }) },
            { key: "q", label: t("Qoldirilgan"), value: fmtNum(tot.excused + tot.unexcused), sub: t("{a} sababli · {b} sababsiz", { a: fmtNum(tot.excused), b: fmtNum(tot.unexcused) }) },
            {
              key: "s",
              label: t("Ketma-ket 2+ qoldirgan"),
              icon: <CircleAlert className="size-3.5 shrink-0 text-v2-danger" strokeWidth={2} aria-hidden />,
              value: fmtNum(streaks.length),
              unit: t("o'quvchi"),
              sub: streaks.length ? t("ota-onasiga qo'ng'iroq kerak") : t("yo'q"),
            },
          ]}
        />
      </div>

      <section className={`relative overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm transition-opacity ${stale ? "opacity-60" : ""}`}>
        {/* `relative` — ichidagi `sr-only` yozuv aylantirish qutisidan chiqib, telefonda sahifani kengaytirmasin. */}
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse text-v2-body" style={{ minWidth: 920 }}>
            <caption className="sr-only">{t(report.title)}</caption>
            <thead>
              <tr className="border-b border-v2-border bg-v2-surface-2">
                {header.map((h) => (
                  <th key={h.key} scope="col" className={`${th} ${h.right ? "text-right" : "text-left"} ${h.key === "r" ? "w-[180px]" : ""}`}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-b border-v2-border last:border-b-0" aria-hidden>
                    {header.map((h, j) => (
                      <td key={h.key} className={`${td} ${j ? num : ""}`}>
                        <span className={`inline-block h-3 rounded bg-v2-skeleton ${j ? "w-14" : "w-40"}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tree.length === 0 ? (
                <tr>
                  <td colSpan={header.length} className="px-4 py-10 text-center text-v2-small text-v2-text-2">
                    {t("Bu davrda dars bo'lgan guruh yo'q")}
                  </td>
                </tr>
              ) : (
                tree.map((b) => {
                  const open = isOpen(b.id);
                  const Chevron = open ? ChevronDown : ChevronRight;
                  return (
                    <Fragment key={b.id}>
                      <tr className="border-b border-v2-border bg-v2-surface-2/60">
                        <td className={td}>
                          <button
                            type="button"
                            onClick={() => toggle(b.id)}
                            aria-expanded={open}
                            className="flex min-w-0 items-center gap-2 rounded-v2-sm text-left focus-visible:shadow-v2-focus focus-visible:outline-none"
                          >
                            <Chevron className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                            <Building2 className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-v2-text">{buildingName(b.id)}</span>
                              <span className="block text-v2-caption text-v2-text-2">{t("{n} guruh", { n: b.agg.groups })}</span>
                            </span>
                          </button>
                        </td>
                        <AggCells a={b.agg} t={t} strong />
                      </tr>
                      {open &&
                        b.groups.map((g) => (
                          <tr key={g.id} className="border-b border-v2-border">
                            <td className={`${td} pl-12`}>
                              <span className="flex min-w-0 items-start gap-2.5">
                                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
                                <span className="min-w-0">
                                  <Link
                                    href={`/groups/${g.id}?tab=jurnal`}
                                    title={g.label}
                                    className="block truncate rounded-v2-sm font-semibold text-v2-text hover:underline focus-visible:shadow-v2-focus focus-visible:outline-none"
                                  >
                                    {groupTitle(g)}
                                  </Link>
                                  <span className="block truncate text-v2-caption text-v2-text-2">{g.teacher || "—"}</span>
                                </span>
                              </span>
                            </td>
                            <AggCells a={aggOf([g])} noSchedule={g.noSchedule} t={t} />
                          </tr>
                        ))}
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {!loading && tree.length > 0 && (
              <tfoot>
                <tr className="border-t border-v2-border bg-v2-surface-2 font-semibold">
                  <td className={td}>{t("Jami · {n} guruh", { n: tot.groups })}</td>
                  <AggCells a={tot} t={t} strong />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <NoteLine>
        {notes.rate}{" "}
        <Link href="/nazorat-missed-groups" className="rounded-v2-sm text-v2-brand-text underline-offset-2 hover:underline focus-visible:shadow-v2-focus focus-visible:outline-none">
          {notes.rateLink}
        </Link>
        .
      </NoteLine>
      {data && data.historyStart > from && (
        <NoteLine>{t("Guruh a'zoligi tarixi {date} dan yoziladi — boshlanish sanasi kiritilmagan guruhlar shu kundan hisoblanadi.", { date: f.fullDate(data.historyStart) })}</NoteLine>
      )}

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="text-v2-section text-v2-text">{t("Ketma-ket 2 va undan ko'p dars qoldirganlar")}</h2>
        {!loading && (
          <span className="text-v2-small text-v2-text-2">
            {t("{n} o'quvchi", { n: streaks.length })} · {t("sababsiz")}
          </span>
        )}
      </div>
      <div className={stale ? "opacity-60 transition-opacity" : ""}>
        <ReportTable
          cols={streakCols}
          rows={streaks}
          rowKey={(s) => `${s.groupId}-${s.pupilId}`}
          loading={loading}
          empty={t("Ketma-ket 2 dars qoldirgan o'quvchi yo'q")}
          caption={t("Ketma-ket 2 va undan ko'p dars qoldirganlar")}
          minWidth={900}
        />
      </div>
      <IconNote icon={<Phone className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />}>{notes.streak}</IconNote>
    </ReportShell>
  );
}

/* ───────────────────────── Bo'laklar ───────────────────────── */

function IconNote({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-v2-caption font-normal text-v2-text-2">
      {icon}
      <span>{children}</span>
    </p>
  );
}

/** Qatnashish: chiziq + foiz (90% va undan yuqori — asosiy rang, pastrog'i — ogohlantirish). */
function PctBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-v2-text-3">—</span>;
  const p = Math.round(value * 100);
  return (
    <span className="inline-flex items-center justify-end gap-3">
      <span className="block h-1.5 w-[100px] overflow-hidden rounded-full bg-v2-track" aria-hidden>
        <span className={`block h-full rounded-full ${p >= 90 ? "bg-v2-brand" : "bg-v2-warning"}`} style={{ width: `${Math.max(3, Math.min(100, p))}%` }} />
      </span>
      <span className="w-10 text-right font-semibold tabular-nums text-v2-text">{p}%</span>
    </span>
  );
}

/** Filial / guruh / jami qatorining raqamli kataklari. */
function AggCells({ a, t, strong, noSchedule }: { a: Agg; t: TFn; strong?: boolean; noSchedule?: boolean }) {
  const w = strong ? "font-semibold" : "font-medium";
  const zero = <span className="text-v2-text-3">0</span>;
  const red = (n: number) => (n > 0 ? <span className={`${w} text-v2-danger`}>{fmtNum(n)}</span> : zero);
  return (
    <>
      <td className={`${td} ${num}`}>
        <span className="block whitespace-nowrap">
          <span className={`${w} text-v2-text`}>{fmtNum(a.marked)}</span>
          <span className="text-v2-text-2"> / {noSchedule ? "—" : fmtNum(a.lessons)}</span>
        </span>
        {a.unmarked > 0 && <span className="block whitespace-nowrap text-v2-caption font-medium text-v2-danger">{t("{n} belgilanmagan", { n: fmtNum(a.unmarked) })}</span>}
        {noSchedule && <span className="block whitespace-nowrap text-v2-caption text-v2-text-3">{t("jadval yo'q")}</span>}
      </td>
      <td className={`${td} ${num}`}>
        <span className={`${w} text-v2-text`}>{fmtNum(a.marks)}</span>
      </td>
      <td className={`${td} ${num}`}>
        <PctBar value={rateOf(a)} />
      </td>
      <td className={`${td} ${num}`}>{a.excused > 0 ? <span className="text-v2-text">{fmtNum(a.excused)}</span> : zero}</td>
      <td className={`${td} ${num}`}>{red(a.unexcused)}</td>
      <td className={`${td} ${num}`}>{red(a.streak2)}</td>
    </>
  );
}
