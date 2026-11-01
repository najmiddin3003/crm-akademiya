"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ListChecks, Loader2, Plus, RotateCw, Search, UserPlus, Users, X } from "lucide-react";
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
import { studentPhoneLabel } from "@/components/v2/form/StudentSearchField";
import TierBadge from "./TierBadge";
import NewStudentModal from "./NewStudentModal";
import {
  centerRoster,
  filterRoster,
  groupsByPupil,
  priorResults,
  pupilOfRow,
  rosterIndex,
  rosterOfExam,
  sortByName,
  type RosterFilter,
} from "./examRoster";
import { useActivePupils, useOutsideSearch, useVirtualRows } from "./useCenterRoster";
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
// Ro'yxat — filialning BARCHA faol o'quvchilari (o'sha kuni kechqurun foydalanuvchi: «"ro'yxat bo'sh"
// chiqyapti, o'rniga markazdagi barcha o'quvchilar ro'yxati chiqsin»), alifbo bo'yicha, har qatorda
// telefon va guruhi (yoki «guruhsiz»); tepada qidiruv (ism/telefon) va «Hammasi | Guruhsiz |
// Kiritilgan». Faollar orasida topilmasa — butun bazadan (arxivdagi ham), bazada yo'q bo'lsa «Yangi
// o'quvchi» (NewStudentModal, guruhsiz karta); atayin qo'shilganlar ro'yxat boshida. Natija
// yozilmagani saqlanmaydi. ~5 000 qator — faqat ko'rinib turganlari chiziladi (useVirtualRows).
// Enter: qidiruv bo'lsa — qidiruvga qaytadi (keyingi ism), bo'lmasa — keyingi qator; ↑/↓ — qatorlar.
// Shu oy va fandan boshqa sarhisobda natijasi bori — «bu oyda bor». Saqlash — `groupless: true`;
// tahrirda usul qulf, sukut filtr «Kiritilgan». Yordamchilar — examRoster.ts va useCenterRoster.ts
// (yangi versiya bilan bitta).

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

/** Guruhsiz ro'yxatdagi kichik tugmalar (qo'shish, qayta urinish, filtrni almashtirish). */
const smallBtnCls =
  "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card hover:bg-secondary text-[12px] font-medium text-foreground";

