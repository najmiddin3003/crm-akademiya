"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus, Share2 } from "lucide-react";
import Select from "@/components/ui/Select";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { uzDateIso } from "@/lib/uzTime";
import { groupExamMonth, type GroupExam } from "@/lib/imtihon";
import { downloadCsv } from "./importUtils";
import TierBadge from "./TierBadge";
import GroupExamDrawer from "./GroupExamDrawer";
import SarhisobDetailDrawer, { fmtExamDate, pupilAvgPct } from "./SarhisobDetailDrawer";
import { useT } from "@/components/shared/Language";

// Imtihon → Sarhisob tabi (referens sarhisob.html → renderList).
//
// Guruh bo'yicha kiritilgan imtihon natijalari (MongoDB `group_exams`,
// joriy filial): oy va fan filtri, to'rt KPI kartasi, oydagi sarhisoblar
// jadvali (sana, fan, ustoz, guruh, o'quvchi/savol soni, guruh o'rtachasi
// — lib/imtihon.ts → imTier rang toifalari). Qator bosilsa o'ngdan
// tafsilot paneli (SarhisobDetailDrawer), "Natija qo'shish" — kiritish
// paneli (GroupExamDrawer), "Excelga chiqarish" — CSV (Sarhisob_YYYY-MM.csv).
//
// Ilgari bu ro'yxat alohida /imtihon/sarhisob sahifasida, tabda esa
// o'quvchi-o'quvchi "Oylik imtihon" jadvali (Excel import bilan) turardi;
// 21.09.2026 da referens bo'yicha "Oylik imtihon" Sarhisobga almashdi.

function Kpi({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      <div className="text-[24px] leading-tight font-bold tabular-nums tracking-tight">{value}</div>
      <div className="text-[12px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export default function SarhisobView() {
  const { t, months: MONTH_NAMES } = useT();
  const { showSuccess } = useToast();

  const [exams, setExams] = useState<GroupExam[]>([]);
  const [loading, setLoading] = useState(true);
  // `null` — foydalanuvchi hali tanlamagan: eng oxirgi sarhisob oyi
  // (bo'lmasa joriy oy) ko'rsatiladi.
  const [fMonth, setFMonth] = useState<string | null>(null);
  const [fCourse, setFCourse] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/imtihon/group")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setExams(d.exams as GroupExam[]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const monthLabel = useCallback(
    (m: string) => {
      const x = /^(\d{4})-(\d{2})$/.exec(m);
      return x ? `${MONTH_NAMES[Number(x[2]) - 1]} ${x[1]}` : m;
    },
    [MONTH_NAMES],
  );

  const monthOptions = useMemo(() => {
    const set = new Set(exams.map(groupExamMonth));
    set.add(uzDateIso().slice(0, 7));
    return [...set].sort().reverse().map((m) => ({ value: m, label: monthLabel(m) }));
  }, [exams, monthLabel]);
  const fm = fMonth ?? monthOptions[0]?.value ?? "";

  const courseOptions = useMemo(
    () => [...new Set(exams.map((r) => r.course))].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c })),
    [exams],
  );

  const rows = useMemo(
    () => exams.filter((r) => (!fm || groupExamMonth(r) === fm) && (!fCourse || r.course === fCourse)),
    [exams, fm, fCourse],
  );

  const studentCount = rows.reduce((s, r) => s + r.studentCount, 0);
  const centerAvg = pupilAvgPct(rows);
  const top = rows.reduce((m, r) => r.students.reduce((mm, s) => Math.max(mm, s.pct), m), 0);

  /** Referensdagi CSV: har bir o'quvchi alohida qator; nomi Sarhisob_YYYY-MM.csv. */
  function exportCsv(list: GroupExam[], month: string) {
    const head = ["Sana", "Oy", "Fan", "Ustoz", "Guruh", "O'quvchi", "Savollar", "To'g'ri javob", "O'zlashtirish %"];
    const out: unknown[][] = [head];
    for (const r of list) {
      for (const s of r.students) {
        out.push([fmtExamDate(r.date), monthLabel(groupExamMonth(r)), r.course, r.teacher, r.groupLabel, s.name, r.total, s.correct, s.pct]);
      }
    }
    downloadCsv(out, `Sarhisob_${month || "hammasi"}.csv`);
    showSuccess(t("📤 Yuklab olindi — {n} ta sarhisob (Excel'da ochiladi)", { n: list.length }));
  }

  const onSaved = useCallback((exam: GroupExam) => {
    setExams((prev) => [exam, ...prev]);
    setFMonth(groupExamMonth(exam));
    setFCourse("");
  }, []);

  const open = openId === null ? null : exams.find((r) => r.id === openId) || null;

  return (
    <div className="space-y-4">
      {/* Filtrlar va amallar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={fm} onChange={(v) => setFMonth(v)} options={monthOptions} size="sm" className="w-44" />
        <Select
          value={fCourse}
          onChange={(v) => setFCourse(v)}
          options={courseOptions}
          placeholder={t("Barcha fanlar")}
          clearable
          size="sm"
          className="w-48"
        />
        <div className="flex-1" />
        <button
          onClick={() => exportCsv(rows, fm)}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Share2 className="w-4 h-4" />
          <span>{t("Excelga chiqarish")}</span>
        </button>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <FilePlus className="w-4 h-4" />
          <span>{t("Natija qo'shish")}</span>
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi value={rows.length} label={t("Sarhisob soni")} />
        <Kpi value={studentCount} label={t("Natija kiritilgan o'quvchi")} />
        <Kpi value={`${centerAvg}%`} label={t("Markaz o'rtachasi")} />
        <Kpi value={`${top}%`} label={t("Eng yuqori natija")} />
      </div>

      {/* Jadval */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border text-[15px] font-semibold">
          {fm ? t("{month} sarhisoblari", { month: monthLabel(fm) }) : t("Barcha sarhisoblar")}
        </div>
        {loading ? (
          <div className="px-4 py-8">
            <SpinnerBlock size={22} />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            <div className="text-[14px] font-semibold text-foreground mb-0.5">{t("Bu oyda sarhisob yo'q")}</div>
            {t("Guruh tanlab birinchi natijani kiriting.")}
            <div className="mt-3.5">
              <button
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
              >
                <FilePlus className="w-4 h-4" />
                {t("Natija qo'shish")}
              </button>
            </div>
          </div>
        ) : (
          <div className="table-box">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-3 whitespace-nowrap">{t("Sana")}</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">{t("Fan")}</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">{t("Ustoz")}</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">{t("Guruh")}</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">{t("O'quvchi")}</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">{t("Savol")}</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">{t("Guruh o'rtachasi")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setOpenId(r.id)}
                    className="border-b border-border/50 last:border-b-0 hover:bg-secondary/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtExamDate(r.date)}</td>
                    <td className="px-4 py-3 text-[13px] font-medium">{r.course}</td>
                    <td className="px-4 py-3 text-[13px]">{r.teacher}</td>
                    <td className="px-4 py-3 text-[13px]">
                      {r.groupLabel}
                      {r.level ? <span className="text-muted-foreground"> · {t(r.level)}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-right">{r.studentCount}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-right">{r.total}</td>
                    <td className="px-4 py-3">
                      <TierBadge pct={r.avgPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && <GroupExamDrawer onClose={() => setAddOpen(false)} onSaved={onSaved} initialMonth={fm} />}

      {open && (
        <SarhisobDetailDrawer
          exam={open}
          all={exams}
          onClose={() => setOpenId(null)}
          onExport={(r) => exportCsv([r], groupExamMonth(r))}
        />
      )}
    </div>
  );
}
