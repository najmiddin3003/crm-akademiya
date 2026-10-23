"use client";

import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { pupilAvgPct } from "@/components/imtihon/SarhisobDetailDrawer";
import { useMonthLabel } from "@/components/imtihon/sarhisobCore";
import { groupExamMonth, type GroupExam } from "@/lib/imtihon";
import { CompareRow, ScoreBar, examBand } from "./examBits";

// YANGI VERSIYA — NATIJA KIRITISH → O'NG KARTA (rasm «Sarhisob · Natija kiritish»,
// 23.10.2026):
//   «Taqqoslash · oktabr» — Bu guruh (kiritilayotgan natijalar, jonli), «Ingliz tili ·
//   markaz o'rtachasi», «Barcha fanlar · markaz» (shu oydagi saqlangan sarhisoblar,
//   joriy filial — o'quvchi natijalari ustidan o'rtacha, eski tafsilot panelidagi
//   hisob); «Guruh ichida» — ≥ 80%, 60–79%, < 60% soni; ostida izoh.
//   O'quvchi qatori bosilsa — o'sha o'quvchi: guruhdagi o'rni va oylar bo'yicha
//   natijalari (saqlangan sarhisoblardan), «← Taqqoslash» bilan qaytadi.

export interface SidePupil {
  id: number;
  name: string;
  /** Joriy kiritishdagi natija (kiritilmagan bo'lsa null). */
  pct: number | null;
  correct: number | null;
  total: number;
  /** Guruhdagi o'rni (kiritilganlar orasida, foiz bo'yicha). */
  rank: number | null;
  of: number;
}

export default function ExamSideCard({
  month,
  course,
  groupAvg,
  filled,
  exams,
  pupil,
  onBack,
}: {
  month: string;
  course: string;
  /** Kiritilgan natijalar o'rtachasi; hali yo'q — null. */
  groupAvg: number | null;
  /** Kiritilgan natijalar foizlari. */
  filled: number[];
  exams: GroupExam[];
  pupil: SidePupil | null;
  onBack: () => void;
}) {
  const { t, months } = useT();
  const monthLabel = useMonthLabel();
  const monthName = (months[Number(month.slice(5, 7)) - 1] ?? "").toLowerCase();

  const cmp = useMemo(() => {
    const monthRecs = exams.filter((r) => groupExamMonth(r) === month);
    const subjRecs = course ? monthRecs.filter((r) => r.course.toLowerCase() === course.toLowerCase()) : [];
    return {
      subj: subjRecs.length ? pupilAvgPct(subjRecs) : null,
      center: monthRecs.length ? pupilAvgPct(monthRecs) : null,
    };
  }, [exams, month, course]);

  const bands = { hi: 0, mid: 0, low: 0 };
  for (const p of filled) bands[examBand(p)] += 1;

  const history = useMemo(() => {
    if (!pupil) return [];
    const out: { key: string; month: string; course: string; pct: number; correct: number; total: number }[] = [];
    for (const r of exams) {
      const s = r.students.find((x) => x.pupilId === pupil.id);
      if (s) out.push({ key: `${r.id}`, month: groupExamMonth(r), course: r.course, pct: s.pct, correct: s.correct, total: r.total });
    }
    return out.sort((a, b) => (a.month === b.month ? 0 : a.month < b.month ? 1 : -1)).slice(0, 12);
  }, [exams, pupil]);

  if (pupil) {
    const avg = history.length ? Math.round(history.reduce((s, h) => s + h.pct, 0) / history.length) : null;
    return (
      <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm" aria-label={pupil.name}>
        <button type="button" onClick={onBack} className="-ml-1 inline-flex h-7 items-center gap-1 rounded-v2-sm px-1 text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg">
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Taqqoslash")}
        </button>
        <h2 className="mt-2 text-v2-section text-v2-text">{pupil.name}</h2>
        <p className="mt-0.5 text-v2-small text-v2-text-2">
          {pupil.rank !== null ? t("Guruhda {rank}-o'rin · {n} tadan", { rank: pupil.rank, n: pupil.of }) : t("Bu imtihonda natija kiritilmagan")}
        </p>
        {pupil.pct !== null && (
          <div className="mt-3 flex items-center gap-2.5">
            <ScoreBar pct={pupil.pct} className="w-auto flex-1" />
            <span className="shrink-0 text-v2-small font-semibold tabular-nums text-v2-text">
              {pupil.pct}% <span className="font-normal text-v2-text-2">· {pupil.correct}/{pupil.total}</span>
            </span>
          </div>
        )}

        <div className="mt-4 border-t border-v2-border pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-v2-small font-semibold text-v2-text">{t("Oylar bo'yicha")}</h3>
            {avg !== null && <span className="text-v2-caption font-normal text-v2-text-2">{t("o'rtacha {pct}%", { pct: avg })}</span>}
          </div>
          {history.length === 0 ? (
            <p className="mt-2 text-v2-small text-v2-text-3">{t("Saqlangan natijalari yo'q.")}</p>
          ) : (
            <ul className="mt-2 space-y-2.5">
              {history.map((h) => (
                <li key={h.key}>
                  <div className="flex items-baseline justify-between gap-2 text-v2-small">
                    <span className="min-w-0 truncate text-v2-text">
                      {monthLabel(h.month)} <span className="text-v2-text-3">· {h.course}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-v2-text">{h.pct}%</span>
                  </div>
                  <ScoreBar pct={h.pct} className="mt-1 w-full" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm" aria-label={t("Taqqoslash")}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-v2-section text-v2-text">{t("Taqqoslash")}</h2>
        <span className="text-v2-small text-v2-text-3">{monthName}</span>
      </div>
      <div className="mt-3 space-y-3">
        <CompareRow label={t("Bu guruh")} value={groupAvg} strong />
        <CompareRow label={course ? t("{course} · markaz o'rtachasi", { course }) : t("Fan · markaz o'rtachasi")} value={cmp.subj} />
        <CompareRow label={t("Barcha fanlar · markaz")} value={cmp.center} />
      </div>

      <div className="mt-4 border-t border-v2-border pt-4">
        <h3 className="text-v2-small font-semibold text-v2-text">{t("Guruh ichida")}</h3>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {(
            [
              ["≥ 80%", bands.hi],
              ["60–79%", bands.mid],
              ["< 60%", bands.low],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="rounded-v2-md bg-v2-surface-2 px-3 py-2.5">
              <div className="text-v2-caption font-normal text-v2-text-2">{label}</div>
              <div className="mt-0.5 text-v2-section font-semibold tabular-nums text-v2-text">{n}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-v2-caption font-normal text-v2-text-2">{t("O'quvchi qatoriga bosilsa, uning oylar bo'yicha natijalari va guruhdagi o'rni ochiladi.")}</p>
      </div>
    </section>
  );
}
