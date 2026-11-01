"use client";

import { useCallback, useMemo, useState } from "react";
import { Archive, ArrowLeft, FilePlus, Share2 } from "lucide-react";
import Select from "@/components/ui/Select";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import DeleteConfirmModal from "@/components/offline-courses/DeleteConfirmModal";
import { uzDateIso } from "@/lib/uzTime";
import { groupExamMonth, liveExams, type GroupExam } from "@/lib/imtihon";
import { downloadCsv } from "./importUtils";
import TierBadge from "./TierBadge";
import GroupExamDrawer from "./GroupExamDrawer";
import SarhisobDetailDrawer, { fmtExamDate, pupilAvgPct } from "./SarhisobDetailDrawer";
import { sarhisobCsvRows, upsertExam, useCopyGroupLink, useExamActions, useGroupExams, useMonthLabel } from "./sarhisobCore";
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
// «Havolani nusxalash» (01.11.2026) — sarhisob oynasining (SarhisobDetailDrawer)
// sarlavhasida: shu GURUHNING kirishsiz natijalar sahifasi (/natijalar/<kalit>?oy=…,
// sarhisobCore.groupResultsUrl). Yuqoridagi umumiy (butun filial) tugma olib tashlandi.
// Tahrirlash / arxivlash / o'chirish (01.11.2026) — tafsilot panelining pastki qatorida
// (yangi versiyadagi SarhisobListV2 bilan bir xil qoida): arxivdagilar ro'yxat, KPI va
// solishtirishdan yashiriladi, «Arxiv (n)» — ularni barcha oylar bo'yicha ko'rsatadi.

