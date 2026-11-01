"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, Download, FileUp, ListChecks, Loader2, Plus, Users, X } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useTeachers } from "@/hooks/useTeachers";
import { useGroups } from "@/hooks/useGroups";
import { loadPupilsCached } from "@/hooks/useStudents";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import { uzDateIso } from "@/lib/uzTime";
import { groupAvgPct, groupExamMonth, imPct, isGroupless, liveExams, type GroupExam } from "@/lib/imtihon";
import V2Picker, { type PickerOption } from "@/components/v2/form/V2Picker";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Confirm from "@/components/v2/form/V2Confirm";
import StudentSearchField, { studentPhoneLabel } from "@/components/v2/form/StudentSearchField";
import { shiftMonth } from "@/components/v2/form/MonthChips";
import { fieldCls } from "@/components/v2/form/fields";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { timeLabel } from "@/components/v2/ui/groupStatus";
import { ROW_TINT } from "@/components/v2/ui/table";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import NewStudentDrawerV2 from "@/components/v2/students/NewStudentDrawerV2";
import { downloadCsv, readFileRows } from "@/components/imtihon/importUtils";
import { examGroupLabel, examGroupTitle, useMonthLabel } from "@/components/imtihon/sarhisobCore";
import { findResultColumns, matchResultRows, namesPreview, priorResults, pupilOfRow, rosterOfExam } from "@/components/imtihon/examRoster";
import ExamSideCard, { type SidePupil } from "./ExamSideCard";
import { ImtihonHeader, ScoreBar, SegmentSwitch, examBand } from "./examBits";

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
//
// TAHRIR REJIMI (01.11.2026, `editing`; /imtihon?tahrir=<id>): maydonlar sarhisobdan
// to'ladi, GURUH va FAN qulf (boshqa guruh — boshqa o'quvchilar; server ham ruxsat
// bermaydi), ro'yxat — guruhning hozirgi o'quvchilari + sarhisobda bo'lib guruhdan
// chiqib ketganlar («guruhda emas»). Bo'sh qoldirilgan o'quvchi sarhisobdan chiqadi.
// Saqlash — PUT /api/imtihon/group/:id (tangalar va bot ko'zgusi serverda qayta
// moslanadi). «Saqlanmagan» — boshlang'ich holatdan farq qilsa.
//
// GURUHSIZ RO'YXAT (01.11.2026, «Guruh bo'yicha | Guruhsiz ro'yxat»; foydalanuvchi: «hali hammani
// guruhga joylamaganmiz … Markaz bo'yicha 1 ta ro'yxat qilish kerak … qaysi guruhda o'qiysiz
// demasin»; qoidalari lib/imtihon.ts da): ustoz va guruh yo'q — fan, oy, sana, savollar soni. Ro'yxat
// qo'lda: o'quvchi ism/telefon bo'yicha qidirib qo'shiladi (tanlangach — natija maydoniga, Enter —
// yana qidiruvga), bazada yo'q bo'lsa «Yangi o'quvchi» (karta ochiladi, guruhsiz), Excel'dan yuklansa
// butun filial bazasidan moslanadi (components/imtihon/examRoster.ts). Shu oy va fandan boshqa
// sarhisobda natijasi bori «bu oyda bor» belgisi bilan. Har qo'shilgan o'quvchiga natija yozilishi
// shart (bo'sh qator — olib tashlanadi). Saqlash — `groupless: true`; tahrirda usul qulf.

const norm = (s: string) => (s || "").trim().toLowerCase();

/** Sarhisobdagi natijalar → maydon qiymatlari (tahrir rejimining boshlang'ich holati). */
const correctOf = (exam: GroupExam): Record<number, string> => Object.fromEntries(exam.students.map((s) => [s.pupilId, String(s.correct)]));

/** Ikki natija to'plami bir xilmi (bo'sh va yo'q — teng). */
function sameCorrect(a: Record<number, string>, b: Record<number, string>): boolean {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if ((a[Number(k)] ?? "") !== (b[Number(k)] ?? "")) return false;
  }
  return true;
}

/** "Biologiya, Sertifikat" ichida `course` bormi (eski paneldagi qoida). */
function teachesCourse(kurs: string, course: string): boolean {
  const want = norm(course);
  return (kurs || "").split(",").some((k) => norm(k) === want);
}

function dateOfIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function isoOfDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Natija kiritish usuli — guruh bo'yicha yoki guruhsiz ro'yxat (lib/imtihon.ts). */
type EntryMode = "group" | "groupless";

const smallBtn =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-3 text-v2-small font-medium text-v2-text transition-[background-color,box-shadow] hover:bg-v2-surface-2 focus-visible:shadow-v2-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export default function ExamEntryV2({
  exams,
  initialMonth,
  editing = null,
  onSaved,
  onLeave,
}: {
  /** Joriy filialning saqlangan sarhisoblari — taqqoslash, o'quvchi tarixi, takror ogohlantirishi. */
  exams: GroupExam[];
  /** "YYYY-MM" — ro'yxatdagi oy (manzil `oy=`), bo'lmasa joriy oy. */
  initialMonth: string;
  /** Tahrirlanadigan sarhisob (bo'lmasa — yangi natija). Almashsa — `key` bilan qayta o'rnatiladi. */
  editing?: GroupExam | null;
  onSaved: (exam: GroupExam) => void;
  /** Ro'yxatga qaytish (saqlanmagan natija bo'lsa — avval so'raladi). */
  onLeave: () => void;
}) {
  const ed = editing;
  const { t } = useT();
  const [lang] = useLang();
  const { showSuccess, showError, showToast } = useToast();
  const monthLabel = useMonthLabel();

  const { activeNames, loading: coursesLoading } = useOfflineCourseList();
  const { teachers, loading: teachersLoading } = useTeachers();
  const { groups, loading: groupsLoading } = useGroups();

  const [course, setCourse] = useState(ed?.course ?? "");
  /** Fan guruhdan avtomatik olingan — yorliq yonida «avto». */
  const [courseAuto, setCourseAuto] = useState(false);
  /** Xodim id; guruhdagi (tahrirda — sarhisobdagi) ustoz ro'yxatda bo'lmasa — "g:<ism>". */
  const [teacherId, setTeacherId] = useState(ed?.teacher ? `g:${ed.teacher}` : "");
  const [groupId, setGroupId] = useState(ed && !isGroupless(ed) ? String(ed.groupId) : "");
  const [month, setMonth] = useState(ed ? groupExamMonth(ed) : initialMonth);
  const [date, setDate] = useState(() => ed?.date || uzDateIso());
  const [total, setTotal] = useState(ed ? String(ed.total) : "");
  // Qaysi guruh uchun yuklangani bilan birga — guruh almashganda eski ro'yxat bir
  // zum ham ko'rinmaydi (eski paneldagi usul).
  const [loaded, setLoaded] = useState<{ groupId: string; list: Pupil[] } | null>(null);
  /** pupilId → kiritilgan to'g'ri javoblar (matn — bo'sh bo'lishi mumkin). */
  const [correct, setCorrect] = useState<Record<number, string>>(() => (ed ? correctOf(ed) : {}));
  /** Tahrir saqlandi — endi «saqlanmagan» emas (ro'yxatga qaytguncha). */
  const [saved, setSaved] = useState(false);
  /** Tahrirda sarhisobdagi ustoz xodimlar ro'yxatidan topilganmi (bir marta, ro'yxat kelgach). */
  const [teacherResolved, setTeacherResolved] = useState(!ed);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  /** Kiritish usuli (tahrirda — sarhisobniki, qulf). */
  const [mode, setMode] = useState<EntryMode>(ed && isGroupless(ed) ? "groupless" : "group");
  const groupless = mode === "groupless";
  /** Guruhsiz ro'yxat — qo'lda yig'iladi (tahrirda sarhisobdagilar). */
  const [roster, setRoster] = useState<Pupil[]>(() => (ed && isGroupless(ed) ? rosterOfExam(ed) : []));
  /** Usul almashtirish so'ralgan (kiritilgan natija bor — avval tasdiq). */
  const [askMode, setAskMode] = useState<EntryMode | null>(null);
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /** Ro'yxatga qo'shilgan o'quvchi — qatori chizilgach natija maydoniga fokus. */
  const focusAfter = useRef<number | null>(null);

  // Tahrirda ro'yxat oxirida — sarhisobda bor, lekin guruhda endi yo'q o'quvchilar
  // (ism/telefon sarhisobdagidek; server ham ularning eski yozuvini saqlaydi).
  const { students, extraIds } = useMemo(() => {
    if (groupless) return { students: roster, extraIds: new Set<number>() };
    const list = loaded && loaded.groupId === groupId ? loaded.list : [];
    if (!ed || !loaded || loaded.groupId !== groupId) return { students: list, extraIds: new Set<number>() };
    const have = new Set(list.map((p) => p.id));
    const extra = ed.students
      .filter((s) => !have.has(s.pupilId))
      .map((s) => ({ id: s.pupilId, firstName: s.name, lastName: "", phone: s.phone }) as unknown as Pupil);
    return { students: [...list, ...extra], extraIds: new Set(extra.map((p) => p.id)) };
  }, [groupless, roster, loaded, groupId, ed]);
  const studentsLoading = !groupless && Boolean(groupId) && loaded?.groupId !== groupId;
  const rosterIds = useMemo(() => new Set(roster.map((p) => p.id)), [roster]);
  const group = useMemo(() => groups.find((g) => String(g.id) === groupId) ?? null, [groups, groupId]);
  const teacherName = teacherId.startsWith("g:") ? teacherId.slice(2) : (teachers.find((x) => String(x.id) === teacherId)?.name ?? "");
  const totalNum = Math.min(999, Math.trunc(Number(total) || 0));

  // Tahrir: sarhisobdagi ustoz xodimlar ro'yxatida bo'lsa — ro'yxatdagi tanlov (render
  // paytida, bir marta; topilmasa ism bilan qoladi).
  if (!teacherResolved && teachers.length > 0) {
    setTeacherResolved(true);
    const found = ed ? teachers.find((x) => norm(x.name) === norm(ed.teacher)) : undefined;
    if (found && teacherId === `g:${ed?.teacher}`) setTeacherId(String(found.id));
  }

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
    if (teacherId.startsWith("g:")) list = [{ value: teacherId, label: teacherId.slice(2), sublabel: ed ? t("sarhisobdagi ustoz") : t("guruhdagi ustoz") }, ...list];
    return list;
  }, [teachers, course, teacherId, t, ed]);

  const groupOptions = useMemo<PickerOption[]>(() => {
    // Tahrirda guruh qulf — faqat sarhisobning o'z guruhi (arxivga o'tgan yoki o'chgan bo'lsa ham).
    if (ed) {
      const g = groups.find((x) => x.id === ed.groupId);
      const name = (g?.name || ed.groupName || "").trim() || String(ed.groupId);
      return [{ value: String(ed.groupId), label: `${ed.course || t("Kurssiz")} · ${name}`, lead: <span className={`mt-1 size-2 rounded-full ${FAN_DOT[fanOf(ed.course)]}`} aria-hidden /> }];
    }
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
  }, [groups, course, teacherName, t, ed]);

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

  /** Usul almashadi: guruh, ro'yxat va natijalar tozalanadi (fan, oy, sana, savollar soni qoladi). */
  function applyMode(next: EntryMode) {
    setMode(next);
    setGroupId("");
    setCourseAuto(false);
    setRoster([]);
    setTried(false);
    resetResults();
  }

  function changeMode(next: EntryMode) {
    if (ed || next === mode) return;
    const entered = Object.values(correct).some((v) => v !== "") || addedIds.length > 0 || roster.length > 0;
    if (entered) setAskMode(next);
    else applyMode(next);
  }

  /** Guruhsiz ro'yxatga (bori — o'z qatoriga); qidiruvdan tanlansa fokus uning natija maydoniga. */
  function addToRoster(pupil: Pupil, isNew = false) {
    setRoster((list) => (list.some((x) => x.id === pupil.id) ? list : [...list, pupil]));
    if (isNew) setAddedIds((ids) => (ids.includes(pupil.id) ? ids : [...ids, pupil.id]));
    setPicked(pupil.id);
    // Yangi o'quvchi oynasi hali ochiq bo'lishi mumkin («yana qo'shish») — fokus uning ostiga ketmasin.
    if (isNew) return;
    const el = inputs.current.get(pupil.id);
    if (el) {
      el.focus();
      el.select();
    } else focusAfter.current = pupil.id;
  }

  function removeFromRoster(id: number) {
    setRoster((list) => list.filter((x) => x.id !== id));
    setCorrect((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
    setAddedIds((ids) => ids.filter((x) => x !== id));
    setPicked((cur) => (cur === id ? null : cur));
  }

  // Qo'shilgan qator chizilgach — natija maydoniga fokus (har chizishdan keyin tekshiriladi, arzon).
  useEffect(() => {
    const id = focusAfter.current;
    if (id === null) return;
    const el = inputs.current.get(id);
    if (!el) return;
    focusAfter.current = null;
    el.focus();
    el.select();
  });

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
  const initial = useMemo(
    () =>
      ed
        ? {
            correct: correctOf(ed),
            total: String(ed.total),
            date: ed.date,
            month: groupExamMonth(ed),
            teacher: ed.teacher,
            course: ed.course,
            roster: ed.students.map((s) => s.pupilId).join(","),
          }
        : null,
    [ed],
  );
  const dirty =
    !saved &&
    (initial
      ? !sameCorrect(correct, initial.correct) ||
        total !== initial.total ||
        date !== initial.date ||
        month !== initial.month ||
        (groupless
          ? course !== initial.course || roster.map((x) => x.id).join(",") !== initial.roster
          : norm(teacherName) !== norm(initial.teacher)) ||
        addedIds.length > 0
      : Object.values(correct).some((v) => v !== "") || addedIds.length > 0 || roster.length > 0);

  // Saqlanmagan natija bor — sahifani yopish/yangilashdan oldin brauzer so'raydi.
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  // Shu guruhning shu oy (va fan) sarhisobi allaqachon bormi — to'xtatmaydi, ogohlantiradi
  // (tahrirlanayotganining o'zi hisob emas; arxivdagisi hisob — tangalarda u ham bor).
  const dup = useMemo(
    () =>
      groupId
        ? (exams.find((r) => r.id !== ed?.id && r.groupId === Number(groupId) && groupExamMonth(r) === month && (!course || norm(r.course) === norm(course))) ?? null)
        : null,
    [exams, groupId, month, course, ed],
  );
  // Guruhsiz ro'yxat: shu oy va fan bo'yicha boshqa sarhisobdagi natija — «bu oyda bor».
  const prior = useMemo(() => priorResults(groupless ? exams : [], month, course, ed?.id), [groupless, exams, month, course, ed]);
  // O'ng karta taqqoslashi — arxivdagisiz va tahrirlanayotganining eski natijasisiz.
  const sideExams = useMemo(() => liveExams(exams).filter((r) => r.id !== ed?.id), [exams, ed]);

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
      else if (groupless) searchRef.current?.focus();
      else (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusRowAt(i - 1);
    }
  }

  // ── Tekshiruv va saqlash ──
  const errCourse = tried && !course;
  const errTeacher = tried && !groupless && !teacherName;
  const errGroup = tried && !groupless && !groupId;
  const errTotal = tried && totalNum <= 0;

  async function save() {
    setTried(true);
    if (!course) return showError(t("Fan yo'nalishini tanlang"));
    if (!groupless && !teacherName) return showError(t("Ustozni tanlang"));
    if (!groupless && !groupId) return showError(t("Guruhni tanlang"));
    if (!date) return showError(t("Imtihon sanasini tanlang"));
    if (totalNum <= 0) return showError(t("Savollar sonini kiriting"));
    // Savollar soni keyin kamaytirilgan bo'lsa — undan katta natija jimgina tushib qolmasin.
    const over = rows.filter((r) => r.raw !== "" && Number(r.raw) > totalNum);
    if (over.length) return showError(t("{n} ta o'quvchining natijasi savollar sonidan ko'p — tuzating", { n: over.length }));
    if (filled.length === 0) return showError(t("Kamida bitta o'quvchining natijasini kiriting"));
    // Guruhsizda har qo'shilgan o'quvchi — atayin qo'shilgan: natijasiz qolsa jimgina tushib qolmasin.
    const blank = groupless ? rows.filter((r) => r.raw === "").length : 0;
    if (blank) return showError(t("{n} ta o'quvchining natijasi yozilmagan — yozing yoki ro'yxatdan olib tashlang", { n: blank }));
    setSaving(true);
    try {
      const res = await fetch(ed ? `/api/imtihon/group/${ed.id}` : "/api/imtihon/group", {
        method: ed ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          month,
          course,
          // Guruhsiz ro'yxat — ustoz va guruhsiz (server `groupless: true` ni o'zi tekshiradi).
          ...(groupless ? { groupless: true, teacher: "", groupId: 0 } : { teacher: teacherName, groupId: Number(groupId) }),
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
      const p = { groupLabel: examGroupLabel(exam, t), studentCount: exam.studentCount, avgPct: exam.avgPct };
      showSuccess(
        ed
          ? t("Sarhisob yangilandi — {groupLabel} · {studentCount} o'quvchi · o'rtacha {avgPct}%", p)
          : t("Sarhisob saqlandi — {groupLabel} · {studentCount} o'quvchi · o'rtacha {avgPct}%", p),
      );
      // Saqlandi — endi «saqlanmagan» emas (beforeunload so'ramasin).
      setSaved(true);
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
    const base = groupless ? `${course || "fan"}_guruhsiz` : group ? `${group.course || "guruh"}_${group.name || group.id}` : "";
    if (!base || !students.length) return;
    const head = ["№", "O'quvchi", "To'g'ri javob", "Savollar", "O'zlashtirish %"];
    const out: unknown[][] = [head];
    rows.forEach((r, i) => out.push([i + 1, pupilFullName(r.p), r.raw, totalNum || "", r.pct ?? ""]));
    const safe = base.replace(/[\\/:*?"<>|\s]+/g, "_");
    downloadCsv(out, `Natija_${safe}_${date}.csv`);
  }

  async function importFile(file: File) {
    if (!groupless && !students.length) {
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
    // Guruhsizda — butun filial bazasi (id/ism/telefon, keshdan) + ro'yxatdagilar.
    let pool: Pupil[] = students;
    if (groupless) {
      try {
        const base = (await loadPupilsCached({ light: true })) as unknown as Pupil[];
        const have = new Set(students.map((x) => x.id));
        pool = [...students, ...base.filter((x) => !have.has(x.id))];
      } catch {
        setImporting(false);
        showError(t("O'quvchilar ro'yxati yuklanmadi — qayta urinib ko'ring"));
        return;
      }
    }
    setImporting(false);
    const cols = findResultColumns(table);
    if (!cols) {
      showError(t("Faylda o'quvchi ismi va to'g'ri javoblar ustuni topilmadi"));
      return;
    }
    const res = matchResultRows(table, cols, pool, { total: totalNum, strict: groupless });
    if (!res.hits.length) {
      showError(groupless ? t("Fayldagi ismlar bazadagi o'quvchilarga mos kelmadi") : t("Fayldagi ismlar guruh o'quvchilariga mos kelmadi"));
      return;
    }
    setCorrect((m) => ({ ...m, ...Object.fromEntries(res.hits.map((h) => [h.pupil.id, String(h.correct)])) }));
    if (groupless) {
      setRoster((list) => {
        const have = new Set(list.map((x) => x.id));
        return [...list, ...res.hits.map((h) => h.pupil).filter((x) => !have.has(x.id))];
      });
      const detail = [
        res.missing.length ? t("Bazada topilmadi: {names}", { names: namesPreview(res.missing) }) : "",
        res.ambiguous.length ? t("Bir xil ismli bir nechta o'quvchi — qidiruv bilan qo'shing: {names}", { names: namesPreview(res.ambiguous) }) : "",
      ].filter(Boolean);
      showToast({ tone: "success", title: t("{n} ta natija yuklandi", { n: res.hits.length }), detail: detail.length ? detail : undefined });
      return;
    }
    showSuccess(
      res.missing.length
        ? t("{n} ta natija yuklandi · topilmadi: {names}", { n: res.hits.length, names: namesPreview(res.missing) })
        : t("{n} ta natija yuklandi", { n: res.hits.length }),
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
        crumbs={[{ label: t("Sarhisob"), onClick: requestLeave }, { label: ed ? t("Natijani tahrirlash") : t("Natija kiritish") }]}
        actions={
          <button type="button" onClick={exportCsv} disabled={!students.length} className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Eksport")}
          </button>
        }
      />

      {/* Kiritish usuli: guruh bo'yicha yoki guruhsiz ro'yxat (tahrirda qulf) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SegmentSwitch
          label={t("Kiritish usuli")}
          value={mode}
          onChange={changeMode}
          disabled={Boolean(ed)}
          options={[
            { value: "group", label: t("Guruh bo'yicha"), icon: Users },
            { value: "groupless", label: t("Guruhsiz ro'yxat"), icon: ListChecks },
          ]}
        />
        {groupless && (
          <p className="min-w-0 flex-1 text-v2-small text-v2-text-2">
            {t("O'quvchi qidirib qo'shiladi va guruhga qo'shilmaydi. Natija markaz reytingiga tushadi, tanga berilmaydi.")}
          </p>
        )}
      </div>

      {/* Tanlovlar paneli */}
      <div
        className={`grid grid-cols-2 gap-3 rounded-v2-lg border border-v2-border bg-v2-surface-2 p-4 ${
          groupless ? "min-[48rem]:grid-cols-[1.6fr_1fr_1fr_0.8fr]" : "min-[40rem]:grid-cols-3 min-[80rem]:grid-cols-[1fr_1.4fr_1.3fr_1fr_0.95fr_0.75fr]"
        }`}
      >
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
            disabled={Boolean(ed) && !groupless}
            loading={coursesLoading && !courseOptions.length}
            placeholder={t("Fanni tanlang")}
            searchPlaceholder={t("Fanni qidirish")}
            state={errCourse ? "error" : "default"}
            renderValue={(o) => <span className="font-semibold text-v2-text">{o.label}</span>}
          />
        </div>
        {!groupless && (
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
        )}
        {!groupless && (
          <div className="min-w-0">
            {label(t("Guruh"), errGroup)}
            <V2Picker
              size="sm"
              label={t("Guruh")}
              value={groupId}
              onChange={changeGroup}
              options={groupOptions}
              disabled={Boolean(ed)}
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
        )}
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
          {!groupless && !groupId ? (
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
                  <span className="text-v2-small text-v2-text-2">
                    {groupless ? t("qidirib qo'shiladi — guruhga qo'shilmaydi") : ed ? t("bo'sh qoldirilgani sarhisobdan chiqadi") : t("guruhdan avtomatik olindi")}
                  </span>
                </div>
                <button type="button" onClick={() => setNewOpen(true)} disabled={!groupless && !group} className={smallBtn}>
                  <Plus className="size-4" strokeWidth={1.75} aria-hidden />
                  {groupless ? t("Yangi o'quvchi") : t("O'quvchi qo'shish")}
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={(!groupless && !students.length) || importing} className={smallBtn}>
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

              {groupless && (
                <div className="px-4 pb-3">
                  <StudentSearchField
                    inputRef={searchRef}
                    clearOnPick
                    onPick={(row) => addToRoster(pupilOfRow(row))}
                    placeholder={t("O'quvchini ism yoki telefon bo'yicha qidiring…")}
                    trailing={(row) =>
                      rosterIds.has(row.id) ? (
                        <span className="text-v2-text-3">{t("ro'yxatda")}</span>
                      ) : prior.has(row.id) ? (
                        <span className="text-v2-warning">{t("bu oyda bor")}</span>
                      ) : null
                    }
                  />
                </div>
              )}

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
                <table className={`w-full border-collapse text-v2-body ${groupless ? "min-w-[760px]" : "min-w-[600px]"}`}>
                  <thead>
                    <tr className="bg-v2-surface-2 text-left text-v2-small text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border),inset_0_1px_0_var(--v2-border)]">
                      <th className="w-12 py-2.5 pl-4 pr-2 font-medium">№</th>
                      <th className="px-3 py-2.5 font-medium">{t("O'quvchi")}</th>
                      <th className="w-[140px] px-3 py-2.5 font-semibold text-v2-text">{t("To'g'ri javob")}</th>
                      <th className="w-[230px] px-3 py-2.5 font-medium">{t("O'zlashtirish")}</th>
                      <th className="w-[120px] py-2.5 pl-2 pr-4">
                        <span className="sr-only">{t("Holat")}</span>
                      </th>
                      {groupless && (
                        <th className="w-12 py-2.5 pr-3">
                          <span className="sr-only">{t("Olib tashlash")}</span>
                        </th>
                      )}
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
                        <td colSpan={groupless ? 6 : 5} className="px-4 py-8 text-center">
                          {groupless ? (
                            <>
                              <div className="text-v2-body font-semibold text-v2-text">{t("Ro'yxat hozircha bo'sh")}</div>
                              <p className="mx-auto mt-1 max-w-md text-v2-small text-v2-text-2">
                                {t("Yuqoridagi qidiruvdan o'quvchini tanlang; bazada bo'lmasa — «Yangi o'quvchi». Excel'dan ham yuklasa bo'ladi.")}
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="text-v2-body font-semibold text-v2-text">{t("Guruhda o'quvchi yo'q")}</div>
                              <p className="mt-1 text-v2-small text-v2-text-2">{t("«O'quvchi qo'shish» tugmasi bilan qo'shing.")}</p>
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                    {!studentsLoading &&
                      rows.map((r, i) => {
                        const focused = focusRow === r.p.id;
                        const highlight = focused || (focusRow === null && picked === r.p.id);
                        const over = r.raw !== "" && totalNum > 0 && Number(r.raw) > totalNum;
                        const name = pupilFullName(r.p);
                        const before = groupless ? prior.get(r.p.id) : undefined;
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
                              {extraIds.has(r.p.id) && (
                                <span className="ml-2 rounded-v2-sm bg-v2-surface-2 px-1.5 py-px text-v2-caption text-v2-text-2">{t("guruhda emas")}</span>
                              )}
                              {/* Guruhsiz: ikkinchi qator — telefon va «bu oyda bor» (tor ekranda bo'linmasin). */}
                              {(r.p.phone || before) && groupless && (
                                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-v2-caption">
                                  {r.p.phone && <span className="whitespace-nowrap tabular-nums text-v2-text-3">{studentPhoneLabel(r.p.phone)}</span>}
                                  {before && (
                                    <span
                                      title={t("Shu oy va fan bo'yicha boshqa sarhisobda natijasi bor — ikkalasi saqlansa, reyting va botda keyingisi hisoblanadi.")}
                                      className="whitespace-nowrap rounded-v2-sm bg-v2-warning-bg px-1.5 py-px text-v2-text"
                                    >
                                      {t("bu oyda bor: {where} · {pct}%", { where: examGroupTitle(before.exam, t), pct: before.pct })}
                                    </span>
                                  )}
                                </span>
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
                            {groupless && (
                              <td className="py-2 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => removeFromRoster(r.p.id)}
                                  title={t("Ro'yxatdan olib tashlash")}
                                  aria-label={t("{name} — ro'yxatdan olib tashlash", { name })}
                                  className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-3 transition-colors hover:bg-v2-surface-2 hover:text-v2-danger focus-visible:outline-none focus-visible:shadow-v2-focus"
                                >
                                  <X className="size-4" strokeWidth={1.75} aria-hidden />
                                </button>
                              </td>
                            )}
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
                  {groupless ? t("Ro'yxat o'rtachasi") : t("Guruh o'rtachasi")} <span className="font-semibold tabular-nums text-v2-text">{avg === null ? "—" : `${avg}%`}</span>
                </div>
                <div className="flex flex-col-reverse gap-2 min-[40rem]:flex-row">
                  <button type="button" onClick={requestLeave} disabled={saving} className={`${secondaryBtn} justify-center`}>
                    {t("Bekor qilish")}
                  </button>
                  <button type="button" onClick={() => void save()} disabled={saving} className={`${primaryBtn} justify-center disabled:opacity-60`}>
                    {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
                    {ed ? t("O'zgarishlarni saqlash") : t("Natijalarni saqlash")}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <ExamSideCard
          month={month}
          course={course}
          groupAvg={avg}
          filled={filled.map((r) => r.pct)}
          exams={sideExams}
          pupil={sidePupil}
          onBack={() => setPicked(null)}
          groupless={groupless}
        />
      </div>

      {newOpen && groupless && <NewStudentDrawerV2 groups={groups} onClose={() => setNewOpen(false)} onSaved={(pupil) => addToRoster(pupil, true)} />}

      {newOpen && !groupless && group && (
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

      {askMode && (
        <V2Confirm
          title={t("Kiritish usuli almashsinmi?")}
          body={t("Kiritilgan natijalar va ro'yxat tozalanadi.")}
          confirmLabel={t("Almashtirish")}
          onCancel={() => setAskMode(null)}
          onConfirm={() => {
            const next = askMode;
            setAskMode(null);
            applyMode(next);
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
