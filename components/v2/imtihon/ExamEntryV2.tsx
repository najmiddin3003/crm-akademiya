"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, Download, FileUp, Loader2, Plus, Users } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useTeachers } from "@/hooks/useTeachers";
import { useGroups } from "@/hooks/useGroups";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import { uzDateIso } from "@/lib/uzTime";
import { groupAvgPct, groupExamMonth, imPct, type GroupExam } from "@/lib/imtihon";
import V2Picker, { type PickerOption } from "@/components/v2/form/V2Picker";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { shiftMonth } from "@/components/v2/form/MonthChips";
import { fieldCls } from "@/components/v2/form/fields";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { timeLabel } from "@/components/v2/ui/groupStatus";
import { ROW_TINT } from "@/components/v2/ui/table";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import NewStudentDrawerV2 from "@/components/v2/students/NewStudentDrawerV2";
import { downloadCsv, intOf, normHeader, readFileRows } from "@/components/imtihon/importUtils";
import { useMonthLabel } from "@/components/imtihon/sarhisobCore";
import ExamSideCard, { type SidePupil } from "./ExamSideCard";
import { ImtihonHeader, ScoreBar, examBand } from "./examBits";

// YANGI VERSIYA — IMTIHON → SARHISOB → «NATIJA KIRITISH» (rasm «Sarhisob · Natija
// kiritish», yorug'/qorong'i, 23.10.2026):
//   • yo'l «Sarhisob › Natija kiritish», «Imtihon», «Eksport»; tablar Sarhisob | UzBMB;
//   • tanlovlar paneli (surface-2): Fan («avto» — guruhdan olindi), Ustoz, Guruh, Oy,
//     Sana, Savollar soni («25 ta»). Tartib erkin: guruh tanlansa fan (va bo'sh bo'lsa
//     ustoz) guruhdan to'ladi; fan tanlansa guruhlar shu fan bo'yicha, ustoz tanlansa —
//     uning guruhlari birinchi (eski panelda qat'iy Fan → Ustoz → Guruh edi);
//   • chapda o'quvchilar kartasi: «6 ta o'quvchi · guruhdan avtomatik olindi»,
//     «+ O'quvchi qo'shish», «Excel'dan yuklash»; jadval № | O'quvchi | To'g'ri javob
//     («22 / 25») | O'zlashtirish (chiziq + %, < 60% — sariq va «past»; bo'sh —
//     «kiritilmagan») | ✓ yoki fokusdagi qatorda «Enter keyingisi» (qator brend fonda);
//     pastda «5 / 6 kiritildi • Guruh o'rtachasi 80%», «Bekor qilish», «✓ Natijalarni
//     saqlash»;
//   • o'ngda «Taqqoslash» kartasi (ExamSideCard), o'quvchi qatori bosilsa — o'quvchi.
//
// YOZISH eski panel bilan bir xil: POST /api/imtihon/group (bo'sh qoldirilgan o'quvchi
// saqlanmaydi; server o'quvchi ismini bazadan oladi, natijani `monthly_exams` ga ham
// ko'chiradi — o'quvchilar boti o'qiydi). Rasmdagi «Namuna» belgisi — dizaynerning
// izohi, ko'rsatilmaydi.

const norm = (s: string) => (s || "").trim().toLowerCase();

/** "Biologiya, Sertifikat" ichida `course` bormi (eski paneldagi qoida). */
function teachesCourse(kurs: string, course: string): boolean {
  const want = norm(course);
  return (kurs || "").split(",").some((k) => norm(k) === want);
}

