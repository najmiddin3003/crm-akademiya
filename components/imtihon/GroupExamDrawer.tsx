"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, X } from "lucide-react";
import Link from "@/components/ui/Link";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import DateField from "@/components/ui/DateField";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useTeachers } from "@/hooks/useTeachers";
import { useGroups } from "@/hooks/useGroups";
import { groupLabel } from "@/lib/groups";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import { uzDateIso } from "@/lib/uzTime";
import { groupAvgPct, imPct, imTier, type GroupExam } from "@/lib/imtihon";
import TierBadge from "./TierBadge";
import { useT } from "@/components/shared/Language";

// Imtihon → "Natija kiritish" — o'ng tomondan ochiladigan panel.
//
// Zanjir: Fan yo'nalish → Ustoz (shu fan ustozlari) → Guruh (shu fan
// guruhlari) → O'quvchilar (guruh a'zolari, hammasi oldindan belgilangan;
// kelmaganlari olib tashlanadi) → Savollar soni → jadvalda har biriga
// to'g'ri javoblar soni, o'zlashtirish foizi o'zi hisoblanadi.
//
// MANBALAR — hammasi bazadan: fanlar `offline_courses`, ustozlar
// `hr_employees` (turi: teacher, `kurs` maydoni "Biologiya, Sertifikat"
// kabi vergulli), guruhlar `groups` (joriy filial), o'quvchilar
// `/api/groups/:id/students`.
//
// Saqlash → POST /api/imtihon/group (`group_exams`), u har bir o'quvchi
// natijasini `monthly_exams` ga ham ko'chiradi — sahifadagi jadval
// yangilanishi uchun ota `onSaved` da ro'yxatni qayta o'qiydi.

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const norm = (s: string) => s.trim().toLowerCase();

/** "Biologiya, Sertifikat" ichida `course` bormi. */
function teachesCourse(kurs: string, course: string): boolean {
  const want = norm(course);
  return kurs.split(",").some((k) => norm(k) === want);
}

