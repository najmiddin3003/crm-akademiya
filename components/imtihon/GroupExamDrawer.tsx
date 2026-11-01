"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ListChecks, UserPlus, Users, X } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Segmented from "@/components/ui/Segmented";
import DateField from "@/components/ui/DateField";
import MonthYearPicker, { monthYearFromIso, monthYearToIso } from "@/components/ui/MonthYearPicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useTeachers } from "@/hooks/useTeachers";
import { useGroups } from "@/hooks/useGroups";
import { groupLabel } from "@/lib/groups";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import { uzDateIso } from "@/lib/uzTime";
import { groupAvgPct, groupExamMonth, imPct, imTier, isGroupless, type GroupExam } from "@/lib/imtihon";
import { examGroupLabel, examGroupTitle } from "@/lib/examRanking";
import TierBadge from "./TierBadge";
import NewStudentModal from "./NewStudentModal";
import PupilSearchInput from "./PupilSearchInput";
import { priorResults, pupilOfRow, rosterOfExam } from "./examRoster";
import { useT } from "@/components/shared/Language";

// Imtihon → Sarhisob → "Natija qo'shish" — o'ng tomondan ochiladigan panel
// (referens sarhisob.html dagi drawer).
//
// Oqim (referensdagi qadamlar chizig'i): 1 Fan → 2 Ustoz → 3 Guruh →
// 4 Savollar → 5 Natijalar. Guruh tanlangach unga biriktirilgan o'quvchilar
// jadvalda AVTOMATIK chiqadi; har biriga to'g'ri javoblar soni yoziladi,
// o'zlashtirish foizi o'zi hisoblanadi. Bo'sh qoldirilgan o'quvchi
// (kelmagan) SAQLANMAYDI — kamida bittasi kiritilgach "Sarhisobni saqlash"
// ochiladi. Ro'yxatda yo'q o'quvchi "O'quvchi qo'shish" bilan shu yerdan
// yaratilib guruhga biriktiriladi (NewStudentModal) va darhol jadvalda
// paydo bo'ladi.
//
// OY va SANA alohida: sana — imtihon o'tkazilgan kun, oy — sarhisob qaysi
// oyga tegishli (sana o'zgarsa oy unga ergashadi, keyin qo'lda o'zgartirsa
// bo'ladi — avgust sarhisobi sentabr boshida o'tkazilgan bo'lsa).
//
// MANBALAR — hammasi bazadan: fanlar `offline_courses`, ustozlar
// `hr_employees` (turi: teacher, `kurs` maydoni "Biologiya, Sertifikat"
// kabi vergulli), guruhlar `groups` (joriy filial), o'quvchilar
// `/api/groups/:id/students`.
//
// REFERENSDAN FARQI: unda guruh ro'yxati faqat tanlangan ustozniki. Bu
// yerda fanning HAMMA guruhlari chiqadi, ustozniki ro'yxat boshida alohida
// sarlavha ostida — guruhdagi ustoz nomi xodimlar ro'yxatidagi bilan mos
// kelmasa (import qilingan guruhlar) yoki o'rinbosar ustoz imtihon olsa
// ham guruh topiladi.
//
// Saqlash → POST /api/imtihon/group (`group_exams`), u har bir o'quvchi
// natijasini `monthly_exams` ga ham ko'chiradi (o'quvchilar boti o'qiydi).
//
// TAHRIR (01.11.2026, `editing`): maydonlar sarhisobdan to'ladi, fan va guruh qulf,
// ro'yxat — guruhning hozirgi o'quvchilari + sarhisobda bo'lib guruhdan chiqqanlar;
// bo'sh qoldirilgani sarhisobdan chiqadi. Saqlash → PUT /api/imtihon/group/:id
// (yangi versiyadagi ExamEntryV2 bilan bir xil qoida).
//
// GURUHSIZ RO'YXAT (01.11.2026, tepada «Guruh bo'yicha | Guruhsiz ro'yxat»; qoidalari lib/imtihon.ts
// da, yangi versiyadagi bilan bir xil): qadamlar Fan → Savollar → Natijalar, ustoz va guruh yo'q.
// O'quvchi ism/telefon bo'yicha qidirib qo'shiladi (PupilSearchInput; Enter — keyingi qator, oxirida —
// yana qidiruv), bazada yo'q bo'lsa «Yangi o'quvchi» (NewStudentModal, guruhsiz karta). Shu oy va
// fandan boshqa sarhisobda natijasi bori — «bu oyda bor». Har qo'shilgan o'quvchiga natija shart
// (bo'shi × bilan olib tashlanadi). Saqlash — `groupless: true`; tahrirda usul qulf.

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const norm = (s: string) => (s || "").trim().toLowerCase();

