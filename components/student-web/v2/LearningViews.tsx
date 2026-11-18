"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock, FileText, Info, LifeBuoy, Loader2, Lock, Play, PlayCircle, Plus, Users, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import type { StudentMe } from "@/components/student-web/types";
import type { OnlineModule } from "@/lib/onlineCourseAdminTypes";
import type { StudentCabinet } from "@/lib/studentCabinetTypes";
import { extras } from "./CabinetPages";
import { Card, fmtSom, initials, useCabinetFmt } from "./bits";

// O'QUVCHI KABINETI → DARSLAR (43-qism, rasmlar «Darslar · uyga vazifalar / support darslari / onlayn kurslar»,
// «Uyga vazifa», «Support darsi · navbatga yozilish», «Onlayn kurs · video dars / modul testi»).
//   • Vazifalar — guruh topshiriqlari (Topshiriqlar), muddati bo'yicha; tafsilot. Kabinetdan fayl topshirish va
//     ustoz bahosi tizimda yo'q (SAVOLLAR 540) — topshirish darsda;
//   • Support — o'zi yoziladi / navbatga turadi / chiqadi (haftasiga 2 ta), o'tgan yozilishlar (keldi/kelmadi);
//   • Onlayn kurslar — e'lon qilingan kurslar, progress, video pleer (ko'rilgan dars belgilanadi). Pullik kurs yopiq,
//     modul testi «Tez orada» (SAVOLLAR 542). Server: /api/student-web/extras (lib/studentLearning.ts).

// ── Vazifalar ───────────────────────────────────────────────────────

type Task = StudentMe["tasks"][number];
const isoOfDeadline = (d: string) => {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s*\|\s*(\d{2}:\d{2}))?/.exec(d || "");
  return m ? { date: `${m[3]}-${m[2]}-${m[1]}`, time: m[4] ?? "" } : { date: (d || "").slice(0, 10), time: (d || "").slice(11, 16) };
};