export default function GroupExamDrawer({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (exam: GroupExam) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "drawer");
  const { showSuccess, showError } = useToast();

  const { courses, loading: coursesLoading } = useOfflineCourseList();
  const { teachers, loading: teachersLoading } = useTeachers();
  const { groups, loading: groupsLoading } = useGroups();

  const [date, setDate] = useState(() => uzDateIso());
  const [course, setCourse] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [groupId, setGroupId] = useState("");
  // Qaysi guruh uchun yuklangani bilan birga saqlanadi — "yuklanmoqda"
  // holati shundan hosil qilinadi (effektda sinxron setState kerak emas)
  // va guruh almashganda eski ro'yxat bir zum ham ko'rinmaydi.
  const [loaded, setLoaded] = useState<{ groupId: string; list: Pupil[] } | null>(null);
  const students = useMemo<Pupil[]>(
    () => (loaded && loaded.groupId === groupId ? loaded.list : []),
    [loaded, groupId],
  );
  const studentsLoading = Boolean(groupId) && loaded?.groupId !== groupId;
  /** Imtihonda qatnashgan o'quvchilar (`pupils.id` satr ko'rinishida). */
  const [picked, setPicked] = useState<string[]>([]);
  const [total, setTotal] = useState("");
  /** pupilId → kiritilgan to'g'ri javoblar soni (matn — bo'sh bo'lishi mumkin). */
  const [correct, setCorrect] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const courseOptions = useMemo(() => courses.map((c) => ({ value: c.name, label: c.name })), [courses]);

  const teacherOptions = useMemo(
    () =>
      teachers
        .filter((tv) => course && teachesCourse(tv.kurs, course))
        .map((tv) => ({ value: String(tv.id), label: tv.name, sub: tv.phone || undefined })),
    [teachers, course],
  );

  const groupOptions = useMemo(
    () =>
      groups
        .filter((g) => course && norm(g.course) === norm(course))
        .map((g) => ({
          value: String(g.id),
          label: groupLabel(g),
          sub: g.teacher ? `Ustoz: ${g.teacher}` : undefined,
          hint: t("{studentIds} o'quvchi", { studentIds: g.studentIds?.length ?? 0 }),
        })),
    [groups, course, t],
  );

  const studentOptions = useMemo(
    () => students.map((p) => ({ value: String(p.id), label: pupilFullName(p), sub: p.phone || undefined })),
    [students],
  );

  // Guruh tanlangach uning o'quvchilari yuklanadi va HAMMASI belgilanadi —
  // odatda butun guruh imtihon topshiradi, kelmagani olib tashlanadi.
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    fetch(`/api/groups/${groupId}/students`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list: Pupil[] = d.ok ? (d.students as Pupil[]) : [];
        setLoaded({ groupId, list });
        setPicked(list.map((p) => String(p.id)));
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
    setTeacherId("");
    setGroupId("");
    setPicked([]);
    setCorrect({});
  }

  function changeGroup(v: string) {
    setGroupId(v);
    setPicked([]);
    setCorrect({});
    // Guruhning ustozi ro'yxatda bo'lsa va ustoz hali tanlanmagan bo'lsa —
    // o'zi to'ladi (qo'lda tanlangani ustidan yozilmaydi).
    if (!teacherId && v) {
      const g = groups.find((x) => String(x.id) === v);
      const tv = g && teachers.find((x) => norm(x.name) === norm(g.teacher || ""));
      if (tv && teacherOptions.some((o) => o.value === String(tv.id))) setTeacherId(String(tv.id));
    }
  }

  const totalNum = Math.trunc(Number(total) || 0);
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const rows = useMemo(() => students.filter((p) => pickedSet.has(String(p.id))), [students, pickedSet]);

  /** Jadval qatori uchun hisob: kiritilmagan bo'lsa `null`. */
  function pctOf(p: Pupil): number | null {
    const raw = correct[p.id];
    if (raw === undefined || raw === "" || totalNum <= 0) return null;
    const c = Math.trunc(Number(raw));
    if (!Number.isFinite(c) || c < 0 || c > totalNum) return null;
    return imPct(c, totalNum);
  }

  const filled = rows.map((p) => ({ p, pct: pctOf(p) })).filter((x): x is { p: Pupil; pct: number } => x.pct !== null);
  const avg = groupAvgPct(filled.map((x) => ({ pct: x.pct })));

  async function save() {
    if (!date) return showError(t("Imtihon sanasini tanlang"));
    if (!course) return showError(t("Fan yo'nalishini tanlang"));
    const teacher = teachers.find((tv) => String(tv.id) === teacherId);
    if (!teacher) return showError(t("Ustozni tanlang"));
    if (!groupId) return showError(t("Guruhni tanlang"));
    if (rows.length === 0) return showError(t("Kamida bitta o'quvchi tanlang"));
    if (totalNum <= 0) return showError(t("Savollar sonini kiriting"));
    for (const p of rows) {
      const raw = correct[p.id];
      if (raw === undefined || raw === "") return showError(t("{p} uchun to'g'ri javoblar sonini kiriting", { p: pupilFullName(p) }));
      const c = Math.trunc(Number(raw));
      if (!Number.isFinite(c) || c < 0 || c > totalNum) {
        return showError(t("{p}: to'g'ri javoblar 0 dan {totalNum} gacha bo'lishi kerak", { p: pupilFullName(p), totalNum }));
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/imtihon/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          course,
          teacher: teacher.name,
          groupId: Number(groupId),
          total: totalNum,
          students: rows.map((p) => ({ pupilId: p.id, correct: Math.trunc(Number(correct[p.id])) })),
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
      showSuccess(t("Natija saqlandi — {groupLabel} · {studentCount} o'quvchi · o'rtacha {avgPct}%", { groupLabel: exam.groupLabel, studentCount: exam.studentCount, avgPct: exam.avgPct }));
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  const teacherPlaceholder = !course
    ? "Avval fanni tanlang"
    : selectPlaceholder(teachersLoading, teacherOptions.length, "Bu fan bo'yicha ustoz yo'q");
  const groupPlaceholder = !course
    ? "Avval fanni tanlang"
    : selectPlaceholder(groupsLoading, groupOptions.length, "Bu fan bo'yicha guruh yo'q");
  const studentsPlaceholder = !groupId
    ? "Avval guruhni tanlang"
    : selectPlaceholder(studentsLoading, studentOptions.length, "Guruhda o'quvchi yo'q");

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" size="2xl" zIndex={110} locked={saving}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold">{t("Natija kiritish")}</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {t("Guruh bo'yicha imtihon natijasi — o'zlashtirish avtomatik hisoblanadi")}
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
        <Select
          label={t("Fan yo'nalish")}
          required
          value={course}
          onChange={changeCourse}
          options={courseOptions}
          placeholder={selectPlaceholder(coursesLoading, courseOptions.length, "Kurs qo'shilmagan")}
          loading={coursesLoading}
          searchable
          searchPlaceholder="Fanni qidirish"
        />

        <Select
          label={t("Ustoz")}
          required
          value={teacherId}
          onChange={setTeacherId}
          options={teacherOptions}
          placeholder={teacherPlaceholder}
          loading={Boolean(course) && teachersLoading}
          disabled={!course}
          searchable
          searchPlaceholder="Ustozni qidirish"
          emptyText={t("Bu fan bo'yicha ustoz yo'q")}
          clearable
        />

        <Select
          label={t("Guruh")}
          required
          value={groupId}
          onChange={changeGroup}
          options={groupOptions}
          placeholder={groupPlaceholder}
          loading={Boolean(course) && groupsLoading}
          disabled={!course}
          searchable
          searchPlaceholder="Guruhni qidirish"
          emptyText={t("Bu fan bo'yicha guruh yo'q")}
        />

        <Select
          label={t("O'quvchilar")}
          required
          multiple
          values={picked}
          onChangeMany={setPicked}
          options={studentOptions}
          placeholder={studentsPlaceholder}
          loading={Boolean(groupId) && studentsLoading}
          disabled={!groupId}
          searchable
          searchPlaceholder="Ism yoki telefon"
          emptyText={t("Guruhda o'quvchi yo'q")}
          summary={(n, all) => t("{n} ta o'quvchi tanlandi (jami {all})", { n, all })}
          clearable
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
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
          <div>
            <label className="block text-[13px] font-medium mb-1.5">
              {t("Imtihon sanasi")}<span className="text-red-500">*</span>
            </label>
            <DateField value={date} onChange={setDate} variant="form" />
          </div>
        </div>

        {/* O'quvchilar jadvali */}
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-2.5 w-12">№</th>
                <th className="text-left px-3 py-2.5">{t("Ism familiya")}</th>
                <th className="text-left px-3 py-2.5 w-36 whitespace-nowrap">{t("To'g'ri javoblar")}</th>
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
              {!studentsLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                    {groupId ? t("Tanlangan o'quvchi yo'q") : t("Guruhni tanlang — o'quvchilar shu yerda chiqadi")}
                  </td>
                </tr>
              )}
              {!studentsLoading &&
                rows.map((p, i) => {
                  const raw = correct[p.id] ?? "";
                  const c = raw === "" ? null : Math.trunc(Number(raw));
                  const over = c !== null && totalNum > 0 && c > totalNum;
                  const pct = pctOf(p);
                  return (
                    <tr key={p.id} className="border-b border-border/50 last:border-b-0">
                      <td className="px-3 py-2 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                      <td className="px-3 py-2 text-[13px] font-medium">{pupilFullName(p)}</td>
                      <td className="px-3 py-2">
                        <input
                          value={raw}
                          onChange={(e) =>
                            setCorrect((m) => ({ ...m, [p.id]: e.target.value.replace(/\D/g, "") }))
                          }
                          type="number"
                          min={0}
                          max={totalNum || undefined}
                          inputMode="numeric"
                          placeholder="0"
                          title={totalNum > 0 ? `0 dan ${totalNum} gacha` : "Avval savollar sonini kiriting"}
                          className={`w-24 h-9 rounded-lg border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 ${
                            over ? "border-red-400 ring-2 ring-red-400/60" : "border-border focus:ring-primary/40"
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {pct === null ? (
                          <span className="text-[12px] text-muted-foreground">{over ? t("⚠ savoldan ko'p") : "—"}</span>
                        ) : (
                          <TierBadge pct={pct} />
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-secondary/30 border-t border-border">
                  <td colSpan={2} className="px-3 py-2.5 text-[12px] text-muted-foreground">
                    {rows.length} ta o&apos;quvchi · {filled.length} tasi kiritildi
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

      <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
        <Link
          href="/imtihon/sarhisob"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-primary/40 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15"
        >
          <BarChart3 className="w-4 h-4" />
          {t("Sarhisob")}
        </Link>
        <div className="flex-1" />
        <button
          onClick={modal.close}
          disabled={saving}
          className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
        >
          {t("Bekor qilish")}
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {saving ? t("Saqlanmoqda…") : t("Saqlash")}
        </button>
      </div>
    </Modal>
  );
}
