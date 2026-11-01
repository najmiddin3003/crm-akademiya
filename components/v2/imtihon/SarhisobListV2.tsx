"use client";

import { useMemo, useState, type Dispatch, type MouseEvent, type SetStateAction } from "react";
import { Archive, ArchiveRestore, ArrowLeft, Download, FilePlus, Link2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Select from "@/components/v2/ui/V2Select";
import V2Confirm from "@/components/v2/form/V2Confirm";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { downloadCsv } from "@/components/imtihon/importUtils";
import { pupilAvgPct } from "@/components/imtihon/SarhisobDetailDrawer";
import { examGroupTitle, sarhisobCsvRows, useCopyGroupLink, useExamActions, useMonthLabel } from "@/components/imtihon/sarhisobCore";
import { useCenterRanking } from "@/components/imtihon/useCenterRanking";
import { rankingCsvRows } from "@/lib/examRanking";
import { uzDateIso } from "@/lib/uzTime";
import { groupExamMonth, isGroupless, liveExams, type GroupExam } from "@/lib/imtihon";
import CenterRankingV2 from "./CenterRankingV2";
import CenterShareDialogV2 from "./CenterShareDialogV2";
import SarhisobDetailV2 from "./SarhisobDetailV2";
import { ImtihonHeader, SarhisobViewSwitch, ScoreBar, examBand, examTh as th, type SarhisobView } from "./examBits";

// YANGI VERSIYA — IMTIHON → SARHISOB RO'YXATI. Rasmi KELMAGAN (8-qismda faqat «Natija
// kiritish» bor) — eski Sarhisob tabidagi hamma narsa yangi qoidalar bilan: oy va fan
// filtri, to'rt ko'rsatkich, oydagi sarhisoblar jadvali (qator bosilsa — tafsilot),
// «Eksport» (Sarhisob_YYYY-MM.csv, eski bilan bir xil) va «+ Natija kiritish»
// (rasmdagi ekranga o'tadi). SAVOLLAR 139.
// «Havolani nusxalash» (01.11.2026, SAVOLLAR 236) — qatordagi «⋯» menyusida: shu GURUHNING
// natijalar sahifasi (/natijalar/<kalit>?oy=<sarhisob oyi>, kirishsiz; sarhisobCore.groupResultsUrl).
// Arxivdagi sarhisobda yo'q — ochiq sahifa uni ko'rsatmaydi. Yuqoridagi umumiy (butun filial)
// «Ochiq havolani nusxalash» tugmasi olib tashlandi.
// TAHRIRLASH / ARXIVLASH / O'CHIRISH (01.11.2026, SAVOLLAR 235) — qatordagi «⋯» va
// tafsilot panelida. Arxivdagilar ro'yxat, ko'rsatkich, taqqoslash va ochiq sahifadan
// yashiriladi (tanga va botdagi natija o'zgarmaydi) — «Arxiv» tugmasi ularni barcha
// oylar bo'yicha ko'rsatadi, u yerdan qaytariladi. O'chirish — tasdiq bilan.
// MARKAZ REYTINGI (01.11.2026, SAVOLLAR 238) — filtr qatori boshidagi segment «Guruhlar bo'yicha |
// Markaz reytingi»: oyning barcha guruhlaridagi o'quvchilar bitta reytingda (CenterRankingV2,
// qoidalar lib/examRanking.ts), filtrlar — Oy va Fan (ro'yxat bilan umumiy) + Bosqich, Ustoz,
// Guruh va qidiruv; «Eksport» shu ko'rinishda reytingni chiqaradi (Reyting_YYYY-MM.csv).
// Ko'rinish manzilda `reyting=1` (qayta yuklansa, tahrirdan qaytilsa saqlanadi — ImtihonV2).

function dateOfIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export default function SarhisobListV2({
  exams,
  setExams,
  loading,
  initialMonth,
  initialView,
  onAdd,
  onEdit,
}: {
  exams: GroupExam[];
  setExams: Dispatch<SetStateAction<GroupExam[]>>;
  loading: boolean;
  /** Manzildagi `oy=` (natija saqlangach shu oyga qaytiladi). */
  initialMonth: string | null;
  /** Manzildagi `reyting=1` — markaz reytingi. */
  initialView: SarhisobView;
  onAdd: (month: string) => void;
  /** «Tahrirlash» — natija kiritish ekrani tahrir rejimida; `month` — qaytiladigan ro'yxat oyi. */
  onEdit: (exam: GroupExam, month: string) => void;
}) {
  const { t } = useT();
  const [lang] = useLang();
  const { showSuccess } = useToast();
  const monthLabel = useMonthLabel();
  const copyGroupLink = useCopyGroupLink();
  const { busyId, setArchived, remove } = useExamActions(setExams);
  const [fMonth, setFMonth] = useState<string | null>(initialMonth);
  const [fCourse, setFCourse] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  /** «Arxiv» ko'rinishi — arxivdagi sarhisoblar, barcha oylar. */
  const [archiveView, setArchiveView] = useState(false);
  const [confirmDel, setConfirmDel] = useState<GroupExam | null>(null);
  const [view, setView] = useState<SarhisobView>(initialView);
  /** «Ulashish» oynasi — markaz reytingining ochiq havolasi, belgilangan qismlar bilan. */
  const [shareOpen, setShareOpen] = useState(false);

  const live = useMemo(() => liveExams(exams), [exams]);
  const archived = useMemo(() => exams.filter((r) => r.archived), [exams]);

  const monthOptions = useMemo(() => {
    const set = new Set(live.map(groupExamMonth));
    set.add(uzDateIso().slice(0, 7));
    if (initialMonth) set.add(initialMonth);
    return [...set]
      .sort()
      .reverse()
      .map((m) => ({ value: m, label: monthLabel(m) }));
  }, [live, monthLabel, initialMonth]);
  // Tanlanmagan bo'lsa — eng oxirgi oy (eski sahifadagidek).
  const fm = fMonth ?? monthOptions[0]?.value ?? "";

  const base = archiveView ? archived : live;
  const courseOptions = useMemo(
    () => [...new Set(base.map((r) => r.course))].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c })),
    [base],
  );

  // Arxivda oy filtri yo'q — arxiv odatda kichik, qaysi oyda ekanini eslash shart emas.
  const rows = useMemo(
    () => base.filter((r) => (archiveView || !fm || groupExamMonth(r) === fm) && (!fCourse || r.course === fCourse)),
    [base, archiveView, fm, fCourse],
  );
  const studentCount = rows.reduce((s, r) => s + r.studentCount, 0);
  const centerAvg = rows.length ? pupilAvgPct(rows) : null;
  const top = rows.reduce((m, r) => r.students.reduce((mm, s) => Math.max(mm, s.pct), m), 0);

  // Markaz reytingi — arxiv ko'rinishida yo'q (arxivdagilar reytingga kirmaydi).
  const rankOn = view === "rank" && !archiveView;
  const rk = useCenterRanking(live, fm, fCourse, rankOn);

  function exportCsv(list: GroupExam[], month: string) {
    downloadCsv(sarhisobCsvRows(list, monthLabel), `Sarhisob_${month || "hammasi"}.csv`);
    showSuccess(t("Yuklab olindi — {n} ta sarhisob (Excel'da ochiladi)", { n: list.length }));
  }

  function exportRanking() {
    downloadCsv(rankingCsvRows(rk.visible), `Reyting_${fm}.csv`);
    showSuccess(t("Yuklab olindi — {n} ta natija (Excel'da ochiladi)", { n: rk.visible.length }));
  }

  function toggleArchive() {
    setArchiveView((v) => !v);
    setFCourse("");
  }

  /**
   * Ko'rinish almashadi; manzilda `reyting=1` (oy va boshqa parametrlar o'zgarmaydi — ro'yxat
   * qayta yaratilmasin). `null` holat: Next o'z holatini o'zi ko'chiradi va useSearchParams
   * yangilanadi (window.history.state uzatilsa — yangilanmaydi).
   */
  function changeView(v: SarhisobView) {
    setView(v);
    const q = new URLSearchParams(window.location.search);
    if (v === "rank") q.set("reyting", "1");
    else q.delete("reyting");
    const s = q.toString();
    window.history.replaceState(null, "", s ? `${window.location.pathname}?${s}` : window.location.pathname);
  }

  function clearRankFilters() {
    setFCourse("");
    rk.clear();
  }

  const groupTitle = (r: GroupExam) => examGroupTitle(r, t);

  function rowMenu(r: GroupExam): ActionMenuEntry[] {
    const busy = busyId === r.id;
    return [
      { key: "h", heading: `${r.course} · ${groupTitle(r)}` },
      // Arxivdagi sarhisob ochiq sahifada ko'rinmaydi — havolasi berilmaydi; guruhsiz ro'yxatning guruh
      // sahifasi yo'q (uning natijalari markaz reytingi havolasida).
      ...(r.archived || isGroupless(r) ? [] : [{ key: "link", label: t("Havolani nusxalash"), icon: Link2, onSelect: () => void copyGroupLink(r) }]),
      { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => onEdit(r, fm), disabled: busy },
      r.archived
        ? { key: "unarchive", label: t("Arxivdan chiqarish"), icon: ArchiveRestore, onSelect: () => void setArchived(r, false), disabled: busy }
        : { key: "archive", label: t("Arxivlash"), icon: Archive, onSelect: () => void setArchived(r, true), disabled: busy },
      { key: "d", divider: true },
      { key: "delete", label: t("O'chirish"), icon: Trash2, danger: true, onSelect: () => setConfirmDel(r), disabled: busy },
    ];
  }

  /** Qator bosilsa — tafsilot; «⋯» va uning menyusi (portal ham React bo'ylab ko'tariladi) — o'z ishi. */
  function onRowClick(e: MouseEvent<HTMLTableRowElement>, id: number) {
    const el = e.target as HTMLElement;
    if (!e.currentTarget.contains(el) || el.closest("button, a, input, label")) return;
    setOpenId(id);
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
            {/* Reytingning ochiq havolasi — oynada qaysi qismlar chiqishi belgilanadi; havolaga shu oy va
                fan o'tadi (bosqich, ustoz, guruh filtri va qidiruv — yo'q). Oyda natija bo'lmasa — o'chiq. */}
            {rankOn && (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                disabled={loading || rk.pool.length === 0}
                className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Link2 className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Ulashish")}
              </button>
            )}
            <button
              type="button"
              onClick={() => (rankOn ? exportRanking() : exportCsv(rows, archiveView ? "arxiv" : fm))}
              disabled={rankOn ? rk.visible.length === 0 : rows.length === 0}
              className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}
            >
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
        {archiveView ? (
          <button type="button" onClick={toggleArchive} className={secondaryBtn}>
            <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Ro'yxatga qaytish")}
          </button>
        ) : (
          <>
            <SarhisobViewSwitch value={view} onChange={changeView} />
            <V2Select variant="value" label={t("Oy")} value={fm} onChange={(v) => setFMonth(v || null)} options={monthOptions} searchable={false} clearable={false} />
          </>
        )}
        <V2Select variant="chip" label={t("Fan")} value={fCourse} onChange={setFCourse} options={rankOn ? rk.options.course : courseOptions} />
        {rankOn && (
          <>
            {(rk.options.level.length > 0 || rk.level) && <V2Select variant="chip" label={t("Bosqich")} value={rk.level} onChange={rk.setLevel} options={rk.options.level} />}
            {(rk.options.teacher.length > 0 || rk.teacher) && <V2Select variant="chip" label={t("Ustoz")} value={rk.teacher} onChange={rk.setTeacher} options={rk.options.teacher} />}
            {(rk.options.group.length > 0 || rk.group) && <V2Select variant="chip" label={t("Guruh")} value={rk.group} onChange={rk.setGroup} options={rk.options.group} />}
            <div className="relative w-full sm:ml-auto sm:w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <input
                type="search"
                value={rk.query}
                onChange={(e) => rk.setQuery(e.target.value)}
                placeholder={t("Ism yoki telefon")}
                aria-label={t("O'quvchini qidirish")}
                className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
              />
            </div>
          </>
        )}
        {!archiveView && !rankOn && archived.length > 0 && (
          <button
            type="button"
            onClick={toggleArchive}
            title={t("Arxivdagi sarhisoblar — ro'yxat va ochiq sahifada ko'rinmaydi")}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-3 text-v2-body font-medium text-v2-text transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus"
          >
            <Archive className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
            {t("Arxiv")}
            <span className="rounded-v2-full bg-v2-surface-2 px-1.5 text-v2-caption tabular-nums text-v2-text-2">{archived.length}</span>
          </button>
        )}
      </div>

      {rankOn ? (
        <CenterRankingV2
          rk={rk}
          loading={loading}
          monthTitle={monthLabel(fm)}
          onOpen={setOpenId}
          onAdd={() => onAdd(fm || uzDateIso().slice(0, 7))}
          onClearFilters={clearRankFilters}
        />
      ) : (
        <>
          {!archiveView && (
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm min-[64rem]:grid-cols-4">
              {kpis.map((k) => (
                <div key={k.label} className="min-w-0 bg-v2-surface px-4 py-3">
                  <div className="truncate text-v2-small font-medium text-v2-text-2">{k.label}</div>
                  <div className="mt-1 text-[1.375rem] font-semibold leading-7 tabular-nums text-v2-text">{loading ? "—" : k.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
              <h2 className="text-v2-section text-v2-text">
                {archiveView ? t("Arxivdagi sarhisoblar") : fm ? t("{month} sarhisoblari", { month: monthLabel(fm) }) : t("Barcha sarhisoblar")}
              </h2>
              {archiveView && <p className="text-v2-small text-v2-text-2">{t("Ro'yxat, ko'rsatkichlar va ochiq sahifada ko'rinmaydi; tangalar va botdagi natija o'zgarmaydi.")}</p>}
            </div>
            <div className="max-h-[70vh] min-h-0 overflow-auto">
              <table className="w-full min-w-[860px] border-collapse text-v2-body">
                <thead>
                  <tr>
                    <th className={`${th} pl-4 pr-3`}>{t("Sana")}</th>
                    <th className={`${th} px-3`}>{t("Fan")}</th>
                    <th className={`${th} px-3`}>{t("Ustoz")}</th>
                    <th className={`${th} px-3`}>{t("Guruh")}</th>
                    <th className={`${th} px-3 text-right`}>{t("O'quvchi")}</th>
                    <th className={`${th} px-3 text-right`}>{t("Savol")}</th>
                    <th className={`${th} px-3`}>{t("Guruh o'rtachasi")}</th>
                    <th className={`${th} w-12 pl-1 pr-3`}>
                      <span className="sr-only">{t("Amallar")}</span>
                    </th>
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
                        <td />
                      </tr>
                    ))}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6">
                        {archiveView ? (
                          <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                            <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                              <Archive className="size-5" strokeWidth={1.75} aria-hidden />
                            </span>
                            <div className="text-v2-section text-v2-text">{t("Arxivda sarhisob yo'q")}</div>
                            <button type="button" onClick={toggleArchive} className={`${secondaryBtn} mt-2`}>
                              <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
                              {t("Ro'yxatga qaytish")}
                            </button>
                          </div>
                        ) : (
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
                        )}
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    rows.map((r) => {
                      const d = dateOfIso(r.date);
                      const name = `${r.course} · ${groupTitle(r)}`;
                      return (
                        <tr
                          key={r.id}
                          tabIndex={0}
                          onClick={(e) => onRowClick(e, r.id)}
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
                          <td className="px-3 py-3 text-v2-small text-v2-text">{r.teacher || "—"}</td>
                          <td className="px-3 py-3 text-v2-small">
                            <span className="font-semibold text-v2-text group-hover:underline group-hover:underline-offset-2">{groupTitle(r)}</span>
                            {r.level ? <span className="text-v2-text-3"> · {t(r.level)}</span> : null}
                          </td>
                          <td className="px-3 py-3 text-right text-v2-small tabular-nums text-v2-text">{r.studentCount}</td>
                          <td className="px-3 py-3 text-right text-v2-small tabular-nums text-v2-text">{r.total}</td>
                          <td className="px-3 py-3">
                            <span className="flex items-center gap-2.5">
                              <ScoreBar pct={r.avgPct} className="w-[96px]" />
                              <span className={`text-v2-small font-semibold tabular-nums ${examBand(r.avgPct) === "low" ? "text-v2-warning" : "text-v2-text"}`}>{r.avgPct}%</span>
                            </span>
                          </td>
                          <td className="py-2 pl-1 pr-3 text-right">
                            <ActionMenu items={rowMenu(r)} label={t("{name} — amallar", { name })} width={232}>
                              {(trigger, menuOpen) => (
                                <button
                                  type="button"
                                  {...trigger}
                                  title={t("Amallar")}
                                  aria-label={t("{name} — amallar", { name })}
                                  className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-[opacity,background-color] hover:bg-v2-surface-2 hover:text-v2-text focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-v2-focus [@media(hover:none)]:opacity-100 ${
                                    menuOpen ? "bg-v2-surface-2 opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                                  }`}
                                >
                                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                                </button>
                              )}
                            </ActionMenu>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {open && (
        <SarhisobDetailV2
          exam={open}
          all={live}
          busy={busyId === open.id}
          onClose={() => setOpenId(null)}
          onExport={(r) => exportCsv([r], groupExamMonth(r))}
          onEdit={() => onEdit(open, fm)}
          onArchive={(a) => void setArchived(open, a)}
          onDelete={() => setConfirmDel(open)}
        />
      )}

      {shareOpen && <CenterShareDialogV2 month={fm} monthLabel={monthLabel(fm)} course={fCourse} onClose={() => setShareOpen(false)} />}
      {confirmDel && (
        <V2Confirm
          title={t("Sarhisobni o'chirasizmi?")}
          body={t(
            "{name} — {n} ta o'quvchining natijasi butunlay o'chadi; shu oyning Sarhisob tangalari va o'quvchilar botidagi natija qayta hisoblanadi. Faqat ro'yxatdan yashirish kerak bo'lsa — «Arxivlash».",
            { name: `${confirmDel.course} · ${groupTitle(confirmDel)} · ${monthLabel(groupExamMonth(confirmDel))}`, n: confirmDel.studentCount },
          )}
          confirmLabel={t("O'chirish")}
          icon={Trash2}
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
