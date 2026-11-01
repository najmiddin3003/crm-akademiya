"use client";

import { useMemo } from "react";
import { Archive, ArchiveRestore, Download, Pencil, Trash2 } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { pupilAvgPct } from "@/components/imtihon/SarhisobDetailDrawer";
import { useMonthLabel } from "@/components/imtihon/sarhisobCore";
import { groupExamMonth, type GroupExam } from "@/lib/imtihon";
import { CompareRow, ScoreBar, examBand } from "./examBits";

// YANGI VERSIYA — SARHISOB TAFSILOTI (o'ngdan panel). Rasmi kelmagan — eski tafsilot
// panelidagi ma'lumot (fan/ustoz, sana/savollar, solishtirish, o'quvchilar natijasi va
// guruhga nisbati) yangi ko'rinishda: taqqoslash qatorlari «Natija kiritish» kartasidek.
// Hisob eski panel bilan bir xil (shu oydagi sarhisoblar, o'quvchi natijalari ustidan;
// arxivdagilarsiz — `all` ro'yxatdan keladi).
// Amallar (01.11.2026): «Tahrirlash», «Arxivlash» / «Arxivdan chiqarish», «O'chirish»
// (tasdiq — ro'yxatda) — tana boshida kichik tugmalar (telefonda pastki qator ustma-ust
// tushadi, shu bois u yerda faqat «Yopish» va «Eksport»).

const toolBase =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-3 text-v2-small font-medium transition-[background-color,box-shadow] focus-visible:shadow-v2-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const toolBtn = `${toolBase} text-v2-text hover:bg-v2-surface-2`;
const toolDanger = `${toolBase} text-v2-danger hover:bg-v2-danger-bg`;

function dateOfIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export default function SarhisobDetailV2({
  exam,
  all,
  busy,
  onClose,
  onExport,
  onEdit,
  onArchive,
  onDelete,
}: {
  exam: GroupExam;
  /** Taqqoslash uchun — joriy filialning arxivdagisiz sarhisoblari. */
  all: GroupExam[];
  /** Arxiv/o'chirish so'rovi ketmoqda — tugmalar o'chiq. */
  busy: boolean;
  onClose: () => void;
  onExport: (exam: GroupExam) => void;
  onEdit: () => void;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  const [lang] = useLang();
  const monthLabel = useMonthLabel();
  const month = groupExamMonth(exam);
  const d = dateOfIso(exam.date);

  const cmp = useMemo(() => {
    const monthRecs = all.filter((r) => groupExamMonth(r) === month);
    const subjRecs = monthRecs.filter((r) => r.course.toLowerCase() === exam.course.toLowerCase());
    return { subj: subjRecs.length ? pupilAvgPct(subjRecs) : null, center: monthRecs.length ? pupilAvgPct(monthRecs) : null };
  }, [all, exam.course, month]);

  const students = [...exam.students].sort((a, b) => b.pct - a.pct);

  return (
    <V2Dialog
      variant="right"
      width={560}
      title={exam.groupLabel}
      subtitle={[monthLabel(month), d ? dayMonthLabel(d, lang) : exam.date, t("{total} ta savol", { total: exam.total })].join(" · ")}
      onClose={onClose}
      footerStart={
        <span className="flex flex-col text-v2-caption font-normal text-v2-text-3">
          <span>
            {t("Kiritildi: {stamp}", { stamp: exam.createdAt })}
            {exam.createdBy ? ` · ${exam.createdBy}` : ""}
          </span>
          {exam.updatedAt && (
            <span>
              {t("Tahrirlandi: {stamp}", { stamp: exam.updatedAt })}
              {exam.updatedBy ? ` · ${exam.updatedBy}` : ""}
            </span>
          )}
        </span>
      }
      footer={(api) => (
        <>
          <button type="button" onClick={api.close} className={`${secondaryBtn} justify-center`}>
            {t("Yopish")}
          </button>
          <button type="button" onClick={() => onExport(exam)} className={`${primaryBtn} justify-center`}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Eksport")}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onEdit} disabled={busy} className={toolBtn}>
            <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Tahrirlash")}
          </button>
          <button type="button" onClick={() => onArchive(!exam.archived)} disabled={busy} className={toolBtn}>
            {exam.archived ? <ArchiveRestore className="size-4" strokeWidth={1.75} aria-hidden /> : <Archive className="size-4" strokeWidth={1.75} aria-hidden />}
            {exam.archived ? t("Arxivdan chiqarish") : t("Arxivlash")}
          </button>
          <button type="button" onClick={onDelete} disabled={busy} className={toolDanger}>
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
            {t("O'chirish")}
          </button>
        </div>

        {exam.archived && (
          <div role="note" className="flex items-start gap-2 rounded-v2-md bg-v2-surface-2 px-3 py-2.5 text-v2-small text-v2-text">
            <Archive className="mt-0.5 size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0">
              {t("Arxivda — Sarhisob ro'yxati, ko'rsatkichlar va ochiq sahifada ko'rinmaydi. Tangalar va botdagi natija o'zgarmagan.")}
              {exam.archivedAt && (
                <span className="mt-0.5 block text-v2-caption font-normal text-v2-text-3">
                  {exam.archivedAt}
                  {exam.archivedBy ? ` · ${exam.archivedBy}` : ""}
                </span>
              )}
            </span>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3 text-v2-small">
          <div className="min-w-0 rounded-v2-md bg-v2-surface-2 px-3 py-2.5">
            <dt className="text-v2-caption font-normal text-v2-text-2">{t("Fan")}</dt>
            <dd className="mt-0.5 flex min-w-0 items-center gap-1.5 font-semibold text-v2-text">
              <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(exam.course)]}`} aria-hidden />
              <span className="truncate">{exam.course}</span>
            </dd>
          </div>
          <div className="min-w-0 rounded-v2-md bg-v2-surface-2 px-3 py-2.5">
            <dt className="text-v2-caption font-normal text-v2-text-2">{t("Ustoz")}</dt>
            <dd className="mt-0.5 truncate font-semibold text-v2-text">{exam.teacher || "—"}</dd>
          </div>
        </dl>

        <section>
          <h3 className="text-v2-small font-semibold text-v2-text">{t("Taqqoslash")}</h3>
          <div className="mt-2.5 space-y-3">
            <CompareRow label={t("Bu guruh")} value={exam.avgPct} strong />
            <CompareRow label={t("{course} · markaz o'rtachasi", { course: exam.course })} value={cmp.subj} />
            <CompareRow label={t("Barcha fanlar · markaz")} value={cmp.center} />
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-v2-small font-semibold text-v2-text">{t("O'quvchilar natijasi")}</h3>
            <span className="text-v2-caption font-normal text-v2-text-2">{t("{n} ta o'quvchi", { n: exam.studentCount })}</span>
          </div>
          <ul className="mt-2 divide-y divide-v2-border rounded-v2-md border border-v2-border">
            {students.map((s) => {
              const delta = s.pct - exam.avgPct;
              return (
                <li key={s.pupilId} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-v2-small font-semibold text-v2-text">{s.name}</div>
                    <div className="mt-0.5 text-v2-caption font-normal tabular-nums text-v2-text-2">
                      {s.correct} / {exam.total}
                      <span className={`ml-2 ${delta > 0 ? "text-v2-success" : delta < 0 ? "text-v2-danger" : "text-v2-text-3"}`}>
                        {delta > 0 ? "+" : ""}
                        {delta}% {t("guruhga nisbatan")}
                      </span>
                    </div>
                  </div>
                  <ScoreBar pct={s.pct} className="w-[96px]" />
                  <span className={`w-11 shrink-0 text-right text-v2-small font-semibold tabular-nums ${examBand(s.pct) === "low" ? "text-v2-warning" : "text-v2-text"}`}>{s.pct}%</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </V2Dialog>
  );
}