/** Guruhsiz ro'yxat qatoridagi yorliq («Yangi», «faol emas», «guruhsiz»). */
const tagCls = "shrink-0 inline-flex items-center px-2 py-px rounded-full bg-secondary text-[11px] font-medium text-muted-foreground";

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
  /** Guruhsiz ro'yxatga atayin qo'shilganlar (yangi karta, bazadan; tahrirda — sarhisobdagilar) — ro'yxat boshida. */
  const [extras, setExtras] = useState<Pupil[]>(() => (ed && isGroupless(ed) ? rosterOfExam(ed) : []));
  /** Guruhsiz ro'yxat qidiruvi — ism yoki telefon. */
  const [query, setQuery] = useState("");
  /** Guruhsiz ro'yxat filtri; tahrirda sukut — natijasi borlar. */
  const [filter, setFilter] = useState<RosterFilter>(ed && isGroupless(ed) ? "entered" : "all");
  /** «Kiritilgan» tanlangan paytdagi natijali o'quvchilar — natijasi o'chirilsa ham qatori qochib ketmaydi. */
  const [enteredSnap, setEnteredSnap] = useState<Set<number>>(() => new Set(ed && isGroupless(ed) ? ed.students.map((s) => s.pupilId) : []));
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
  // Guruhsiz ro'yxat — filialning faol o'quvchilari (alifbo bo'yicha), atayin qo'shilganlar boshida.
  const active = useActivePupils(groupless);
  const sortedBase = useMemo(() => (active.list ? sortByName(active.list) : []), [active.list]);
  const baseIds = useMemo(() => new Set((active.list ?? []).map((p) => p.id)), [active.list]);
  const roster = useMemo(() => centerRoster(sortedBase, extras), [sortedBase, extras]);
  const rosterIdSet = useMemo(() => new Set(roster.map((p) => p.id)), [roster]);
  const groupsOf = useMemo(() => groupsByPupil(groups), [groups]);
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
  const studentsLoading = groupless ? active.list === null && !active.error : Boolean(groupId) && loaded?.groupId !== groupId;

  // Guruhsiz ro'yxat: qidiruv + filtr, faqat ko'rinib turgan qatorlar chiziladi.
  const index = useMemo(() => (groupless ? rosterIndex(roster) : []), [groupless, roster]);
  const visible = useMemo(() => filterRoster(index, { query, filter, groupsOf, entered: enteredSnap }), [index, query, filter, groupsOf, enteredSnap]);
  const grouplessCount = useMemo(() => (groupless ? roster.reduce((n, p) => n + (groupsOf.has(p.id) ? 0 : 1), 0) : 0), [groupless, roster, groupsOf]);
  // Filtr ichida topilmadi, lekin «Hammasi» da bor — filtrni almashtirish taklif qilinadi.
  const allMatches = useMemo(
    () => (groupless && visible.length === 0 && filter !== "all" && query.trim() ? filterRoster(index, { query, filter: "all", groupsOf, entered: enteredSnap }).length : 0),
    [groupless, visible.length, filter, query, index, groupsOf, enteredSnap],
  );
  const virt = useVirtualRows(visible.length, 57);
  // Faollar orasida umuman topilmadi — butun bazadan (arxivdagi, muzlatilgan).
  const outside = useOutsideSearch(query, groupless && !studentsLoading && visible.length === 0 && allMatches === 0);
  const outsideRows = outside.rows.filter((r) => !rosterIdSet.has(r.id));
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
    setExtras([]);
    setQuery("");
    setFilter("all");
    setEnteredSnap(new Set());
    setCorrect({});
    setAddedIds([]);
  }

  function changeMode(v: string) {
    const next = v === "groupless" ? "groupless" : "group";
    if (ed || next === mode) return;
    const entered = Object.values(correct).some((x) => x !== "") || addedIds.length > 0;
    if (entered) setAskMode(next);
    else applyMode(next);
  }

  /**
   * Guruhsiz ro'yxatga atayin qo'shish (yangi karta, bazadan topilgan) — ro'yxat boshiga, qidiruv va
   * filtr tozalanadi, fokus uning natija maydoniga.
   */
  function addExtra(pupil: Pupil, isNew = false) {
    setExtras((list) => [pupil, ...list.filter((x) => x.id !== pupil.id)]);
    if (isNew) setAddedIds((ids) => (ids.includes(pupil.id) ? ids : [...ids, pupil.id]));
    setQuery("");
    setFilter("all");
    virt.scrollToTop();
    focusAfter.current = pupil.id;
  }

  function changeQuery(v: string) {
    setQuery(v);
    virt.scrollToTop();
  }

  function changeFilter(f: RosterFilter) {
    if (f === "entered") setEnteredSnap(new Set(Object.keys(correct).filter((k) => correct[Number(k)] !== "").map(Number)));
    setFilter(f);
    virt.scrollToTop();
  }

  // Qo'shilgan (yoki ↑/↓ bilan hali chizilmagan) qator chizilgach — natija maydoniga fokus
  // (har chizishdan keyin tekshiriladi, arzon).
  useEffect(() => {
    const id = focusAfter.current;
    if (id === null) return;
    const el = inputs.current.get(id);
    if (!el) return;
    focusAfter.current = null;
    el.focus();
    el.select();
  });

  /** `i` — filtrlangan ro'yxatdagi o'rin (qator hali chizilmagan bo'lishi mumkin). */
  function focusRowAt(i: number) {
    const p = visible[i];
    if (!p) return;
    virt.scrollToIndex(i);
    const el = inputs.current.get(p.id);
    if (el) {
      el.focus();
      el.select();
    } else focusAfter.current = p.id;
  }

  function focusSearch() {
    searchRef.current?.focus();
    searchRef.current?.select();
  }

  /** Guruhsizda: Enter — qidiruv bo'lsa qidiruvga (keyingi ism), bo'lmasa keyingi qator; ↑/↓ — qatorlar. */
  function onResultKey(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      focusSearch();
      return;
    }
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (i + 1 < visible.length) focusRowAt(i + 1);
      else focusSearch();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (i > 0) focusRowAt(i - 1);
      else focusSearch();
    }
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === "ArrowDown") && visible.length > 0) {
      e.preventDefault();
      focusRowAt(0);
    } else if (e.key === "Escape" && query) {
      // Esc qidiruvni tozalaydi — panelning o'zi yopilmasin (Modal oynadagi keydown'ni tinglaydi).
      e.preventDefault();
      e.stopPropagation();
      changeQuery("");
    }
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
    // Guruhsizda ham natija yozilmagani saqlanmaydi — ro'yxat filialning barcha faol o'quvchilari.
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

  // ── Guruhsiz ro'yxat qatori: balandligi BIR XIL (ism + ikkinchi qator — telefon, guruh yoki «guruhsiz»,
  // «bu oyda bor») — uzun ro'yxat faqat ko'rinib turgan qatorlarni chizadi (useVirtualRows), birinchisi
  // o'lchanadi (`measure`). Natija maydoni matnli (inputMode numeric): `type="number"` ro'yxatni
  // g'ildirak bilan aylantirganda fokusdagi qiymatni o'zgartirib yuborardi.
  const renderGrouplessRow = (p: Pupil, i: number, measure: boolean) => {
    const raw = correct[p.id] ?? "";
    const pct = pctOf(p);
    const name = pupilFullName(p);
    const before = prior.get(p.id);
    const isNew = addedIds.includes(p.id);
    // Faollar ro'yxatida yo'q — bazadan qo'shilgan (arxivdagi, muzlatilgan) yoki sarhisobda bo'lib endi faol emas.
    const inactive = !isNew && active.list !== null && !baseIds.has(p.id);
    const glabels = groupsOf.get(p.id);
    return (
      <tr key={p.id} ref={measure ? virt.measureRow : undefined} className="h-14 border-b border-border/50">
        <td className="px-3 py-2 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
        <td className="px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-medium" title={name}>
              {name || "—"}
            </span>
            {isNew && <span className={tagCls}>{t("Yangi")}</span>}
            {inactive && <span className={tagCls}>{t("faol emas")}</span>}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-x-2 overflow-hidden whitespace-nowrap text-[12px] text-muted-foreground">
            {before && (
              <span
                title={t("Shu oy va fan bo'yicha boshqa sarhisobda natijasi bor — ikkalasi saqlansa, reyting va botda keyingisi hisoblanadi.")}
                className="min-w-0 max-w-[60%] truncate rounded-full bg-amber-100 px-2 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
              >
                {t("bu oyda bor: {where} · {pct}%", { where: examGroupTitle(before.exam, t), pct: before.pct })}
              </span>
            )}
            {p.phone && <span className="shrink-0 tabular-nums">{studentPhoneLabel(p.phone)}</span>}
            {glabels?.length ? (
              <span className="min-w-0 truncate" title={glabels.join(", ")}>
                {glabels[0]}
                {glabels.length > 1 ? ` +${glabels.length - 1}` : ""}
              </span>
            ) : (
              <span className={tagCls}>{t("guruhsiz")}</span>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <input
            ref={(el) => {
              if (el) inputs.current.set(p.id, el);
              else inputs.current.delete(p.id);
            }}
            value={raw}
            onChange={(e) => mark(p.id, e.target.value)}
            onKeyDown={(e) => onResultKey(e, i)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="—"
            aria-label={t("{name} — to'g'ri javoblar", { name })}
            title={t("0 dan {totalNum} gacha", { totalNum })}
            className="w-24 h-9 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </td>
        <td className="px-3 py-2">{pct === null ? <span className="text-[12px] text-muted-foreground">—</span> : <TierBadge pct={pct} />}</td>
      </tr>
    );
  };

  // Guruhsiz ro'yxatda hech kim chiqmadi: qidiruv bo'lsa — «Hammasi» taklifi yoki butun bazadan qidiruv
  // (arxivdagi, muzlatilgan) va «Yangi o'quvchi»; aks holda filtr bo'yicha izoh.
  const searchQ = query.trim();
  const emptyGroupless = searchQ ? (
    <div className="mx-auto max-w-md text-center">
      <div className="font-semibold text-foreground">{t("«{q}» ro'yxatda topilmadi", { q: searchQ })}</div>
      {allMatches > 0 ? (
        <button type="button" onClick={() => changeFilter("all")} className={`${smallBtnCls} mt-3`}>
          {t("«Hammasi»da {n} ta bor — ko'rsatish", { n: allMatches })}
        </button>
      ) : outside.loading ? (
        <Loader2 className="mx-auto mt-3 h-4 w-4 animate-spin" aria-label={t("Qidirilmoqda")} />
      ) : outsideRows.length > 0 ? (
        <>
          <p className="mt-1">{t("Bazada bor, lekin faol emas — qo'shsangiz ro'yxat boshiga chiqadi:")}</p>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border text-left">
            {outsideRows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{row.name}</div>
                  <div className="truncate text-[12px]">
                    {[row.phone ? studentPhoneLabel(row.phone) : "", row.status ? t(row.status) : ""].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <button type="button" onClick={() => addExtra(pupilOfRow(row))} className={smallBtnCls}>
                  <Plus className="w-3.5 h-3.5" />
                  {t("Qo'shish")}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1">{t("Bazada ham topilmadi — yangi o'quvchi bo'lsa, karta oching.")}</p>
      )}
      {allMatches === 0 && !outside.loading && (
        <button type="button" onClick={() => setNewStudentOpen(true)} className={`${smallBtnCls} mt-3`}>
          <UserPlus className="w-3.5 h-3.5" />
          {t("Yangi o'quvchi")}
        </button>
      )}
    </div>
  ) : (
    <div className="text-center">
      <div className="font-semibold text-foreground mb-0.5">
        {filter === "entered" ? t("Hali natija yozilmagan") : filter === "groupless" ? t("Guruhsiz o'quvchi yo'q") : t("Filialda faol o'quvchi yo'q")}
      </div>
      {filter === "all" ? t("Yangi o'quvchi bo'lsa — «Yangi o'quvchi» bilan karta oching.") : t("«Hammasi» filtrida — filialning barcha faol o'quvchilari.")}
    </div>
  );

  const filterChip = (f: RosterFilter, label: string, n: number, title?: string) => (
    <button
      key={f}
      type="button"
      onClick={() => changeFilter(f)}
      aria-pressed={filter === f}
      title={title}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12px] font-medium whitespace-nowrap transition-colors ${
        filter === f ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {label}
      <span className="tabular-nums opacity-70">{n}</span>
    </button>
  );

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" size="2xl" zIndex={110} locked={saving}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold">{ed ? t("Natijani tahrirlash") : t("Natija qo'shish")}</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {groupless
              ? t("Guruhsiz ro'yxat — filialning faol o'quvchilari, natija yozilmagani saqlanmaydi")
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
            {
              value: "groupless",
              label: "Guruhsiz ro'yxat",
              icon: ListChecks,
              hint: "Filialning barcha faol o'quvchilari chiqadi — natija yozilganlari saqlanadi, hech kim guruhga qo'shilmaydi. Natija markaz reytingiga tushadi, tanga berilmaydi.",
            },
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
              ? t("Fanni tanlang — keyin filialning barcha faol o'quvchilari ro'yxatda chiqadi.")
              : t("Guruhni tanlang — unga biriktirilgan o'quvchilar ro'yxatda avtomatik chiqadi.")}
          </div>
        )}

        {/* O'quvchilar jadvali — savollar soni kiritilgach (5-qadam) */}
        {showResults && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-border bg-secondary/30">
              <div className="text-[14px] font-semibold">
                {t("O'quvchilar")} ({students.length})
              </div>
              <div className="flex-1" />
              {/* Guruhsizda jadvalning pastki qatori (o'rtacha) minglab qator ostida qolardi — shu yerda. */}
              {groupless && filled.length > 0 && (
                <span className="text-[12px] text-muted-foreground whitespace-nowrap">
                  {t("Ro'yxat o'rtachasi")} <span className={`text-[13px] font-bold tabular-nums ${imTier(avg).text}`}>{avg}%</span>
                </span>
              )}
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
              <div className="flex flex-col gap-2 px-3 py-2.5 border-b border-border sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => changeQuery(e.target.value)}
                    onKeyDown={onSearchKey}
                    placeholder={t("O'quvchini ism yoki telefon bo'yicha qidiring…")}
                    aria-label={t("O'quvchini qidirish")}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full h-10 rounded-lg border border-border bg-card pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        changeQuery("");
                        searchRef.current?.focus();
                      }}
                      title={t("Tozalash")}
                      aria-label={t("Qidiruvni tozalash")}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div role="group" aria-label={t("Ro'yxat filtri")} className="flex flex-wrap gap-1.5">
                  {filterChip("all", t("Hammasi"), roster.length)}
                  {filterChip("groupless", t("Guruhsiz"), grouplessCount, t("Hech bir guruhga joylanmagan o'quvchilar"))}
                  {filterChip("entered", t("Kiritilgan"), filled.length, t("Natijasi yozilganlar"))}
                </div>
              </div>
            )}
            {/* Guruhsizda — shu quti aylanadi (sarlavha qotadi), faqat ko'rinib turgan qatorlar chiziladi. */}
            <div ref={groupless ? virt.setBox : undefined} onScroll={groupless ? virt.onScroll : undefined} className="table-box in-modal">
              <table className={`w-full text-sm ${groupless ? "virt-tbl table-fixed min-w-[540px]" : ""}`}>
                <thead ref={groupless ? virt.measureHead : undefined} className="bg-secondary/40">
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className={`text-left px-3 py-2.5 ${groupless ? "w-16" : "w-12"}`}>№</th>
                    <th className="text-left px-3 py-2.5">{t("O'quvchi")}</th>
                    <th className="text-left px-3 py-2.5 w-36 whitespace-nowrap">{t("To'g'ri javob")}</th>
                    <th className="text-left px-3 py-2.5 w-32">{t("O'zlashtirish")}</th>
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
                  {!studentsLoading &&
                    groupless &&
                    (active.error && active.list === null ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                          <div className="font-semibold text-foreground mb-2">{t("O'quvchilar yuklanmadi")}</div>
                          <button type="button" onClick={active.retry} className={smallBtnCls}>
                            <RotateCw className="w-3.5 h-3.5" />
                            {t("Qayta urinish")}
                          </button>
                        </td>
                      </tr>
                    ) : visible.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-[13px] text-muted-foreground">
                          {emptyGroupless}
                        </td>
                      </tr>
                    ) : (
                      <>
                        {virt.padTop > 0 && (
                          <tr aria-hidden>
                            <td colSpan={4} className="p-0" style={{ height: virt.padTop }} />
                          </tr>
                        )}
                        {visible.slice(virt.first, virt.last).map((p, k) => renderGrouplessRow(p, virt.first + k, k === 0))}
                        {virt.padBottom > 0 && (
                          <tr aria-hidden>
                            <td colSpan={4} className="p-0" style={{ height: virt.padBottom }} />
                          </tr>
                        )}
                      </>
                    ))}
                  {!studentsLoading && !groupless && students.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                        <div className="font-semibold text-foreground mb-0.5">{t("Guruhda o'quvchi yo'q")}</div>
                        {t("«O'quvchi qo'shish» tugmasi bilan qo'shing.")}
                      </td>
                    </tr>
                  )}
                  {!studentsLoading &&
                    !groupless &&
                    students.map((p, i) => {
                      const raw = correct[p.id] ?? "";
                      const pct = pctOf(p);
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
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={(el) => {
                                if (el) inputs.current.set(p.id, el);
                                else inputs.current.delete(p.id);
                              }}
                              value={raw}
                              onChange={(e) => mark(p.id, e.target.value)}
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
                        </tr>
                      );
                    })}
                </tbody>
                {!groupless && students.length > 0 && (
                  <tfoot>
                    <tr className="bg-secondary/30 border-t border-border">
                      <td colSpan={2} className="px-3 py-2.5 text-[12px] text-muted-foreground">
                        {t("{n} ta o'quvchi · {filled} tasi kiritildi", { n: students.length, filled: filled.length })}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap">{t("Guruh o'rtachasi")}</td>
                      <td className="px-3 py-2.5">
                        {filled.length ? (
                          <span className={`text-[14px] font-bold tabular-nums ${imTier(avg).text}`}>{avg}%</span>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">—</span>
                        )}
                      </td>
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

      {newStudentOpen && groupless && <NewStudentModal groupId={null} onClose={() => setNewStudentOpen(false)} onAdded={(pupil) => addExtra(pupil, true)} />}

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