function TaskRow({ x, overdue, onOpen, badge, due }: { x: Task; overdue?: boolean; onOpen: () => void; badge: string; due: string }) {
  const { t } = useT();
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 border-b border-v2-border px-4 py-3 text-left last:border-0 hover:bg-v2-surface-2">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-v2-sm bg-v2-info-bg px-1.5 py-0.5 text-v2-caption font-semibold text-v2-info">{x.groupName || t("Guruh")}</span>
          {x.type && x.type !== "Vazifa" && <span className="text-v2-caption text-v2-text-3">{t(x.type)}</span>}
        </span>
        <span className="mt-1 block font-semibold text-v2-text">{x.name}</span>
        <span className="block text-v2-small text-v2-text-2">{[x.note.slice(0, 60), due ? t("muddat {d}", { d: due }) : ""].filter(Boolean).join(" · ")}</span>
      </span>
      {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-v2-caption font-semibold ${overdue ? "bg-v2-surface-2 text-v2-text-2" : "bg-v2-warning-bg text-v2-warning"}`}>{badge}</span>}
    </button>
  );
}

export function TasksView({ me, cab }: { me: StudentMe; cab: StudentCabinet }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const [course, setCourse] = useState("");
  const [open, setOpen] = useState<Task | null>(null);
  const courses = [...new Set(me.tasks.map((x) => x.groupName).filter(Boolean))];
  const list = me.tasks.filter((x) => !course || x.groupName === course).map((x) => ({ ...x, d: isoOfDeadline(x.deadline) }));
  const todo = list.filter((x) => !x.d.date || x.d.date >= cab.today).sort((a, b) => a.d.date.localeCompare(b.d.date));
  const past = list.filter((x) => x.d.date && x.d.date < cab.today).sort((a, b) => b.d.date.localeCompare(a.d.date));
  const left = (iso: string) => {
    const n = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${cab.today}T00:00:00Z`)) / 86400_000);
    return n <= 0 ? t("Bugun") : n === 1 ? t("Ertaga") : t("{n} kun qoldi", { n });
  };
  if (open) return <TaskDetail task={open} onBack={() => setOpen(null)} left={open.deadline ? left(isoOfDeadline(open.deadline).date) : ""} />;
  return (
    <div className="space-y-3">
      {courses.length > 1 && (
        <div role="tablist" className="flex gap-1 overflow-x-auto rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
          {["", ...courses].map((c) => (
            <button key={c || "all"} type="button" role="tab" aria-selected={course === c} onClick={() => setCourse(c)} className={`h-8 shrink-0 rounded-v2-sm px-3 text-v2-small font-semibold ${course === c ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
              {c || t("Hammasi")}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface">
        <div className="bg-v2-surface-2 px-4 py-1.5 text-v2-caption font-semibold text-v2-text-2">{t("Bajarish kerak · {n}", { n: todo.length })}</div>
        {todo.map((x) => (
          <TaskRow key={x.id} x={x} onOpen={() => setOpen(x)} badge={x.d.date ? left(x.d.date) : ""} due={x.d.date ? fmt.dayMonth(x.d.date) : ""} />
        ))}
        {!todo.length && <p className="px-4 py-4 text-center text-v2-small text-v2-text-3">{t("Hozircha vazifa yo'q")}</p>}
        {past.length > 0 && (
          <>
            <div className="bg-v2-surface-2 px-4 py-1.5 text-v2-caption font-semibold text-v2-text-2">{t("Muddati o'tgan · {n}", { n: past.length })}</div>
            {past.slice(0, 10).map((x) => (
              <TaskRow key={x.id} x={x} overdue onOpen={() => setOpen(x)} badge={t("muddati o'tdi")} due={fmt.dayMonth(x.d.date)} />
            ))}
          </>
        )}
      </div>
      <p className="flex gap-2 px-1 text-v2-caption text-v2-text-3">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("Vazifa daftarda bajariladi va darsda tekshiriladi. Kabinetdan rasm yuborish tez orada.")}
      </p>
    </div>
  );
}

function TaskDetail({ task, onBack, left }: { task: Task; onBack: () => void; left: string }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const d = isoOfDeadline(task.deadline);
  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="-ml-1 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-text-2">
        <ArrowLeft className="size-4" aria-hidden /> {t("Vazifalar")}
      </button>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-v2-sm bg-v2-info-bg px-1.5 py-0.5 text-v2-caption font-semibold text-v2-info">{task.groupName}</span>
        {left && <span className="rounded-v2-sm bg-v2-warning-bg px-1.5 py-0.5 text-v2-caption font-semibold text-v2-warning">{left}</span>}
      </div>
      <h2 className="text-[20px] font-semibold text-v2-text">{task.name}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-3">
          <div className="text-v2-caption text-v2-text-2">{t("Muddat")}</div>
          <div className="font-semibold text-v2-text">{d.date ? fmt.dayMonth(d.date) : "—"}</div>
          {d.time && <div className="text-v2-caption text-v2-text-2">{t("{s} gacha", { s: d.time })}</div>}
        </Card>
        <Card className="!p-3">
          <div className="text-v2-caption text-v2-text-2">{t("Maks. ball")}</div>
          <div className="font-semibold text-v2-text">{task.maxScore || "—"}</div>
          <div className="text-v2-caption text-v2-text-2">{t("ustoz baholaydi")}</div>
        </Card>
      </div>
      <Card>
        <div className="text-v2-caption text-v2-text-2">{t("Topshiriq")}</div>
        <p className="mt-1 whitespace-pre-line text-v2-body text-v2-text">{task.note || t("Izoh yozilmagan — ustoz darsda tushuntiradi.")}</p>
      </Card>
      <div className="flex gap-2 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Javobni daftarda tayyorlab, darsda ustozga ko'rsating. Kabinetdan rasm yoki fayl yuborish keyingi bosqichda.")}
      </div>
    </div>
  );
}

// ── Support ─────────────────────────────────────────────────────────

type SLesson = { id: number; date: string; start: string; room: string; course: string; topic: string; teacher: string; capacity: number; seats: number; queue: number; status: string; mine: "seat" | "queue" | null; queuePos: number };
type SState = { weekUsed: number; limit: number; upcoming: SLesson[]; history: { id: number; date: string; start: string; course: string; topic: string; teacher: string; came: boolean | null }[] };

export function SupportView({ cab, initData }: { cab: StudentCabinet; initData: string }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const { showSuccess, showError } = useToast();
  const [st, setSt] = useState<SState | null>(null);
  const [sheet, setSheet] = useState<SLesson | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let off = false;
    void extras<SState>(initData, { action: "support" }).then((r) => !off && setSt(r.ok ? r : { weekUsed: 0, limit: 2, upcoming: [], history: [] }));
    return () => {
      off = true;
    };
  }, [initData]);
  async function act(action: "support-enroll" | "support-cancel", id: number) {
    setBusy(true);
    const r = await extras<SState & { placed?: string }>(initData, { action, id });
    setBusy(false);
    setSheet(null);
    if (!r.ok) return showError(t(r.error));
    setSt(r);
    showSuccess(action === "support-cancel" ? t("Yozilish bekor qilindi") : r.placed === "queue" ? t("Navbatga yozildingiz") : t("Yozildingiz"));
  }
  if (!st)
    return (
      <div className="flex items-center gap-2 p-4 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const conflict = (l: SLesson) => cab.lessons.items.find((x) => x.date === l.date && x.start && x.end && l.start >= x.start && l.start < x.end);
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand">
            <LifeBuoy className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-v2-text">{t("Support darslari")}</div>
            <div className="text-v2-small text-v2-text-2">{t("Mavzuni tushunmasangiz — qo'shimcha dars. Support ustoz o'tadi.")}</div>
          </div>
        </div>
        <div className="mt-3 flex justify-between text-v2-small">
          <span className="text-v2-text-2">{t("Bu hafta yozildingiz")}</span>
          <span className="font-semibold tabular-nums text-v2-text">
            {st.weekUsed} / {st.limit}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
          <div className="h-full rounded-full bg-v2-brand" style={{ width: `${Math.min(100, (st.weekUsed / st.limit) * 100)}%` }} />
        </div>
      </Card>
      <h3 className="px-1 text-v2-small font-semibold text-v2-text-2">{t("Yaqin support darslari · {n}", { n: st.upcoming.length })}</h3>
      {!st.upcoming.length && (
        <Card>
          <p className="py-4 text-center text-v2-small text-v2-text-3">{t("Yaqin kunlarda support darsi yo'q")}</p>
        </Card>
      )}
      {st.upcoming.map((l) => {
        const full = l.seats >= l.capacity;
        const c = conflict(l);
        const left = l.capacity - l.seats;
        return (
          <Card key={l.id}>
            <div className="flex gap-3">
              <span className="flex w-12 shrink-0 flex-col items-center justify-center rounded-v2-md border border-v2-border py-1">
                <span className="text-[18px] font-semibold leading-6 text-v2-text">{Number(l.date.slice(8, 10))}</span>
                <span className="text-[10px] text-v2-text-2">{fmt.weekdayShort(l.date)}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-v2-small text-v2-text-2">
                  {l.course && <span className="rounded-v2-sm bg-v2-success-bg px-1.5 py-0.5 text-v2-caption font-semibold text-v2-success">{l.course}</span>}
                  <span>{[l.start, l.room].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="mt-0.5 font-semibold text-v2-text">{l.topic}</div>
                <div className="flex items-center gap-1.5 text-v2-small text-v2-text-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-v2-surface-2 text-[9px] font-semibold">{initials(l.teacher)}</span>
                  {t("{n} · support ustoz", { n: l.teacher })}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-v2-small">
              <span className={`rounded-full px-2 py-0.5 text-v2-caption font-semibold ${full ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-success-bg text-v2-success"}`}>{full ? t("Joy to'ldi") : t("{n} joy qoldi", { n: left })}</span>
              <span className="text-v2-text-2">
                {t("{a} / {b} band", { a: l.seats, b: l.capacity })}
                {l.queue ? ` · ${t("navbatda {n} kishi", { n: l.queue })}` : ""}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
              <div className={`h-full rounded-full ${full ? "bg-v2-warning" : "bg-v2-brand"}`} style={{ width: `${Math.min(100, (l.seats / Math.max(1, l.capacity)) * 100)}%` }} />
            </div>
            {c && !l.mine && <p className="mt-2 text-v2-small text-v2-warning">{t("Shu vaqtda {g} darsingiz bor · {s}–{e}", { g: c.title, s: c.start, e: c.end })}</p>}
            {l.mine ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="flex-1 rounded-v2-md bg-v2-success-bg px-3 py-2 text-v2-small font-semibold text-v2-success">{l.mine === "seat" ? t("Yozilgansiz") : t("Navbatda {n}-bo'lib turibsiz", { n: l.queuePos })}</span>
                <button type="button" disabled={busy} onClick={() => void act("support-cancel", l.id)} className={`${secondaryBtn} disabled:opacity-50`}>
                  <X className="size-4" aria-hidden /> {t("Chiqish")}
                </button>
              </div>
            ) : (
              <button type="button" disabled={busy || st.weekUsed >= st.limit} onClick={() => setSheet(l)} className={`${secondaryBtn} mt-3 h-10 w-full justify-center disabled:opacity-50`}>
                {full ? <Users className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />} {full ? t("Navbatga yozilish") : t("Yozilish")}
              </button>
            )}
          </Card>
        );
      })}
      <ul className="space-y-1.5 px-1 text-v2-small text-v2-text-2">
        <li className="flex gap-2">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Haftasiga {n} marta yozilish mumkin.", { n: st.limit })}
        </li>
        <li className="flex gap-2">
          <Users className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Joy to'lsa navbatga yozilasiz — joy bo'shasa, navbat tartibida o'tasiz.")}
        </li>
      </ul>
      {st.history.length > 0 && (
        <>
          <h3 className="px-1 text-v2-small font-semibold text-v2-text-2">{t("Mening yozilishlarim")}</h3>
          <Card className="!py-1">
            {st.history.map((h) => (
              <div key={h.id} className="flex items-start gap-3 border-b border-v2-border py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-v2-caption text-v2-text-2">
                    {fmt.dayMonth(h.date)}, {fmt.weekdayShort(h.date)} · {h.start}
                  </div>
                  <div className="font-semibold text-v2-text">{h.topic}</div>
                  <div className="text-v2-small text-v2-text-2">{[h.course, h.teacher].filter(Boolean).join(" · ")}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-v2-caption font-semibold ${h.came === true ? "bg-v2-success-bg text-v2-success" : h.came === false ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-surface-2 text-v2-text-2"}`}>{h.came === true ? t("Keldi") : h.came === false ? t("Kelmadi") : t("belgilanmagan")}</span>
              </div>
            ))}
          </Card>
        </>
      )}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSheet(null)}>
          <div role="dialog" aria-modal="true" aria-label={t("Yozilish")} onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] rounded-t-[20px] bg-v2-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-v2-lg">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-v2-border-strong sm:hidden" />
            <h3 className="text-[18px] font-semibold text-v2-text">{sheet.seats >= sheet.capacity ? t("Navbatga yozilish") : t("Support darsiga yozilish")}</h3>
            <p className="text-v2-small text-v2-text-2">{sheet.seats >= sheet.capacity ? t("Bu darsda joy qolmagan") : t("{n} joy qoldi", { n: sheet.capacity - sheet.seats })}</p>
            <div className="mt-3 rounded-v2-md border border-v2-border bg-v2-surface-2 p-3">
              <div className="text-v2-small text-v2-text-2">
                {[sheet.course, `${fmt.weekdayShort(sheet.date)}, ${fmt.dayMonth(sheet.date)}`, sheet.start, sheet.room].filter(Boolean).join(" · ")}
              </div>
              <div className="font-semibold text-v2-text">{sheet.topic}</div>
              <div className="text-v2-small text-v2-text-2">{t("{n} · support ustoz", { n: sheet.teacher })}</div>
            </div>
            {sheet.seats >= sheet.capacity && (
              <div className="mt-3 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-v2-brand-bg text-[18px] font-semibold text-v2-brand">{sheet.queue + 1}</span>
                <span>
                  <span className="block font-semibold text-v2-text">{t("Navbatda {n}-bo'lasiz", { n: sheet.queue + 1 })}</span>
                  <span className="block text-v2-small text-v2-text-2">{t("oldingizda {n} kishi", { n: sheet.queue })}</span>
                </span>
              </div>
            )}
            <p className="mt-3 text-v2-small text-v2-text-2">{t("Haftalik {n} ta yozilishdan biri ishlatiladi (hozir {a} / {n}).", { n: st.limit, a: st.weekUsed })}</p>
            <button type="button" disabled={busy} onClick={() => void act("support-enroll", sheet.id)} className={`${primaryBtn} mt-3 h-12 w-full justify-center disabled:opacity-50`}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} {sheet.seats >= sheet.capacity ? t("Navbatga yozilish") : t("Yozilish")}
            </button>
            <button type="button" onClick={() => setSheet(null)} className="mt-1 h-10 w-full text-v2-small font-semibold text-v2-text-2">
              {t("Bekor qilish")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Onlayn kurslar ──────────────────────────────────────────────────

type Course = { id: number; name: string; teacher: string; cover: string; category: string; audience: string; free: boolean; price: number; open: boolean; modules: OnlineModule[]; done: string[]; last: string; lastAt: string };

export function CoursesView({ initData }: { initData: string }) {
  const { t } = useT();
  const [items, setItems] = useState<Course[] | null>(null);
  const [play, setPlay] = useState<{ course: number; lesson: string } | null>(null);
  const load = () => extras<{ items: Course[] }>(initData, { action: "courses" }).then((r) => setItems(r.ok ? r.items : []));
  useEffect(() => {
    let off = false;
    void extras<{ items: Course[] }>(initData, { action: "courses" }).then((r) => !off && setItems(r.ok ? r.items : []));
    return () => {
      off = true;
    };
  }, [initData]);
  if (!items)
    return (
      <div className="flex items-center gap-2 p-4 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const cur = play ? items.find((c) => c.id === play.course) : null;
  if (cur && play)
    return (
      <CoursePlayer
        course={cur}
        lessonId={play.lesson}
        onPick={(id) => setPlay({ course: cur.id, lesson: id })}
        onBack={() => {
          setPlay(null);
          void load();
        }}
        onDone={async (id) => {
          await extras(initData, { action: "lesson-done", courseId: cur.id, lessonId: id });
          setItems((prev) => prev && prev.map((c) => (c.id === cur.id && !c.done.includes(id) ? { ...c, done: [...c.done, id], last: id } : c)));
        }}
      />
    );
  const lessonsOf = (c: Course) => c.modules.flatMap((m) => m.lessons);
  const resume = items.filter((c) => c.open && c.last && c.done.length < lessonsOf(c).length).sort((a, b) => b.lastAt.localeCompare(a.lastAt))[0];
  const nextLesson = (c: Course) => lessonsOf(c).find((l) => !c.done.includes(l.id)) ?? lessonsOf(c)[0];
  return (
    <div className="space-y-3">
      {resume && nextLesson(resume) && (
        <Card>
          <div className="text-v2-small font-semibold text-v2-text-2">{t("Davom ettirish")}</div>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-v2-md bg-v2-info-bg text-v2-info">
              <Play className="size-6" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-v2-text">{nextLesson(resume)!.title}</span>
              <span className="block text-v2-small text-v2-text-2">{resume.name}</span>
            </span>
          </div>
          <button type="button" onClick={() => setPlay({ course: resume.id, lesson: nextLesson(resume)!.id })} className={`${primaryBtn} mt-3 h-11 w-full justify-center`}>
            <PlayCircle className="size-4" aria-hidden /> {t("Davom etish")}
          </button>
        </Card>
      )}
      <h3 className="px-1 text-v2-small font-semibold text-v2-text-2">{t("Kurslar · {n}", { n: items.length })}</h3>
      {!items.length && (
        <Card>
          <p className="py-4 text-center text-v2-small text-v2-text-3">{t("Hozircha onlayn kurs yo'q")}</p>
        </Card>
      )}
      {items.map((c) => {
        const all = lessonsOf(c);
        const pct = all.length ? Math.round((c.done.length / all.length) * 100) : 0;
        const mins = all.reduce((a, l) => a + (l.minutes || 0), 0);
        return (
          <section key={c.id} className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="relative flex h-24 items-end bg-v2-brand-bg px-4 pb-3">
              <span className="text-v2-caption font-semibold uppercase tracking-wide text-v2-brand">{c.category || t("Kurs")}</span>
              <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-v2-surface text-v2-brand shadow-v2-sm">{c.open ? <Play className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}</span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-0.5 text-v2-caption font-semibold ${c.free ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning"}`}>{c.free ? t("Bepul · ochiq") : t("Pullik")}</span>
                <span className="text-v2-small text-v2-text-2">{t("{n} dars", { n: all.length })}</span>
              </div>
              <h4 className="mt-1.5 font-semibold text-v2-text">{c.name}</h4>
              <div className="text-v2-small text-v2-text-2">{[c.teacher, t("{n} modul", { n: c.modules.length }), mins ? t("{n} daq", { n: mins }) : ""].filter(Boolean).join(" · ")}</div>
              {c.open ? (
                <>
                  <div className="mt-2 flex justify-between text-v2-small">
                    <span className="text-v2-text-2">{t("{a} / {b} dars", { a: c.done.length, b: all.length })}</span>
                    <span className="font-semibold text-v2-text">{pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
                    <div className="h-full rounded-full bg-v2-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <button type="button" disabled={!all.length} onClick={() => setPlay({ course: c.id, lesson: nextLesson(c)!.id })} className={`${primaryBtn} mt-3 h-11 w-full justify-center disabled:opacity-50`}>
                    <PlayCircle className="size-4" aria-hidden /> {c.done.length ? t("Davom etish") : t("Boshlash")}
                  </button>
                </>
              ) : (
                <>
                  <div className="mt-2 text-[18px] font-semibold text-v2-text">{t("{s} so'm", { s: fmtSom(c.price) })}</div>
                  <p className="text-v2-small text-v2-text-2">{t("Markaz kassasida to'lanadi — to'lagach markaz kursni ochib beradi.")}</p>
                </>
              )}
              {c.audience && (
                <p className="mt-2 flex gap-1.5 text-v2-small text-v2-text-2">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {c.audience}
                </p>
              )}
            </div>
          </section>
        );
      })}
      <p className="flex gap-2 px-1 text-v2-caption text-v2-text-3">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("Videolar faqat kabinetda ko'riladi. Modul testlari tez orada.")}
      </p>
    </div>
  );
}

function CoursePlayer({ course, lessonId, onPick, onBack, onDone }: { course: Course; lessonId: string; onPick: (id: string) => void; onBack: () => void; onDone: (id: string) => Promise<void> }) {
  const { t } = useT();
  const all = course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, module: m })));
  const i = Math.max(0, all.findIndex((l) => l.id === lessonId));
  const cur = all[i];
  const next = all[i + 1];
  const prev = all[i - 1];
  const fmtLen = (l: { minutes: number; seconds: number }) => `${l.minutes || 0}:${String(l.seconds || 0).padStart(2, "0")}`;
  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="-ml-1 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-text-2">
        <ArrowLeft className="size-4" aria-hidden /> {course.name}
      </button>
      {cur ? (
        <>
          <div className="overflow-hidden rounded-v2-lg bg-black">
            <video key={cur.id} src={cur.video} controls controlsList="nodownload" playsInline className="aspect-video w-full" onEnded={() => void onDone(cur.id)} onContextMenu={(e) => e.preventDefault()} />
          </div>
          <div className="text-v2-small text-v2-text-2">
            {cur.module.name} · {fmtLen(cur)}
          </div>
          <h2 className="text-[18px] font-semibold text-v2-text">{cur.title}</h2>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!prev} onClick={() => prev && onPick(prev.id)} className={`${secondaryBtn} h-11 justify-center disabled:opacity-40`}>
              <ArrowLeft className="size-4" aria-hidden /> {t("Oldingi")}
            </button>
            <button
              type="button"
              onClick={async () => {
                await onDone(cur.id);
                if (next) onPick(next.id);
              }}
              className={`${primaryBtn} h-11 justify-center`}
            >
              {next ? (
                <>
                  <ArrowRight className="size-4" aria-hidden /> {t("Keyingi")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" aria-hidden /> {t("Tugatdim")}
                </>
              )}
            </button>
          </div>
        </>
      ) : (
        <p className="text-v2-small text-v2-text-3">{t("Video hali yuklanmagan")}</p>
      )}
      <h3 className="px-1 pt-2 text-v2-small font-semibold text-v2-text-2">{t("Kurs tarkibi · {a} / {b} dars", { a: course.done.length, b: all.length })}</h3>
      <Card className="!p-2">
        {course.modules.map((m) => {
          const doneAll = m.lessons.length > 0 && m.lessons.every((l) => course.done.includes(l.id));
          return (
            <div key={m.id} className="py-1">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className={`flex size-6 items-center justify-center rounded-v2-sm ${doneAll ? "bg-v2-success-bg text-v2-success" : "bg-v2-surface-2 text-v2-text-2"}`}>{doneAll ? <CheckCircle2 className="size-3.5" aria-hidden /> : <FileText className="size-3.5" aria-hidden />}</span>
                <span className="min-w-0 flex-1 text-v2-small font-semibold text-v2-text">{m.name}</span>
              </div>
              {m.lessons.map((l) => {
                const on = l.id === cur?.id;
                const done = course.done.includes(l.id);
                return (
                  <button key={l.id} type="button" onClick={() => onPick(l.id)} className={`ml-4 flex w-[calc(100%-1rem)] items-center gap-2 rounded-v2-md px-2 py-2 text-left text-v2-small ${on ? "bg-v2-brand-bg" : "hover:bg-v2-surface-2"}`}>
                    {done ? <CheckCircle2 className="size-4 shrink-0 text-v2-success" aria-hidden /> : on ? <PlayCircle className="size-4 shrink-0 text-v2-brand" aria-hidden /> : <Circle className="size-4 shrink-0 text-v2-text-3" aria-hidden />}
                    <span className={`min-w-0 flex-1 ${on ? "font-semibold text-v2-text" : "text-v2-text"}`}>{l.title}</span>
                    <span className="text-v2-caption tabular-nums text-v2-text-3">{fmtLen(l)}</span>
                  </button>
                );
              })}
              {m.testQuestions > 0 && (
                <div className="ml-4 flex items-center gap-2 px-2 py-2 text-v2-small text-v2-text-3">
                  <Circle className="size-4 shrink-0" aria-hidden /> {t("Test · {n} savol", { n: m.testQuestions })}
                  <span className="ml-auto rounded-v2-sm bg-v2-info-bg px-1.5 text-v2-caption font-semibold text-v2-info">{t("Tez orada")}</span>
                </div>
              )}
            </div>
          );
        })}
      </Card>
      <p className="flex gap-2 px-1 text-v2-caption text-v2-text-3">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("Video faqat kabinetda ko'riladi — yuklab olinmaydi.")}
      </p>
    </div>
  );
}
