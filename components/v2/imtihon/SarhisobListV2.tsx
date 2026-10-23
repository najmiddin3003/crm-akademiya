"use client";

import { useMemo, useState } from "react";
import { Download, FilePlus, Plus } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { downloadCsv } from "@/components/imtihon/importUtils";
import { pupilAvgPct } from "@/components/imtihon/SarhisobDetailDrawer";
import { sarhisobCsvRows, useMonthLabel } from "@/components/imtihon/sarhisobCore";
import { uzDateIso } from "@/lib/uzTime";
import { groupExamMonth, type GroupExam } from "@/lib/imtihon";
import SarhisobDetailV2 from "./SarhisobDetailV2";
import { ImtihonHeader, ScoreBar, examBand } from "./examBits";

// YANGI VERSIYA — IMTIHON → SARHISOB RO'YXATI. Rasmi KELMAGAN (8-qismda faqat «Natija
// kiritish» bor) — eski Sarhisob tabidagi hamma narsa yangi qoidalar bilan: oy va fan
// filtri, to'rt ko'rsatkich, oydagi sarhisoblar jadvali (qator bosilsa — tafsilot),
// «Eksport» (Sarhisob_YYYY-MM.csv, eski bilan bir xil) va «+ Natija kiritish»
// (rasmdagi ekranga o'tadi). SAVOLLAR 139.

const th = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

function dateOfIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export default function SarhisobListV2({
  exams,
  loading,
  initialMonth,
  onAdd,
}: {
  exams: GroupExam[];
  loading: boolean;
  /** Manzildagi `oy=` (natija saqlangach shu oyga qaytiladi). */
  initialMonth: string | null;
  onAdd: (month: string) => void;
}) {
  const { t } = useT();
  const [lang] = useLang();
  const { showSuccess } = useToast();
  const monthLabel = useMonthLabel();
  const [fMonth, setFMonth] = useState<string | null>(initialMonth);
  const [fCourse, setFCourse] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const monthOptions = useMemo(() => {
    const set = new Set(exams.map(groupExamMonth));
    set.add(uzDateIso().slice(0, 7));
    if (initialMonth) set.add(initialMonth);
    return [...set]
      .sort()
      .reverse()
      .map((m) => ({ value: m, label: monthLabel(m) }));
  }, [exams, monthLabel, initialMonth]);
  // Tanlanmagan bo'lsa — eng oxirgi oy (eski sahifadagidek).
  const fm = fMonth ?? monthOptions[0]?.value ?? "";

  const courseOptions = useMemo(
    () => [...new Set(exams.map((r) => r.course))].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c })),
    [exams],
  );

  const rows = useMemo(() => exams.filter((r) => (!fm || groupExamMonth(r) === fm) && (!fCourse || r.course === fCourse)), [exams, fm, fCourse]);
  const studentCount = rows.reduce((s, r) => s + r.studentCount, 0);
  const centerAvg = rows.length ? pupilAvgPct(rows) : null;
  const top = rows.reduce((m, r) => r.students.reduce((mm, s) => Math.max(mm, s.pct), m), 0);

  function exportCsv(list: GroupExam[], month: string) {
    downloadCsv(sarhisobCsvRows(list, monthLabel), `Sarhisob_${month || "hammasi"}.csv`);
    showSuccess(t("Yuklab olindi — {n} ta sarhisob (Excel'da ochiladi)", { n: list.length }));
  }

  const open = openId === null ? null : (exams.find((r) => r.id === openId) ?? null);

  const kpis = [
    { label: t("Sarhisob soni"), value: String(rows.length) },
    { label: t("Natija kiritilgan o'quvchi"), value: String(studentCount) },
    { label: t("Markaz o'rtachasi"), value: centerAvg === null ? "—" : `${centerAvg}%` },
    { label: t("Eng yuqori natija"), value: rows.length ? `${top}%` : "—" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ImtihonHeader
        tab="sarhisob"
        actions={
          <>
            <button type="button" onClick={() => exportCsv(rows, fm)} disabled={rows.length === 0} className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
              <Download className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Eksport")}
            </button>
            <button type="button" onClick={() => onAdd(fm || uzDateIso().slice(0, 7))} className={primaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Natija kiritish")}
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <V2Select variant="value" label={t("Oy")} value={fm} onChange={(v) => setFMonth(v || null)} options={monthOptions} searchable={false} clearable={false} />
        <V2Select variant="chip" label={t("Fan")} value={fCourse} onChange={setFCourse} options={courseOptions} />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm min-[64rem]:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-0 bg-v2-surface px-4 py-3">
            <div className="truncate text-v2-small font-medium text-v2-text-2">{k.label}</div>
            <div className="mt-1 text-[1.375rem] font-semibold leading-7 tabular-nums text-v2-text">{loading ? "—" : k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="flex items-baseline justify-between gap-2 px-4 py-3">
          <h2 className="text-v2-section text-v2-text">{fm ? t("{month} sarhisoblari", { month: monthLabel(fm) }) : t("Barcha sarhisoblar")}</h2>
        </div>
        <div className="max-h-[70vh] min-h-0 overflow-auto">
          <table className="w-full min-w-[820px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${th} pl-4 pr-3`}>{t("Sana")}</th>
                <th className={`${th} px-3`}>{t("Fan")}</th>
                <th className={`${th} px-3`}>{t("Ustoz")}</th>
                <th className={`${th} px-3`}>{t("Guruh")}</th>
                <th className={`${th} px-3 text-right`}>{t("O'quvchi")}</th>
                <th className={`${th} px-3 text-right`}>{t("Savol")}</th>
                <th className={`${th} pl-3 pr-4`}>{t("Guruh o'rtachasi")}</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={`sk${i}`} className="border-b border-v2-border" aria-hidden>
                    {Array.from({ length: 7 }, (__, j) => (
                      <td key={j} className={`py-3.5 ${j === 0 ? "pl-4 pr-3" : "px-3"}`}>
                        <div className="h-3 w-20 rounded bg-v2-skeleton" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <FilePlus className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <div className="text-v2-section text-v2-text">{t("Bu oyda sarhisob yo'q")}</div>
                      <p className="text-v2-small text-v2-text-2">{t("Guruh tanlab birinchi natijani kiriting.")}</p>
                      <button type="button" onClick={() => onAdd(fm || uzDateIso().slice(0, 7))} className={`${primaryBtn} mt-2`}>
                        <Plus className="size-4" strokeWidth={2} aria-hidden />
                        {t("Natija kiritish")}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => {
                  const d = dateOfIso(r.date);
                  return (
                    <tr
                      key={r.id}
                      tabIndex={0}
                      onClick={() => setOpenId(r.id)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                          e.preventDefault();
                          setOpenId(r.id);
                        }
                      }}
                      className={`group cursor-pointer border-b border-v2-border last:border-b-0 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] ${ROW_TINT.hover}`}
                    >
                      <td className="whitespace-nowrap py-3 pl-4 pr-3 text-v2-small tabular-nums text-v2-text">{d ? dayMonthLabel(d, lang) : r.date}</td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2">
                          <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(r.course)]}`} aria-hidden />
                          <span className="truncate font-medium text-v2-text">{r.course}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-v2-small text-v2-text">{r.teacher}</td>
                      <td className="px-3 py-3 text-v2-small">
                        <span className="font-semibold text-v2-text group-hover:underline group-hover:underline-offset-2">{/^\d+$/.test(r.groupName) ? t("{n}-guruh", { n: r.groupName }) : r.groupName || r.groupLabel}</span>
                        {r.level ? <span className="text-v2-text-3"> · {t(r.level)}</span> : null}
                      </td>
                      <td className="px-3 py-3 text-right text-v2-small tabular-nums text-v2-text">{r.studentCount}</td>
                      <td className="px-3 py-3 text-right text-v2-small tabular-nums text-v2-text">{r.total}</td>
                      <td className="py-3 pl-3 pr-4">
                        <span className="flex items-center gap-2.5">
                          <ScoreBar pct={r.avgPct} className="w-[96px]" />
                          <span className={`text-v2-small font-semibold tabular-nums ${examBand(r.avgPct) === "low" ? "text-v2-warning" : "text-v2-text"}`}>{r.avgPct}%</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {open && <SarhisobDetailV2 exam={open} all={exams} onClose={() => setOpenId(null)} onExport={(r) => exportCsv([r], groupExamMonth(r))} />}
    </div>
  );
}