function Kpi({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      <div className="text-[24px] leading-tight font-bold tabular-nums tracking-tight">{value}</div>
      <div className="text-[12px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

const outlineBtn =
  "inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed";

export default function SarhisobView() {
  const { t } = useT();
  const { showSuccess } = useToast();

  // Ro'yxat, oy nomi va CSV — umumiy yadro (sarhisobCore.ts; yangi versiya ham shundan).
  const { exams, setExams, loading } = useGroupExams();
  const copyGroupLink = useCopyGroupLink();
  const { busyId, setArchived, remove } = useExamActions(setExams);
  // `null` — foydalanuvchi hali tanlamagan: eng oxirgi sarhisob oyi
  // (bo'lmasa joriy oy) ko'rsatiladi.
  const [fMonth, setFMonth] = useState<string | null>(null);
  const [fCourse, setFCourse] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState<GroupExam | null>(null);
  const [confirmDel, setConfirmDel] = useState<GroupExam | null>(null);
  /** Arxiv ko'rinishi — arxivdagi sarhisoblar, barcha oylar. */
  const [archiveView, setArchiveView] = useState(false);

  const monthLabel = useMonthLabel();

  const live = useMemo(() => liveExams(exams), [exams]);
  const archived = useMemo(() => exams.filter((r) => r.archived), [exams]);

  const monthOptions = useMemo(() => {
    const set = new Set(live.map(groupExamMonth));
    set.add(uzDateIso().slice(0, 7));
    return [...set].sort().reverse().map((m) => ({ value: m, label: monthLabel(m) }));
  }, [live, monthLabel]);
  const fm = fMonth ?? monthOptions[0]?.value ?? "";

  const base = archiveView ? archived : live;
  const courseOptions = useMemo(
    () => [...new Set(base.map((r) => r.course))].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c })),
    [base],
  );

  const rows = useMemo(
    () => base.filter((r) => (archiveView || !fm || groupExamMonth(r) === fm) && (!fCourse || r.course === fCourse)),
    [base, archiveView, fm, fCourse],
  );

  const studentCount = rows.reduce((s, r) => s + r.studentCount, 0);
  const centerAvg = pupilAvgPct(rows);
  const top = rows.reduce((m, r) => r.students.reduce((mm, s) => Math.max(mm, s.pct), m), 0);

  /** Referensdagi CSV: har bir o'quvchi alohida qator; nomi Sarhisob_YYYY-MM.csv. */
  function exportCsv(list: GroupExam[], month: string) {
    downloadCsv(sarhisobCsvRows(list, monthLabel), `Sarhisob_${month || "hammasi"}.csv`);
    showSuccess(t("📤 Yuklab olindi — {n} ta sarhisob (Excel'da ochiladi)", { n: list.length }));
  }

  function toggleArchive() {
    setArchiveView((v) => !v);
    setFCourse("");
  }

  const onSaved = useCallback(
    (exam: GroupExam) => {
      setExams((prev) => upsertExam(prev, exam));
      setFMonth(groupExamMonth(exam));
      setFCourse("");
    },
    [setExams],
  );

  const open = openId === null ? null : exams.find((r) => r.id === openId) || null;

  return (
    <div className="space-y-4">
      {/* Filtrlar va amallar */}
      <div className="flex items-center gap-2 flex-wrap">
        {archiveView ? (
          <button type="button" onClick={toggleArchive} className={outlineBtn}>
            <ArrowLeft className="w-4 h-4" />
            <span>{t("Ro'yxatga qaytish")}</span>
          </button>
        ) : (
          <Select value={fm} onChange={(v) => setFMonth(v)} options={monthOptions} size="sm" className="w-44" />
        )}
        <Select
          value={fCourse}
          onChange={(v) => setFCourse(v)}
          options={courseOptions}
          placeholder={t("Barcha fanlar")}
          clearable
          size="sm"
          className="w-48"
        />
        {!archiveView && archived.length > 0 && (
          <button
            type="button"
            onClick={toggleArchive}
            title={t("Arxivdagi sarhisoblar — ro'yxat va ochiq sahifada ko'rinmaydi")}
            className={outlineBtn}
          >
            <Archive className="w-4 h-4" />
            <span>{t("Arxiv ({n})", { n: archived.length })}</span>
          </button>
        )}
        <div className="flex-1" />
        <button onClick={() => exportCsv(rows, archiveView ? "arxiv" : fm)} disabled={rows.length === 0} className={outlineBtn}>
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
      {!archiveView && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi value={rows.length} label={t("Sarhisob soni")} />
          <Kpi value={studentCount} label={t("Natija kiritilgan o'quvchi")} />
          <Kpi value={`${centerAvg}%`} label={t("Markaz o'rtachasi")} />
          <Kpi value={`${top}%`} label={t("Eng yuqori natija")} />
        </div>
      )}

      {/* Jadval */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[15px] font-semibold">
            {archiveView ? t("Arxivdagi sarhisoblar") : fm ? t("{month} sarhisoblari", { month: monthLabel(fm) }) : t("Barcha sarhisoblar")}
          </div>
          {archiveView && (
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {t("Ro'yxat, ko'rsatkichlar va ochiq sahifada ko'rinmaydi; tangalar va botdagi natija o'zgarmaydi.")}
            </div>
          )}
        </div>
        {loading ? (
          <div className="px-4 py-8">
            <SpinnerBlock size={22} />
          </div>
        ) : rows.length === 0 ? (
          archiveView ? (
            <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
              <div className="text-[14px] font-semibold text-foreground mb-3">{t("Arxivda sarhisob yo'q")}</div>
              <button type="button" onClick={toggleArchive} className={outlineBtn}>
                <ArrowLeft className="w-4 h-4" />
                {t("Ro'yxatga qaytish")}
              </button>
            </div>
          ) : (
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
          )
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

      {editing && <GroupExamDrawer key={editing.id} editing={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}

      {open && (
        <SarhisobDetailDrawer
          exam={open}
          all={live}
          busy={busyId === open.id}
          onClose={() => setOpenId(null)}
          onExport={(r) => exportCsv([r], groupExamMonth(r))}
          onCopyLink={() => void copyGroupLink(open)}
          onEdit={() => {
            setOpenId(null);
            setEditing(open);
          }}
          onArchive={(a) => void setArchived(open, a)}
          onDelete={() => setConfirmDel(open)}
        />
      )}

      {confirmDel && (
        <DeleteConfirmModal
          title={t("Sarhisobni o'chirish")}
          message={t(
            "Natijalar butunlay o'chadi, shu oyning Sarhisob tangalari va o'quvchilar botidagi natija qayta hisoblanadi (faqat yashirish uchun — «Arxivlash»). O'chirilsinmi:",
          )}
          name={`${confirmDel.groupLabel} · ${monthLabel(groupExamMonth(confirmDel))}`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            const ex = confirmDel;
            setConfirmDel(null);
            void remove(ex).then((ok) => {
              if (ok) setOpenId((cur) => (cur === ex.id ? null : cur));
            });
          }}
        />
      )}
    </div>
  );
}