/** "Biologiya, Sertifikat" ichida `course` bormi. */
function teachesCourse(kurs: string, course: string): boolean {
  const want = norm(course);
  return kurs.split(",").some((k) => norm(k) === want);
}

/** Referensdagi qadamlar chizig'i — bajarilgani yashil. */
function Step({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-[12px] whitespace-nowrap ${
        done ? "border-primary/30 bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground"
      }`}
    >
      {n} ‧ {label}
    </span>
  );
}

export default function GroupExamDrawer({
  onClose,
  onSaved,
  initialMonth,
  editing = null,
  exams = [],
}: {
  onClose: () => void;
  onSaved: (exam: GroupExam) => void;
  /** Ro'yxatdagi filtr oyi ("YYYY-MM") — panel shu oy bilan ochiladi. */
  initialMonth?: string;
  /** Tahrirlanadigan sarhisob (bo'lmasa — yangi natija). */
  editing?: GroupExam | null;
  /** Joriy filialning sarhisoblari — guruhsiz ro'yxatda «bu oyda bor» belgisi uchun. */
  exams?: GroupExam[];
}) {
  const { t, months: MONTH_NAMES } = useT();
  const modal = useModalClose(onClose, "drawer");
  const { showSuccess, showError } = useToast();
  const ed = editing;

  const { courses, loading: coursesLoading } = useOfflineCourseList();
  const { teachers, loading: teachersLoading } = useTeachers();
  const { groups, loading: groupsLoading } = useGroups();

  const [date, setDate] = useState(() => ed?.date || uzDateIso());
  const [month, setMonth] = useState(() =>
    ed ? groupExamMonth(ed) : initialMonth && /^\d{4}-\d{2}$/.test(initialMonth) ? initialMonth : uzDateIso().slice(0, 7),
  );
  const [course, setCourse] = useState(ed?.course ?? "");
  const [teacherId, setTeacherId] = useState("");
  const [groupId, setGroupId] = useState(ed && !isGroupless(ed) ? String(ed.groupId) : "");
  /** Kiritish usuli (tahrirda — sarhisobniki, qulf). */
  const [mode, setMode] = useState<"group" | "groupless">(ed && isGroupless(ed) ? "groupless" : "group");
  const groupless = mode === "groupless";
  /** Guruhsiz ro'yxat — qo'lda yig'iladi (tahrirda sarhisobdagilar). */
  const [roster, setRoster] = useState<Pupil[]>(() => (ed && isGroupless(ed) ? rosterOfExam(ed) : []));
  /** Usul almashtirish so'ralgan — kiritilgan natija bor, panel ichida tasdiq. */
  const [askMode, setAskMode] = useState<"group" | "groupless" | null>(null);
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const searchRef = useRef<HTMLInputElement>(null);
  /** Ro'yxatga qo'shilgan o'quvchi — qatori chizilgach natija maydoniga fokus. */
  const focusAfter = useRef<number | null>(null);
  // Qaysi guruh uchun yuklangani bilan birga saqlanadi — "yuklanmoqda"
  // holati shundan hosil qilinadi va guruh almashganda eski ro'yxat bir
  // zum ham ko'rinmaydi.
  const [loaded, setLoaded] = useState<{ groupId: string; list: Pupil[] } | null>(null);
  // Tahrirda ro'yxat oxirida — sarhisobda bor, lekin guruhda endi yo'q o'quvchilar.
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
  /** Shu paneldan yangi qo'shilgan o'quvchilar — jadvalda "Yangi" yorlig'i. */
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [total, setTotal] = useState(ed ? String(ed.total) : "");
  /** pupilId → kiritilgan to'g'ri javoblar soni (matn — bo'sh bo'lishi mumkin). */
  const [correct, setCorrect] = useState<Record<number, string>>(() =>
    ed ? Object.fromEntries(ed.students.map((s) => [s.pupilId, String(s.correct)])) : {},
  );
  const [newStudentOpen, setNewStudentOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Tahrirda sarhisobdagi ustoz shu fan ustozlari ro'yxatidan topildimi (bir marta). */
  const [teacherResolved, setTeacherResolved] = useState(!ed);

  const courseOptions = useMemo(() => {
    const list = courses.map((c) => ({ value: c.name, label: c.name }));
    // Tahrirda fan qulf — kurs keyin o'chirilgan/qayta nomlangan bo'lsa ham ko'rinsin.
    if (ed && !list.some((o) => o.value === ed.course)) list.unshift({ value: ed.course, label: ed.course });
    return list;
  }, [courses, ed]);

  const teacherOptions = useMemo(
    () =>
      teachers
        .filter((tv) => course && teachesCourse(tv.kurs, course))
        .map((tv) => ({ value: String(tv.id), label: tv.name, sub: tv.phone || undefined })),
    [teachers, course],
  );
  const teacher = useMemo(() => teachers.find((tv) => String(tv.id) === teacherId) || null, [teachers, teacherId]);
  // Tahrir: ro'yxatdan tanlanmagan bo'lsa — sarhisobdagi ustoz ismi o'zi qoladi.
  const teacherName = teacher?.name ?? (ed && !teacherId ? ed.teacher : "");

  // Tahrir: sarhisobdagi ustoz shu fan ustozlari orasida bo'lsa — ro'yxatdagi tanlov
  // (render paytida, ro'yxat kelgach bir marta).
  if (!teacherResolved && (teachers.length > 0 || !teachersLoading)) {
    setTeacherResolved(true);
    const found = ed ? teachers.find((tv) => teachesCourse(tv.kurs, ed.course) && norm(tv.name) === norm(ed.teacher)) : undefined;
    if (found) setTeacherId(String(found.id));
  }

  // Fanning guruhlari; tanlangan ustozniki BIRINCHI, alohida sarlavha ostida.
  const groupOptions = useMemo(() => {
    const all = groups.filter((g) => course && norm(g.course) === norm(course));
    const toOption = (g: (typeof all)[number], group?: string) => ({
      value: String(g.id),
      label: g.level ? `${groupLabel(g)} ‧ ${t(g.level)}` : groupLabel(g),
      sub: g.teacher ? t("Ustoz: {teacher}", { teacher: g.teacher }) : undefined,
      hint: t("{studentIds} o'quvchi", { studentIds: g.studentIds?.length ?? 0 }),
      group,
    });
    if (!teacher) return all.map((g) => toOption(g));
    const own = norm(teacher.name);
    const mine = all.filter((g) => norm(g.teacher) === own);
    const rest = all.filter((g) => norm(g.teacher) !== own);
    return [
      ...mine.map((g) => toOption(g, t("{teacher} guruhlari", { teacher: teacher.name }))),
      ...rest.map((g) => toOption(g, mine.length ? t("Boshqa guruhlar") : undefined)),
    ];
  }, [groups, course, teacher, t]);

  // Guruh tanlangach uning o'quvchilari yuklanadi — hammasi jadvalga tushadi.
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    fetch(`/api/groups/${groupId}/students`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list: Pupil[] = d.ok ? (d.students as Pupil[]) : [];
        setLoaded({ groupId, list });
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

  function changeCourse(v: string) {
    setCourse(v);
    // Guruhsizda fan — faqat yorliq: ro'yxat va natijalar qoladi.
    if (groupless) return;
    setTeacherId("");
    setGroupId("");
    setCorrect({});
    setAddedIds([]);
  }

  function changeTeacher(v: string) {
    setTeacherId(v);
    if (ed) return; // tahrirda guruh va natijalar qoladi
    setGroupId("");
    setCorrect({});
    setAddedIds([]);
  }

  function changeGroup(v: string) {
    setGroupId(v);
    setCorrect({});
    setAddedIds([]);
  }

  /** Usul almashadi: guruh, ro'yxat va natijalar tozalanadi (fan, oy, sana, savollar soni qoladi). */
  function applyMode(next: "group" | "groupless") {
    setMode(next);
    setAskMode(null);
    setTeacherId("");
    setGroupId("");
    setRoster([]);
    setCorrect({});
    setAddedIds([]);
  }

  function changeMode(v: string) {
    const next = v === "groupless" ? "groupless" : "group";
    if (ed || next === mode) return;
    const entered = Object.values(correct).some((x) => x !== "") || addedIds.length > 0 || roster.length > 0;
    if (entered) setAskMode(next);
    else applyMode(next);
  }

  /** Guruhsiz ro'yxatga (bori — o'z qatoriga); qidiruvdan tanlansa fokus uning natija maydoniga. */
  function addToRoster(pupil: Pupil, isNew = false) {
    setRoster((list) => (list.some((x) => x.id === pupil.id) ? list : [...list, pupil]));
    if (isNew) setAddedIds((ids) => (ids.includes(pupil.id) ? ids : [...ids, pupil.id]));
    const el = inputs.current.get(pupil.id);
    if (el) el.focus();
    else focusAfter.current = pupil.id;
  }

  function removeFromRoster(id: number) {
    setRoster((list) => list.filter((x) => x.id !== id));
    setCorrect((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
    setAddedIds((ids) => ids.filter((x) => x !== id));
  }

  // Qo'shilgan qator chizilgach — natija maydoniga fokus (har chizishdan keyin tekshiriladi, arzon).
  useEffect(() => {
    const id = focusAfter.current;
    if (id === null) return;
    const el = inputs.current.get(id);
    if (!el) return;
    focusAfter.current = null;
    el.focus();
  });

  /** Guruhsizda Enter — keyingi qator, oxirgisida — yana qidiruvga (ketma-ket kiritish). */
  function onResultKey(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const nextPupil = students[i + 1];
    if (nextPupil) inputs.current.get(nextPupil.id)?.focus();
    else searchRef.current?.focus();
  }

  // Sana o'zgarsa oy unga ergashadi (referens `pickDate`); oyni keyin
  // alohida o'zgartirsa bo'ladi.
  function changeDate(iso: string) {
    setDate(iso);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) setMonth(iso.slice(0, 7));
  }

  const totalNum = Math.trunc(Number(total) || 0);

  /** To'g'ri javoblar — savollar sonidan oshsa shunga qisqartiriladi (referens `mark`). */
  function mark(pupilId: number, raw: string) {
    let v = raw.replace(/\D/g, "");
    if (v !== "" && totalNum > 0 && Number(v) > totalNum) v = String(totalNum);
    setCorrect((m) => ({ ...m, [pupilId]: v }));
  }

  /** Jadval qatori uchun hisob: kiritilmagan bo'lsa `null`. */
  function pctOf(p: Pupil): number | null {
    const raw = correct[p.id];
    if (raw === undefined || raw === "" || totalNum <= 0) return null;
    const c = Math.trunc(Number(raw));
    if (!Number.isFinite(c) || c < 0 || c > totalNum) return null;
    return imPct(c, totalNum);
  }

  const filled = students
    .map((p) => ({ p, pct: pctOf(p) }))
    .filter((x): x is { p: Pupil; pct: number } => x.pct !== null);
  const avg = groupAvgPct(filled.map((x) => ({ pct: x.pct })));

  const selectedGroup = useMemo(() => groups.find((g) => String(g.id) === groupId) || null, [groups, groupId]);
  // Guruhsiz ro'yxat: shu oy va fan bo'yicha boshqa sarhisobdagi natija — «bu oyda bor».
  const prior = useMemo(() => priorResults(groupless ? exams : [], month, course, ed?.id), [groupless, exams, month, course, ed]);
  const monthLabel = (() => {
    const v = monthYearFromIso(month);
    return v ? `${MONTH_NAMES[v.month - 1]} ${v.year}` : month;
  })();

  async function save() {
    if (!course) return showError(t("Fan yo'nalishini tanlang"));
    if (!groupless && !teacherName) return showError(t("Ustozni tanlang"));
    if (!groupless && !groupId) return showError(t("Guruhni tanlang"));
    if (!date) return showError(t("Imtihon sanasini tanlang"));
    if (totalNum <= 0) return showError(t("Savollar sonini kiriting"));
    if (filled.length === 0) return showError(t("Kamida bitta o'quvchining natijasini kiriting"));
    // Guruhsizda har qo'shilgan o'quvchi — atayin qo'shilgan: natijasiz qolsa jimgina tushib qolmasin.
    const blank = groupless ? students.filter((x) => (correct[x.id] ?? "") === "").length : 0;
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
          students: filled.map(({ p }) => ({ pupilId: p.id, correct: Math.trunc(Number(correct[p.id])) })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      const exam = data.exam as GroupExam;
      onSaved(exam);
      const p = { groupLabel: examGroupLabel(exam, t), studentCount: exam.studentCount, avgPct: exam.avgPct };
      showSuccess(
        ed
          ? t("Sarhisob yangilandi — {groupLabel} · {studentCount} o'quvchi · o'rtacha {avgPct}%", p)
          : t("Sarhisob saqlandi — {groupLabel} · {studentCount} o'quvchi · o'rtacha {avgPct}%", p),
      );
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  const teacherPlaceholder = !course
    ? t("Avval fanni tanlang")
    : selectPlaceholder(teachersLoading, teacherOptions.length, "Bu fan bo'yicha ustoz yo'q");
  const groupPlaceholder = !course
    ? t("Avval fanni tanlang")
    : !teacherId
      ? t("Avval ustozni tanlang")
      : selectPlaceholder(groupsLoading, groupOptions.length, "Bu fan bo'yicha guruh yo'q");

  const showResults = (groupless ? Boolean(course) : Boolean(groupId)) && totalNum > 0;

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" size="2xl" zIndex={110} locked={saving}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold">{ed ? t("Natijani tahrirlash") : t("Natija qo'shish")}</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {groupless
              ? t("Guruhsiz ro'yxat — o'quvchilar qidirib qo'shiladi, guruhga qo'shilmaydi")
              : ed
                ? t("Bo'sh qoldirilgan o'quvchi sarhisobdan chiqadi")
                : t("Guruh bo'yicha sarhisob — o'zlashtirish avtomatik hisoblanadi")}
          </p>
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
        {/* Kiritish usuli — tahrirda qulf */}
        <Segmented
          value={mode}
          onChange={changeMode}
          disabled={Boolean(ed)}
          options={[
            { value: "group", label: "Guruh bo'yicha", icon: Users },
            { value: "groupless", label: "Guruhsiz ro'yxat", icon: ListChecks, hint: "O'quvchi qidirib qo'shiladi va guruhga qo'shilmaydi. Natija markaz reytingiga tushadi, tanga berilmaydi." },
          ]}
        />
        {askMode && (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <span className="min-w-0 flex-1">{t("Kiritilgan natijalar va ro'yxat tozalanadi.")}</span>
            <button type="button" onClick={() => setAskMode(null)} className="h-8 px-3 rounded-md border border-border bg-card hover:bg-secondary text-[12px] font-medium text-foreground">
              {t("Bekor qilish")}
            </button>
            <button type="button" onClick={() => applyMode(askMode)} className="h-8 px-3 rounded-md bg-primary text-white text-[12px] font-medium hover:opacity-90">
              {t("Almashtirish")}
            </button>
          </div>
        )}

        {/* Qadamlar chizig'i */}
        <div className="flex flex-wrap gap-1.5">
          {groupless ? (
            <>
              <Step n={1} label={t("Fan")} done={Boolean(course)} />
              <Step n={2} label={t("Savollar")} done={totalNum > 0} />
              <Step n={3} label={t("Natijalar")} done={filled.length > 0} />
            </>
          ) : (
            <>
              <Step n={1} label={t("Fan")} done={Boolean(course)} />
              <Step n={2} label={t("Ustoz")} done={Boolean(teacherName)} />
              <Step n={3} label={t("Guruh")} done={Boolean(groupId)} />
              <Step n={4} label={t("Savollar")} done={totalNum > 0} />
              <Step n={5} label={t("Natijalar")} done={filled.length > 0} />
            </>
          )}
        </div>

        <div className={`grid grid-cols-1 gap-3 ${groupless ? "" : "sm:grid-cols-2"}`}>
          <Select
            label={t("Fan (yo'nalish)")}
            required
            value={course}
            onChange={changeCourse}
            options={courseOptions}
            placeholder={selectPlaceholder(coursesLoading, courseOptions.length, "Kurs qo'shilmagan")}
            loading={coursesLoading}
            disabled={Boolean(ed) && !groupless}
            searchable
            searchPlaceholder={t("Fanni qidirish")}
          />
          {!groupless && (
          <Select
            label={t("Ustoz")}
            required
            value={teacherId}
            onChange={changeTeacher}
            options={teacherOptions}
            placeholder={ed && !teacherId ? ed.teacher : teacherPlaceholder}
            loading={Boolean(course) && teachersLoading}
            disabled={!course}
            searchable
            searchPlaceholder={t("Ustozni qidirish")}
            emptyText={t("Bu fan bo'yicha ustoz yo'q")}
          />
          )}
        </div>

        {!groupless && (
        <Select
          label={t("Guruh")}
          required
          value={groupId}
          onChange={changeGroup}
          options={groupOptions}
          placeholder={ed ? ed.groupLabel : groupPlaceholder}
          loading={Boolean(course) && groupsLoading}
          disabled={Boolean(ed) || !teacherId}
          searchable
          searchPlaceholder={t("Guruhni qidirish")}
          emptyText={t("Bu fan bo'yicha guruh yo'q")}
        />
        )}

        {(groupless ? course : groupId) ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium mb-1.5">
                  {t("Oy")}<span className="text-red-500">*</span>
                </label>
                <MonthYearPicker
                  value={monthYearFromIso(month)}
                  onChange={(v) => setMonth(monthYearToIso(v))}
                />
                <div className="text-[11px] text-muted-foreground mt-1">
                  {t("Sarhisob {month} ro'yxatiga tushadi", { month: monthLabel })}
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5">
                  {t("Sana")}<span className="text-red-500">*</span>
                </label>
                <DateField value={date} onChange={changeDate} variant="form" />
              </div>
            </div>

            <div className="max-w-[220px]">
              <label className="block text-[13px] font-medium mb-1.5">
                {t("Savollar soni")}<span className="text-red-500">*</span>
              </label>
              <input
                value={total}
                onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))}
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="0"
                className={`${inputCls} tabular-nums`}
              />
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-[13px] text-primary">
            {groupless
              ? t("Fanni tanlang — keyin o'quvchilarni ism yoki telefon bo'yicha qidirib qo'shasiz.")
              : t("Guruhni tanlang — unga biriktirilgan o'quvchilar ro'yxatda avtomatik chiqadi.")}
          </div>
        )}

        {/* O'quvchilar jadvali — savollar soni kiritilgach (5-qadam) */}
        {showResults && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-secondary/30">
              <div className="text-[14px] font-semibold">
                {t("O'quvchilar")} ({students.length})
              </div>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setNewStudentOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card hover:bg-secondary text-[12px] font-medium"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {groupless ? t("Yangi o'quvchi") : t("O'quvchi qo'shish")}
              </button>
            </div>
            {groupless && (
              <div className="px-3 py-2.5 border-b border-border">
                <PupilSearchInput
                  inputRef={searchRef}
                  onPick={(row) => addToRoster(pupilOfRow(row))}
                  placeholder={t("O'quvchini ism yoki telefon bo'yicha qidiring…")}
                  note={(row) => (rosterIds.has(row.id) ? t("ro'yxatda") : prior.has(row.id) ? t("bu oyda bor") : null)}
                />
              </div>
            )}
            <div className="table-box in-modal">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40">
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left px-3 py-2.5 w-12">№</th>
                    <th className="text-left px-3 py-2.5">{t("O'quvchi")}</th>
                    <th className="text-left px-3 py-2.5 w-36 whitespace-nowrap">{t("To'g'ri javob")}</th>
                    <th className="text-left px-3 py-2.5 w-32">{t("O'zlashtirish")}</th>
                    {groupless && (
                      <th className="w-10 px-2 py-2.5">
                        <span className="sr-only">{t("Olib tashlash")}</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {studentsLoading && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6">
                        <SpinnerBlock size={20} />
                      </td>
                    </tr>
                  )}
                  {!studentsLoading && students.length === 0 && (
                    <tr>
                      <td colSpan={groupless ? 5 : 4} className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                        {groupless ? (
                          <>
                            <div className="font-semibold text-foreground mb-0.5">{t("Ro'yxat hozircha bo'sh")}</div>
                            {t("Yuqoridagi qidiruvdan o'quvchini tanlang; bazada bo'lmasa — «Yangi o'quvchi».")}
                          </>
                        ) : (
                          <>
                            <div className="font-semibold text-foreground mb-0.5">{t("Guruhda o'quvchi yo'q")}</div>
                            {t("«O'quvchi qo'shish» tugmasi bilan qo'shing.")}
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                  {!studentsLoading &&
                    students.map((p, i) => {
                      const raw = correct[p.id] ?? "";
                      const pct = pctOf(p);
                      const before = groupless ? prior.get(p.id) : undefined;
                      return (
                        <tr key={p.id} className="border-b border-border/50 last:border-b-0">
                          <td className="px-3 py-2 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                          <td className="px-3 py-2 text-[13px] font-medium">
                            {pupilFullName(p)}
                            {addedIds.includes(p.id) && (
                              <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-[11px] font-medium text-muted-foreground">
                                {t("Yangi")}
                              </span>
                            )}
                            {extraIds.has(p.id) && (
                              <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-[11px] font-medium text-muted-foreground">
                                {t("guruhda emas")}
                              </span>
                            )}
                            {/* Guruhsiz: ikkinchi qator — telefon va «bu oyda bor» (tor ekranda bo'linmasin). */}
                            {groupless && (p.phone || before) && (
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-normal">
                                {p.phone && <span className="whitespace-nowrap tabular-nums text-muted-foreground">{p.phone}</span>}
                                {before && (
                                  <span
                                    title={t("Shu oy va fan bo'yicha boshqa sarhisobda natijasi bor — ikkalasi saqlansa, reyting va botda keyingisi hisoblanadi.")}
                                    className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
                                  >
                                    {t("bu oyda bor: {where} · {pct}%", { where: examGroupTitle(before.exam, t), pct: before.pct })}
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={(el) => {
                                if (el) inputs.current.set(p.id, el);
                                else inputs.current.delete(p.id);
                              }}
                              value={raw}
                              onChange={(e) => mark(p.id, e.target.value)}
                              onKeyDown={groupless ? (e) => onResultKey(e, i) : undefined}
                              type="number"
                              min={0}
                              max={totalNum}
                              inputMode="numeric"
                              placeholder="—"
                              title={t("0 dan {totalNum} gacha", { totalNum })}
                              className="w-24 h-9 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {pct === null ? <span className="text-[12px] text-muted-foreground">—</span> : <TierBadge pct={pct} />}
                          </td>
                          {groupless && (
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeFromRoster(p.id)}
                                title={t("Ro'yxatdan olib tashlash")}
                                aria-label={t("{name} — ro'yxatdan olib tashlash", { name: pupilFullName(p) })}
                                className="h-8 w-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-rose-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
                {students.length > 0 && (
                  <tfoot>
                    <tr className="bg-secondary/30 border-t border-border">
                      <td colSpan={2} className="px-3 py-2.5 text-[12px] text-muted-foreground">
                        {t("{n} ta o'quvchi · {filled} tasi kiritildi", { n: students.length, filled: filled.length })}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap">{groupless ? t("Ro'yxat o'rtachasi") : t("Guruh o'rtachasi")}</td>
                      <td className="px-3 py-2.5">
                        {filled.length ? (
                          <span className={`text-[14px] font-bold tabular-nums ${imTier(avg).text}`}>{avg}%</span>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">—</span>
                        )}
                      </td>
                      {groupless && <td />}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
        <span className="text-[12px] text-muted-foreground mr-auto">
          {filled.length ? t("{n} ta natija kiritildi", { n: filled.length }) : t("Natijalar kiritilmagan")}
        </span>
        <button
          onClick={modal.close}
          disabled={saving}
          className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
        >
          {t("Bekor qilish")}
        </button>
        <button
          onClick={save}
          disabled={saving || filled.length === 0}
          className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t("Saqlanmoqda…") : ed ? t("O'zgarishlarni saqlash") : t("Sarhisobni saqlash")}
        </button>
      </div>

      {newStudentOpen && groupless && <NewStudentModal groupId={null} onClose={() => setNewStudentOpen(false)} onAdded={(pupil) => addToRoster(pupil, true)} />}

      {newStudentOpen && !groupless && selectedGroup && (
        <NewStudentModal
          groupId={selectedGroup.id}
          groupLabel={groupLabel(selectedGroup)}
          onClose={() => setNewStudentOpen(false)}
          onAdded={(pupil) => {
            setLoaded((cur) => (cur && cur.groupId === groupId ? { ...cur, list: [...cur.list, pupil] } : cur));
            setAddedIds((ids) => [...ids, pupil.id]);
          }}
        />
      )}
    </Modal>
  );
}
