"use client";

import { useMemo } from "react";
import { Share2, X } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { groupExamMonth, type GroupExam } from "@/lib/imtihon";
import TierBadge from "./TierBadge";
import { useT } from "@/components/shared/Language";

// Imtihon → Sarhisob → qator bosilganda ochiladigan tafsilot paneli
// (referens sarhisob.html → openDetail).
//
// Uch qism: fan/ustoz va sana/savollar; "Solishtirish" — bu guruh, shu fan
// bo'yicha va markaz o'rtachasi (uchalasi ham SHU OYDAGI sarhisoblar
// bo'yicha, o'quvchi natijalari ustidan o'rtacha — referens `avg(flatMap)`);
// "O'quvchilar natijasi" — har bir o'quvchi va uning guruh o'rtachasiga
// nisbati (+/− foiz).

/** "2026-09-14" → "14.09.2026". */
export function fmtExamDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Ro'yxatdagi barcha o'quvchi natijalarining o'rtachasi (butun foiz). */
export function pupilAvgPct(exams: GroupExam[]): number {
  const all = exams.flatMap((r) => r.students.map((s) => s.pct));
  return all.length ? Math.round(all.reduce((s, x) => s + x, 0) / all.length) : 0;
}

function CmpBar({ label, val, strong }: { label: string; val: number; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[150px_1fr_52px] items-center gap-2.5 text-[13px]">
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className="h-2.5 rounded-full bg-secondary/70 overflow-hidden">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, val))}%` }} />
      </span>
      <b className="text-right tabular-nums">{val}%</b>
    </div>
  );
}

export default function SarhisobDetailDrawer({
  exam,
  all,
  onClose,
  onExport,
}: {
  exam: GroupExam;
  /** Joriy filialdagi barcha sarhisoblar — solishtirish uchun. */
  all: GroupExam[];
  onClose: () => void;
  onExport: (exam: GroupExam) => void;
}) {
  const { t, months: MONTH_NAMES } = useT();
  const modal = useModalClose(onClose, "drawer");

  const month = groupExamMonth(exam);
  const monthLabel = (() => {
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    return m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : month;
  })();

  const cmp = useMemo(() => {
    const monthRecs = all.filter((r) => groupExamMonth(r) === month);
    const subjRecs = monthRecs.filter((r) => r.course.toLowerCase() === exam.course.toLowerCase());
    return { subjAvg: pupilAvgPct(subjRecs), centerAvg: pupilAvgPct(monthRecs) };
  }, [all, exam.course, month]);

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" size="2xl" zIndex={110}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold truncate">
            {exam.groupLabel} ‧ {monthLabel}
          </h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">{t("Sarhisob tafsiloti")}</p>
        </div>
        <button
          type="button"
          onClick={modal.close}
          className="h-8 w-8 shrink-0 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
          title={t("Yopish")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
          <div>
            <div className="text-[12px] text-muted-foreground">{t("Fan / Ustoz")}</div>
            <div>
              <b>{exam.course}</b> — {exam.teacher}
            </div>
          </div>
          <div>
            <div className="text-[12px] text-muted-foreground">{t("Sana / Savollar")}</div>
            <div>
              <b className="tabular-nums">{fmtExamDate(exam.date)}</b> — {t("{total} ta savol", { total: exam.total })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-secondary/30 text-[14px] font-semibold">{t("Solishtirish")}</div>
          <div className="px-4 py-3.5 space-y-2.5">
            <CmpBar label={t("Bu guruh")} val={exam.avgPct} strong />
            <CmpBar label={t("{course} bo'yicha", { course: exam.course })} val={cmp.subjAvg} />
            <CmpBar label={t("Markaz o'rtachasi")} val={cmp.centerAvg} />
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-secondary/30 text-[14px] font-semibold">{t("O'quvchilar natijasi")}</div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-2 w-12">№</th>
                <th className="text-left px-3 py-2">{t("O'quvchi")}</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">{t("To'g'ri")}</th>
                <th className="text-left px-3 py-2 w-28">{t("O'zlashtirish")}</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">{t("Guruhga nisbatan")}</th>
              </tr>
            </thead>
            <tbody>
              {exam.students.map((s, i) => {
                const d = s.pct - exam.avgPct;
                return (
                  <tr key={s.pupilId} className="border-b border-border/50 last:border-b-0">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                    <td className="px-3 py-2 text-[13px]">{s.name}</td>
                    <td className="px-3 py-2 text-[13px] tabular-nums text-right whitespace-nowrap">
                      {s.correct} / {exam.total}
                    </td>
                    <td className="px-3 py-2">
                      <TierBadge pct={s.pct} />
                    </td>
                    <td
                      className={`px-3 py-2 text-[13px] tabular-nums text-right font-medium ${
                        d > 0 ? "text-emerald-600 dark:text-emerald-400" : d < 0 ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground"
                      }`}
                    >
                      {d > 0 ? "+" : ""}
                      {d}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30 border-t border-border">
                <td colSpan={3} className="px-3 py-2 text-[12px] font-semibold">{t("Guruh o'rtachasi")}</td>
                <td className="px-3 py-2" colSpan={2}>
                  <TierBadge pct={exam.avgPct} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="text-[11px] text-muted-foreground">
          {t("Kiritildi: {stamp}", { stamp: exam.createdAt })}
          {exam.createdBy ? ` · ${exam.createdBy}` : ""}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
        <button
          onClick={modal.close}
          className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
        >
          {t("Yopish")}
        </button>
        <button
          onClick={() => onExport(exam)}
          className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
        >
          <Share2 className="w-4 h-4" />
          {t("Excelga chiqarish")}
        </button>
      </div>
    </Modal>
  );
}