/** Ism solishtirish: apostrof turlari va bo'shliqlar farq qilmasin. */
const normName = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ`'"]/g, "").replace(/\s+/g, " ").trim();

function dateOfIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function isoOfDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const smallBtn =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-3 text-v2-small font-medium text-v2-text transition-[background-color,box-shadow] hover:bg-v2-surface-2 focus-visible:shadow-v2-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export default function ExamEntryV2({
  exams,
  initialMonth,
  onSaved,
  onLeave,
}: {
  /** Joriy filialning saqlangan sarhisoblari — taqqoslash, o'quvchi tarixi, takror ogohlantirishi. */
  exams: GroupExam[];
  /** "YYYY-MM" — ro'yxatdagi oy (manzil `oy=`), bo'lmasa joriy oy. */
  initialMonth: string;
  onSaved: (exam: GroupExam) => void;
  /** Ro'yxatga qaytish (saqlanmagan natija bo'lsa — avval so'raladi). */
  onLeave: () => void;
}) {
  const { t } = useT();
  const [lang] = useLang();
  const { showSuccess, showError } = useToast();
  const monthLabel = useMonthLabel();

  const { activeNames, loading: coursesLoading } = useOfflineCourseList();
  const { teachers, loading: teachersLoading } = useTeachers();
  const { groups, loading: groupsLoading } = useGroups();

  const [course, setCourse] = useState("");
  /** Fan guruhdan avtomatik olingan — yorliq yonida «avto». */
  const [courseAuto, setCourseAuto] = useState(false);
  /** Xodim id; guruhdagi ustoz ro'yxatda bo'lmasa — "g:<ism>". */
  const [teacherId, setTeacherId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [month, setMonth] = useState(initialMonth);
  const [date, setDate] = useState(() => uzDateIso());
  const [total, setTotal] = useState("");
  // Qaysi guruh uchun yuklangani bilan birga — guruh almashganda eski ro'yxat bir
  // zum ham ko'rinmaydi (eski paneldagi usul).
  const [loaded, setLoaded] = useState<{ groupId: string; list: Pupil[] } | null>(null);
  /** pupilId → kiritilgan to'g'ri javoblar (matn — bo'sh bo'lishi mumkin). */
  const [correct, setCorrect] = useState<Record<number, string>>({});
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const fileRef = useRef<HTMLInputElement>(null);

  const students = useMemo<Pupil[]>(() => (loaded && loaded.groupId === groupId ? loaded.list : []), [loaded, groupId]);
  const studentsLoading = Boolean(groupId) && loaded?.groupId !== groupId;
  const group = useMemo(() => groups.find((g) => String(g.id) === groupId) ?? null, [groups, groupId]);
  const teacherName = teacherId.startsWith("g:") ? teacherId.slice(2) : (teachers.find((x) => String(x.id) === teacherId)?.name ?? "");
  const totalNum = Math.min(999, Math.trunc(Number(total) || 0));

  // Guruh tanlangach uning o'quvchilari yuklanadi — hammasi jadvalga tushadi.
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    fetch(`/api/groups/${groupId}/students`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setLoaded({ groupId, list: d.ok ? (d.students as Pupil[]) : [] });
        if (!d.ok) showError(t(d.error || "O'quvchilar yuklanmadi"));
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ groupId, list: [] });
        showError(t("Serverga ulanib bo'lmadi"));
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, showError, t]);

  // ── Variantlar ──
  const courseOptions = useMemo<PickerOption[]>(() => {
    const names = new Set<string>(activeNames);
    for (const g of groups) if (g.status !== "archive" && g.course) names.add(g.course);
    if (course) names.add(course);
    return [...names]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((n) => ({ value: n, label: n, lead: <span className={`size-2 rounded-full ${FAN_DOT[fanOf(n)]}`} aria-hidden /> }));
  }, [activeNames, groups, course]);

  const teacherOptions = useMemo<PickerOption[]>(() => {
    const all = teachers.map((x) => ({ value: String(x.id), label: x.name, sublabel: x.kurs || undefined, keywords: x.kurs }));
    let list: PickerOption[] = all;
    if (course) {
      const mine = all.filter((o) => teachesCourse(o.keywords ?? "", course));
      if (mine.length) {
        const rest = all.filter((o) => !teachesCourse(o.keywords ?? "", course));
        list = [...mine.map((o) => ({ ...o, group: t("{course} o'qituvchilari", { course }) })), ...rest.map((o) => ({ ...o, group: t("Boshqa o'qituvchilar") }))];
      }
    }
    if (teacherId.startsWith("g:")) list = [{ value: teacherId, label: teacherId.slice(2), sublabel: t("guruhdagi ustoz") }, ...list];
    return list;
  }, [teachers, course, teacherId, t]);

  const groupOptions = useMemo<PickerOption[]>(() => {
    const live = groups.filter((g) => g.status !== "archive");
    const pool = course ? live.filter((g) => norm(g.course) === norm(course)) : live;
    const tn = norm(teacherName);
    const toOpt = (g: (typeof live)[number], heading?: string): PickerOption => ({
      value: String(g.id),
      label: `${g.course || t("Kurssiz")} · ${(g.name || "").trim() || g.id}`,
      sublabel: [g.teacher, [g.day ? t(g.day) : "", timeLabel(g.time)].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || undefined,
      hint: t("{n} o'quvchi", { n: g.studentIds?.length ?? g.students ?? 0 }),
      lead: <span className={`mt-1 size-2 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />,
      group: heading,
      keywords: `${g.name} ${g.teacher} ${g.course}`,
    });
    if (!tn) return pool.map((g) => toOpt(g));
    const mine = pool.filter((g) => norm(g.teacher) === tn);
    const rest = pool.filter((g) => norm(g.teacher) !== tn);
    return [...mine.map((g) => toOpt(g, t("{teacher} guruhlari", { teacher: teacherName }))), ...rest.map((g) => toOpt(g, mine.length ? t("Boshqa guruhlar") : undefined))];
  }, [groups, course, teacherName, t]);

  const monthOptions = useMemo<PickerOption[]>(() => {
    const now = uzDateIso().slice(0, 7);
    const set = new Set<string>([month]);
    for (let i = -12; i <= 1; i++) set.add(shiftMonth(now, i));
    for (const r of exams) set.add(groupExamMonth(r));
    return [...set]
      .sort()
      .reverse()
      .map((m) => ({ value: m, label: monthLabel(m) }));
  }, [exams, month, monthLabel]);

  // ── O'zgartirish ──
  function resetResults() {
    setCorrect({});
    setAddedIds([]);
    setPicked(null);
  }

  function changeGroup(v: string) {
    setGroupId(v);
    resetResults();
    const g = groups.find((x) => String(x.id) === v);
    if (!g) return;
    if (g.course) {
      setCourse(g.course);
      setCourseAuto(true);
    }
    // Ustoz bo'sh bo'lsa — guruhnikidan (ro'yxatda topilmasa ham, ismi bilan).
    if (!teacherId && g.teacher?.trim()) {
      const found = teachers.find((x) => norm(x.name) === norm(g.teacher));
      setTeacherId(found ? String(found.id) : `g:${g.teacher.trim()}`);
    }
  }

  function changeCourse(v: string) {
    setCourse(v);
    setCourseAuto(false);
    if (group && norm(group.course) !== norm(v)) {
      setGroupId("");
      resetResults();
    }
  }

  // Sana o'zgarsa oy unga ergashadi (eski paneldagidek); oyni keyin alohida
  // o'zgartirsa bo'ladi — avgust sarhisobi sentabr boshida o'tkazilgan bo'lsa.
  function changeDate(d: Date) {
    const iso = isoOfDate(d);
    setDate(iso);
    setMonth(iso.slice(0, 7));
  }

  /** To'g'ri javoblar — savollar sonidan oshsa shunga qisqartiriladi. */
  function mark(pupilId: number, raw: string) {
    let v = raw.replace(/\D/g, "").slice(0, 3);
    if (v !== "" && totalNum > 0 && Number(v) > totalNum) v = String(totalNum);
    setCorrect((m) => ({ ...m, [pupilId]: v }));
  }

  function pctOf(p: Pupil): number | null {
    const raw = correct[p.id];
    if (raw === undefined || raw === "" || totalNum <= 0) return null;
    const c = Math.trunc(Number(raw));
    if (!Number.isFinite(c) || c < 0 || c > totalNum) return null;
    return imPct(c, totalNum);
  }

  const rows = students.map((p) => ({ p, raw: correct[p.id] ?? "", pct: pctOf(p) }));
  const filled = rows.filter((r): r is { p: Pupil; raw: string; pct: number } => r.pct !== null);
  const avg = filled.length ? groupAvgPct(filled.map((r) => ({ pct: r.pct }))) : null;
  const dirty = Object.values(correct).some((v) => v !== "") || addedIds.length > 0;

  // Saqlanmagan natija bor — sahifani yopish/yangilashdan oldin brauzer so'raydi.
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  // Shu guruhning shu oy (va fan) sarhisobi allaqachon bormi — to'xtatmaydi, ogohlantiradi.
  const dup = useMemo(
    () => (groupId ? exams.find((r) => r.groupId === Number(groupId) && groupExamMonth(r) === month && (!course || norm(r.course) === norm(course))) ?? null : null),
    [exams, groupId, month, course],
  );

  function focusRowAt(i: number) {
    const p = students[i];
    if (!p) return;
    const el = inputs.current.get(p.id);
    el?.focus();
    el?.select();
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (i + 1 < students.length) focusRowAt(i + 1);
      else (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusRowAt(i - 1);
    }
  }

  // ── Tekshiruv va saqlash ──
  const errCourse = tried && !course;
  const errTeacher = tried && !teacherName;
  const errGroup = tried && !groupId;
  const errTotal = tried && totalNum <= 0;

  async function save() {
    setTried(true);
    if (!course) return showError(t("Fan yo'nalishini tanlang"));
    if (!teacherName) return showError(t("Ustozni tanlang"));
    if (!groupId) return showError(t("Guruhni tanlang"));
    if (!date) return showError(t("Imtihon sanasini tanlang"));
    if (totalNum <= 0) return showError(t("Savollar sonini kiriting"));
    // Savollar soni keyin kamaytirilgan bo'lsa — undan katta natija jimgina tushib qolmasin.
    const over = rows.filter((r) => r.raw !== "" && Number(r.raw) > totalNum);
    if (over.length) return showError(t("{n} ta o'quvchining natijasi savollar sonidan ko'p — tuzating", { n: over.length }));
    if (filled.length === 0) return showError(t("Kamida bitta o'quvchining natijasini kiriting"));
    setSaving(true);
    try {
      const res = await fetch("/api/imtihon/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          month,
          course,
          teacher: teacherName,
          groupId: Number(groupId),
          total: totalNum,
          students: filled.map((r) => ({ pupilId: r.p.id, correct: Math.trunc(Number(r.raw)) })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      const exam = data.exam as GroupExam;
      showSuccess(
        t("Sarhisob saqlandi — {groupLabel} · {studentCount} o'quvchi · o'rtacha {avgPct}%", { groupLabel: exam.groupLabel, studentCount: exam.studentCount, avgPct: exam.avgPct }),
      );
      // Saqlandi — endi «saqlanmagan» emas (beforeunload so'ramasin).
      setCorrect({});
      setAddedIds([]);
      onSaved(exam);
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  function requestLeave() {
    if (saving) return;
    if (dirty) setAskLeave(true);
    else onLeave();
  }

  // ── Eksport va Excel'dan yuklash ──
  function exportCsv() {
    if (!group || !students.length) return;
    const head = ["№", "O'quvchi", "To'g'ri javob", "Savollar", "O'zlashtirish %"];
    const out: unknown[][] = [head];
    rows.forEach((r, i) => out.push([i + 1, pupilFullName(r.p), r.raw, totalNum || "", r.pct ?? ""]));
    const safe = `${group.course || "guruh"}_${group.name || group.id}`.replace(/[\\/:*?"<>|\s]+/g, "_");
    downloadCsv(out, `Natija_${safe}_${date}.csv`);
  }

  async function importFile(file: File) {
    if (!students.length) {
      showError(t("Avval guruhni tanlang"));
      return;
    }
    setImporting(true);
    let table: string[][];
    try {
      table = await readFileRows(file);
    } catch (e) {
      setImporting(false);
      showError(t(e instanceof Error ? e.message : "Fayl o'qilmadi"));
      return;
    }
    // Sarlavha qatori (birinchi 5 qatordan): «O'quvchi/Ism» va «To'g'ri javob/Ball».
    let nameCol = -1;
    let corrCol = -1;
    let start = 0;
    for (let i = 0; i < Math.min(table.length, 5); i++) {
      const h = table[i].map(normHeader);
      const n = h.findIndex((x) => /oquvchi|ism|fio|familiya|name|student/.test(x));
      const c = h.findIndex((x) => /togri|javob|correct|ball|natija/.test(x));
      if (n >= 0 && c >= 0) {
        nameCol = n;
        corrCol = c;
        start = i + 1;
        break;
      }
    }
    // Sarlavhasiz fayl: ism — harfli birinchi ustun, natija — undan keyingi raqamli ustun.
    if (nameCol < 0) {
      for (const r of table) {
        const n = r.findIndex((c) => /\p{L}/u.test(String(c)));
        const c = n >= 0 ? r.findIndex((x, j) => j > n && /^\s*\d+\s*$/.test(String(x))) : -1;
        if (n >= 0 && c >= 0) {
          nameCol = n;
          corrCol = c;
          break;
        }
      }
    }
    setImporting(false);
    if (nameCol < 0) {
      showError(t("Faylda o'quvchi ismi va to'g'ri javoblar ustuni topilmadi"));
      return;
    }
    const byName = new Map<string, Pupil>();
    for (const p of students) {
      byName.set(normName(pupilFullName(p)), p);
      byName.set(normName(`${p.lastName ?? ""} ${p.firstName ?? ""}`), p);
    }
    const next = { ...correct };
    let ok = 0;
    const missing: string[] = [];
    for (const r of table.slice(start)) {
      const name = String(r[nameCol] ?? "").trim();
      const raw = String(r[corrCol] ?? "").trim();
      if (!name || raw === "") continue;
      const p = byName.get(normName(name));
      if (!p) {
        missing.push(name);
        continue;
      }
      let v = String(intOf(raw));
      if (totalNum > 0 && Number(v) > totalNum) v = String(totalNum);
      next[p.id] = v;
      ok += 1;
    }
    if (!ok) {
      showError(t("Fayldagi ismlar guruh o'quvchilariga mos kelmadi"));
      return;
    }
    setCorrect(next);
    showSuccess(
      missing.length
        ? t("{n} ta natija yuklandi · topilmadi: {names}", { n: ok, names: missing.slice(0, 3).join(", ") + (missing.length > 3 ? "…" : "") })
        : t("{n} ta natija yuklandi", { n: ok }),
    );
  }

  // ── O'ng karta: tanlangan o'quvchi ──
  const sidePupil: SidePupil | null = (() => {
    if (picked === null) return null;
    const r = rows.find((x) => x.p.id === picked);
    if (!r) return null;
    const ranked = [...filled].sort((a, b) => b.pct - a.pct);
    const pos = r.pct === null ? -1 : ranked.findIndex((x) => x.pct === r.pct);
    return {
      id: r.p.id,
      name: pupilFullName(r.p),
      pct: r.pct,
      correct: r.pct === null ? null : Math.trunc(Number(r.raw)),
      total: totalNum,
      rank: pos >= 0 ? pos + 1 : null,
      of: filled.length,
    };
  })();

  const dateObj = dateOfIso(date);
  const label = (text: string, err: boolean, extra?: ReactNode) => (
    <div className={`mb-1.5 flex h-5 items-center gap-1.5 text-v2-small ${err ? "text-v2-danger" : "text-v2-text-2"}`}>
      {text}
      {extra}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <ImtihonHeader
        tab="sarhisob"
        crumbs={[{ label: t("Sarhisob"), onClick: requestLeave }, { label: t("Natija kiritish") }]}
        actions={
          <button type="button" onClick={exportCsv} disabled={!students.length} className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Eksport")}
          </button>
        }
      />

      {/* Tanlovlar paneli */}
      <div className="grid grid-cols-2 gap-3 rounded-v2-lg border border-v2-border bg-v2-surface-2 p-4 min-[40rem]:grid-cols-3 min-[80rem]:grid-cols-[1fr_1.4fr_1.3fr_1fr_0.95fr_0.75fr]">
        <div className="min-w-0">
          {label(
            t("Fan"),
            errCourse,
            courseAuto && course ? <span className="rounded-v2-sm bg-v2-brand-bg px-1.5 text-[11px] font-medium leading-4 text-v2-brand-text">{t("avto")}</span> : null,
          )}
          <V2Picker
            size="sm"
            label={t("Fan")}
            value={course}
            onChange={changeCourse}
            options={courseOptions}
            loading={coursesLoading && !courseOptions.length}
            placeholder={t("Fanni tanlang")}
            searchPlaceholder={t("Fanni qidirish")}
            state={errCourse ? "error" : "default"}
            renderValue={(o) => <span className="font-semibold text-v2-text">{o.label}</span>}
          />
        </div>
        <div className="min-w-0">
          {label(t("Ustoz"), errTeacher)}
          <V2Picker
            size="sm"
            label={t("Ustoz")}
            value={teacherId}
            onChange={setTeacherId}
            options={teacherOptions}
            loading={teachersLoading && !teacherOptions.length}
            placeholder={t("Ustozni tanlang")}
            searchable
            searchPlaceholder={t("Ustozni qidirish")}
            emptyText={t("O'qituvchi topilmadi")}
            width={300}
            state={errTeacher ? "error" : "default"}
            renderValue={(o) => <span className="font-semibold text-v2-text">{o.label}</span>}
          />
        </div>
        <div className="min-w-0">
          {label(t("Guruh"), errGroup)}
          <V2Picker
            size="sm"
            label={t("Guruh")}
            value={groupId}
            onChange={changeGroup}
            options={groupOptions}
            loading={groupsLoading && !groupOptions.length}
            placeholder={t("Guruhni tanlang")}
            searchable
            searchPlaceholder={t("Guruh yoki o'qituvchi")}
            emptyText={course ? t("Bu fan bo'yicha guruh yo'q") : t("Guruh topilmadi")}
            width={340}
            state={errGroup ? "error" : "default"}
            renderValue={(o) => <span className="font-semibold text-v2-text">{o.label}</span>}
          />
        </div>
        <div className="min-w-0">
          {label(t("Oy"), false)}
          <V2Picker
            size="sm"
            label={t("Oy")}
            value={month}
            onChange={setMonth}
            options={monthOptions}
            searchable={false}
            renderValue={(o) => <span className="font-semibold text-v2-text">{o.label}</span>}
          />
        </div>
        <div className="min-w-0">
          {label(t("Sana"), false)}
          <V2DateField
            value={dateObj}
            onChange={changeDate}
            trigger={(p, open) => (
              <button type="button" {...p} aria-label={t("Sana")} className={fieldCls("default", `flex items-center gap-2 text-left ${open ? "border-v2-brand shadow-v2-focus" : ""}`, "sm")}>
                <span className="min-w-0 flex-1 truncate font-semibold tabular-nums text-v2-text">{dateObj ? dayMonthLabel(dateObj, lang) : t("Sanani tanlang")}</span>
                <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
              </button>
            )}
          />
        </div>
        <div className="min-w-0">
          {label(t("Savollar soni"), errTotal)}
          <div className="relative">
            <input
              value={total}
              onChange={(e) => setTotal(e.target.value.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              placeholder="0"
              aria-label={t("Savollar soni")}
              className={fieldCls(errTotal ? "error" : "default", "pr-9 font-semibold tabular-nums", "sm")}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-v2-small text-v2-text-3">{t("ta")}</span>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 min-[64rem]:grid-cols-[minmax(0,1fr)_300px]">
        {/* O'quvchilar kartasi */}
        <section className="min-w-0 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm" aria-label={t("O'quvchilar")}>
          {!groupId ? (
            <div className="p-6">
              <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                  <Users className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="text-v2-section text-v2-text">{t("Guruhni tanlang")}</div>
                <p className="max-w-sm text-v2-small text-v2-text-2">{t("Guruh tanlangach unga biriktirilgan o'quvchilar shu yerda chiqadi — har biriga to'g'ri javoblar sonini yozasiz.")}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <span className="text-v2-body font-semibold text-v2-text">{studentsLoading ? t("O'quvchilar") : t("{n} ta o'quvchi", { n: students.length })}</span>{" "}
                  <span className="text-v2-small text-v2-text-2">{t("guruhdan avtomatik olindi")}</span>
                </div>
                <button type="button" onClick={() => setNewOpen(true)} disabled={!group} className={smallBtn}>
                  <Plus className="size-4" strokeWidth={1.75} aria-hidden />
                  {t("O'quvchi qo'shish")}
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={!students.length || importing} className={smallBtn}>
                  {importing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" strokeWidth={1.75} aria-hidden />}
                  {t("Excel'dan yuklash")}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,text/csv"
                  className="hidden"
                  aria-label={t("Excel'dan yuklash")}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void importFile(f);
                  }}
                />
              </div>

              {dup && (
                <div role="note" className="mx-4 mb-3 flex items-start gap-2 rounded-v2-md bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />
                  <span>
                    {t("Bu guruhning {month} sarhisobi allaqachon saqlangan ({date}, {n} o'quvchi). Yana saqlansa — alohida yozuv bo'ladi.", {
                      month: monthLabel(month),
                      date: dayMonthLabel(dateOfIso(dup.date) ?? new Date(), lang),
                      n: dup.studentCount,
                    })}
                  </span>
                </div>
              )}

              {/* `relative` — sarlavhadagi yashirin (sr-only, absolute) yozuv shu o'ram ichida kesilsin:
                  aks holda telefonda butun sahifa yonga suriladi (sarlavha kataklari sticky emas). */}
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-v2-body">
                  <thead>
                    <tr className="bg-v2-surface-2 text-left text-v2-small text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border),inset_0_1px_0_var(--v2-border)]">
                      <th className="w-12 py-2.5 pl-4 pr-2 font-medium">№</th>
                      <th className="px-3 py-2.5 font-medium">{t("O'quvchi")}</th>
                      <th className="w-[140px] px-3 py-2.5 font-semibold text-v2-text">{t("To'g'ri javob")}</th>
                      <th className="w-[230px] px-3 py-2.5 font-medium">{t("O'zlashtirish")}</th>
                      <th className="w-[120px] py-2.5 pl-2 pr-4">
                        <span className="sr-only">{t("Holat")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsLoading &&
                      Array.from({ length: 4 }, (_, i) => (
                        <tr key={`sk${i}`} className="border-b border-v2-border" aria-hidden>
                          <td className="py-3.5 pl-4 pr-2">
                            <div className="h-3 w-4 rounded bg-v2-skeleton" />
                          </td>
                          <td className="px-3">
                            <div className="h-3 w-40 rounded bg-v2-skeleton" />
                          </td>
                          <td className="px-3">
                            <div className="h-9 w-[104px] rounded-v2-md bg-v2-skeleton" />
                          </td>
                          <td className="px-3">
                            <div className="h-1.5 w-[132px] rounded-v2-full bg-v2-skeleton" />
                          </td>
                          <td />
                        </tr>
                      ))}
                    {!studentsLoading && students.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center">
                          <div className="text-v2-body font-semibold text-v2-text">{t("Guruhda o'quvchi yo'q")}</div>
                          <p className="mt-1 text-v2-small text-v2-text-2">{t("«O'quvchi qo'shish» tugmasi bilan qo'shing.")}</p>
                        </td>
                      </tr>
                    )}
                    {!studentsLoading &&
                      rows.map((r, i) => {
                        const focused = focusRow === r.p.id;
                        const highlight = focused || (focusRow === null && picked === r.p.id);
                        const over = r.raw !== "" && totalNum > 0 && Number(r.raw) > totalNum;
                        const name = pupilFullName(r.p);
                        return (
                          <tr
                            key={r.p.id}
                            onClick={() => setPicked(r.p.id)}
                            className={`cursor-pointer border-b border-v2-border last:border-b-0 ${highlight ? ROW_TINT.brand : ROW_TINT.hover}`}
                          >
                            <td className="py-2.5 pl-4 pr-2 text-v2-small tabular-nums text-v2-text-2">{i + 1}</td>
                            <td className="px-3 py-2.5">
                              <span className="font-semibold text-v2-text">{name}</span>
                              {addedIds.includes(r.p.id) && (
                                <span className="ml-2 rounded-v2-sm bg-v2-surface-2 px-1.5 py-px text-v2-caption text-v2-text-2">{t("Yangi")}</span>
                              )}
                            </td>
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <div className="relative w-[104px]">
                                <input
                                  ref={(el) => {
                                    if (el) inputs.current.set(r.p.id, el);
                                    else inputs.current.delete(r.p.id);
                                  }}
                                  value={r.raw}
                                  onChange={(e) => mark(r.p.id, e.target.value)}
                                  onFocus={() => setFocusRow(r.p.id)}
                                  onBlur={() => setFocusRow((cur) => (cur === r.p.id ? null : cur))}
                                  onKeyDown={(e) => onInputKey(e, i)}
                                  inputMode="numeric"
                                  autoComplete="off"
                                  placeholder="–"
                                  aria-label={t("{name} — to'g'ri javoblar", { name })}
                                  title={totalNum > 0 ? t("0 dan {totalNum} gacha", { totalNum }) : t("Avval savollar sonini kiriting")}
                                  className={fieldCls(over ? "error" : "default", "pr-12 font-semibold tabular-nums", "sm")}
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-v2-small tabular-nums text-v2-text-3">/ {totalNum || "—"}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              {r.pct !== null ? (
                                <div className="flex items-center gap-3">
                                  <ScoreBar pct={r.pct} />
                                  <span className={`text-v2-small font-semibold tabular-nums ${examBand(r.pct) === "low" ? "text-v2-warning" : "text-v2-text"}`}>{r.pct}%</span>
                                  {examBand(r.pct) === "low" && <span className="text-v2-caption font-normal text-v2-warning">{t("past")}</span>}
                                </div>
                              ) : over ? (
                                <span className="text-v2-caption font-normal text-v2-danger">{t("savollar sonidan ko'p")}</span>
                              ) : r.raw !== "" && totalNum <= 0 ? (
                                <span className="text-v2-caption font-normal text-v2-text-3">{t("savollar soni kiritilmagan")}</span>
                              ) : (
                                <span className="text-v2-caption font-normal text-v2-text-3">{t("kiritilmagan")}</span>
                              )}
                            </td>
                            <td className="py-2.5 pl-2 pr-4 text-right">
                              {focused ? (
                                <span className="inline-flex items-center gap-1.5 text-v2-caption font-normal text-v2-text-3">
                                  <kbd className="rounded-v2-sm border border-v2-border bg-v2-surface px-1.5 py-px font-sans text-[11px] text-v2-text-2">Enter</kbd>
                                  {t("keyingisi")}
                                </span>
                              ) : r.pct !== null ? (
                                <Check className="ml-auto size-4 text-v2-success" strokeWidth={2} aria-label={t("Kiritildi")} />
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-v2-border bg-v2-surface-2 px-4 py-3 min-[40rem]:flex-row min-[40rem]:items-center">
                <div className="min-w-0 flex-1 text-v2-small text-v2-text-2">
                  <span className="font-semibold tabular-nums text-v2-text">
                    {filled.length} / {students.length}
                  </span>{" "}
                  {t("kiritildi")}
                  <span className="mx-2 text-v2-text-3" aria-hidden>
                    •
                  </span>
                  {t("Guruh o'rtachasi")} <span className="font-semibold tabular-nums text-v2-text">{avg === null ? "—" : `${avg}%`}</span>
                </div>
                <div className="flex flex-col-reverse gap-2 min-[40rem]:flex-row">
                  <button type="button" onClick={requestLeave} disabled={saving} className={`${secondaryBtn} justify-center`}>
                    {t("Bekor qilish")}
                  </button>
                  <button type="button" onClick={() => void save()} disabled={saving} className={`${primaryBtn} justify-center disabled:opacity-60`}>
                    {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
                    {t("Natijalarni saqlash")}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <ExamSideCard month={month} course={course} groupAvg={avg} filled={filled.map((r) => r.pct)} exams={exams} pupil={sidePupil} onBack={() => setPicked(null)} />
      </div>

      {newOpen && group && (
        <NewStudentDrawerV2
          initialGroupId={group.id}
          groups={groups}
          onClose={() => setNewOpen(false)}
          onSaved={(pupil, addedTo) => {
            if (addedTo !== group.id) return;
            setLoaded((cur) => (cur && cur.groupId === String(group.id) ? { ...cur, list: [...cur.list, pupil] } : cur));
            setAddedIds((ids) => [...ids, pupil.id]);
          }}
        />
      )}

      {askLeave && (
        <V2Confirm
          title={t("Saqlanmagan natijalar bor")}
          body={t("Kiritilgan natijalar saqlanmaydi. Chiqib ketasizmi?")}
          confirmLabel={t("Saqlamasdan chiqish")}
          cancelLabel={t("Davom etish")}
          onCancel={() => setAskLeave(false)}
          onConfirm={() => {
            setAskLeave(false);
            setCorrect({});
            setAddedIds([]);
            onLeave();
          }}
        />
      )}
    </div>
  );
}
