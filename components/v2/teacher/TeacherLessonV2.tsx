"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CircleCheck, Eye, Info, Loader2, Lock, Minus, Pencil, Plus, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { gamApi } from "@/components/gamification/api";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { fieldCls } from "@/components/v2/form/fields";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import ReasonDialogV2 from "@/components/v2/gamification/ReasonDialogV2";
import type { LessonRowV2, LessonViewV2 } from "@/components/v2/gamification/lessonTypes";
import { postMark } from "@/components/v2/groups/detail/attendanceApi";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import type { AttendanceStatus } from "@/lib/attendance";
import { Card, StepBox, teacherLink, teacherPost, teacherQs, type StepState } from "./teacherBits";

// YANGI VERSIYA — O'QITUVCHI · DARS OYNASI (45-qism, rasmlar «dars oynasi: davomat, mavzu, vazifa, tanga», «dars oxirida»,
// telefonda 1–4 qadam). Bir sahifada: «Davomat va tanga» (har o'quvchi — Keldi / Kechikdi / Kelmadi / Sababli, faollik
// −/+, bugungi jami, «±» sabab bo'yicha), «Mavzu» (erkin matn + izoh; oldingi mavzular), «Uy vazifasi» (rahbar sozlamasi
// yoqilgan bo'lsa — avval o'tgan vazifani baholash), «Darsni yakunlash».
// Davomat — POST /api/groups/:id/attendance (guruh sahifasi bilan bir xil), tanga — gamifikatsiya API'lari,
// mavzu / vazifa / yakun — /api/teacher (lib/teacherDesk.ts). Tekshirilgan ish tangasi — davomatdan keyin o'zi yoziladi.

interface Desk {
  ok: true;
  who: { name: string; preview: boolean };
  today: string;
  now: string;
  group: { id: number; title: string; course: string; level: string; room: string; start: string; end: string };
  lessonNo: number;
  pupils: { pupilId: number; name: string; check: { done: boolean; score: number | null; coin: number | null; note: string } | null }[];
  topic: { topic: string; note: string; at: string } | null;
  recentTopics: { date: string; topic: string }[];
  closed: string | null;
  homework: { id: number; name: string; note: string; deadline: string; maxScore: number; at: string } | null;
  prevTask: { id: number; name: string; maxScore: number; checked: number; unchecked: string[] } | null;
  requireCheck: boolean;
  nextLesson: string | null;
}

const ATT: { k: AttendanceStatus; label: string; on: string }[] = [
  { k: "keldi", label: "Keldi", on: "border-v2-success bg-v2-success-bg text-v2-success" },
  { k: "kechikdi", label: "Kechikdi", on: "border-v2-warning bg-v2-warning-bg text-v2-warning" },
  { k: "sababsiz", label: "Kelmadi", on: "border-v2-danger bg-v2-danger-bg text-v2-danger" },
  { k: "sababli", label: "Sababli", on: "border-v2-border-strong bg-v2-surface text-v2-text" },
];
const attOf = (a: LessonRowV2["att"]): AttendanceStatus | null => (a === "kelmadi" ? "sababsiz" : a);
const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export default function TeacherLessonV2({ groupId, teacher }: { groupId: number; teacher?: string }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showError, showSuccess } = useToast();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [view, setView] = useState<LessonViewV2 | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<number | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const applying = useRef(false);

  const fetchBoth = useCallback(
    () =>
      Promise.all([
        fetch(`/api/teacher?view=lesson&groupId=${groupId}${teacherQs(teacher)}`, { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => null),
        gamApi<LessonViewV2>(`/api/gamification/lesson?groupId=${groupId}`),
      ]),
    [groupId, teacher],
  );
  const apply = useCallback(
    ([d, v]: Awaited<ReturnType<typeof fetchBoth>>) => {
      if (d?.ok) setDesk(d as Desk);
      else setErr(String(d?.error ?? t("Dars topilmadi")));
      if (v.ok) setView(v);
    },
    [t],
  );
  const load = useCallback(() => fetchBoth().then(apply), [fetchBoth, apply]);

  useEffect(() => {
    let off = false;
    fetchBoth().then((x) => {
      if (!off) apply(x);
    });
    return () => {
      off = true;
    };
  }, [fetchBoth, apply]);

  // Tekshirilgan ish tangasi: o'quvchi bugun darsda bo'lsa va tanga hali yozilmagan bo'lsa — o'zi yoziladi.
  useEffect(() => {
    if (!desk || !view || !desk.prevTask || applying.current) return;
    const todo = desk.pupils.filter((p) => {
      const row = view.rows.find((r) => r.pupilId === p.pupilId);
      return p.check && p.check.coin === null && row && (row.att === "keldi" || row.att === "kechikdi") && !row.homework;
    });
    if (!todo.length) return;
    applying.current = true;
    void (async () => {
      for (const p of todo) await teacherPost({ action: "check-coin", taskId: desk.prevTask!.id, pupilId: p.pupilId }, teacher);
      await load();
      applying.current = false;
    })();
  }, [desk, view, teacher, load]);

  if (err)
    return (
      <div data-ui="v2" className="p-4">
        <NoticeBar>{err}</NoticeBar>
      </div>
    );
  if (!desk)
    return (
      <div data-ui="v2" className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );

  const rows = view?.rows ?? [];
  const now = desk.now;
  const marked = rows.filter((r) => r.att);
  const came = marked.filter((r) => r.att === "keldi" || r.att === "kechikdi").length;
  const missed = marked.filter((r) => r.att === "kelmadi").length;
  const excused = marked.filter((r) => r.att === "sababli").length;
  const attDone = marked.length > 0 && marked.length === rows.length;
  const activityUsed = view?.activityUsed ?? 0;
  const activityLimit = view?.settings.activityGroupLimitPerLesson ?? 0;
  const givenToday = rows.reduce((a, r) => a + Math.max(0, r.today), 0);
  const takenToday = rows.reduce((a, r) => a + Math.min(0, r.today), 0);
  const hwLocked = desk.requireCheck && !!desk.prevTask && desk.prevTask.unchecked.length > 0 && !desk.homework;
  const minsLeft = desk.group.end ? toMin(desk.group.end) - toMin(now) : null;
  const L = (p: string) => teacherLink(p, teacher);

  const mark = async (r: LessonRowV2, status: AttendanceStatus) => {
    setBusy(`att:${r.pupilId}`);
    const res = await postMark(groupId, { pupilId: r.pupilId, date: desk.today, status, grade: null, reason: null, note: null });
    setBusy(null);
    if (!res.ok) showError(res.error);
    await load();
  };
  const markRest = async () => {
    setBusy("att:all");
    for (const r of rows.filter((x) => !x.att)) {
      const res = await postMark(groupId, { pupilId: r.pupilId, date: desk.today, status: "keldi", grade: null, reason: null, note: null });
      if (!res.ok) {
        showError(res.error);
        break;
      }
    }
    setBusy(null);
    await load();
  };
  const activity = async (r: LessonRowV2, dir: 1 | -1) => {
    setBusy(`act:${r.pupilId}`);
    if (dir > 0) {
      const res = await gamApi("/api/gamification/activity", { method: "POST", body: { groupId, pupilId: r.pupilId, coins: 1 } });
      if (!res.ok) showError(res.error);
    } else {
      const last = [...r.txs].reverse().find((x) => x.type === "activity" && x.canUndo);
      if (last) {
        const res = await gamApi(`/api/gamification/transactions/${last.id}/undo`, { method: "POST", body: {} });
        if (!res.ok) showError(res.error);
      }
    }
    setBusy(null);
    await load();
  };
  const finish = async () => {
    const r = await teacherPost({ action: "finish", groupId }, teacher);
    if (!r.ok) showError(r.error);
    else showSuccess(t("Dars yakunlandi"));
    await load();
  };

  const steps: { n: 1 | 2 | 3 | 4; title: string; sub: string; state: StepState }[] = [
    { n: 1, title: t("Davomat"), sub: marked.length ? t("{a} keldi · {b} kelmadi · {c} sababli", { a: came, b: missed, c: excused }) : t("belgilanmagan"), state: attDone ? "done" : "todo" },
    { n: 2, title: t("Mavzu"), sub: desk.topic ? `${desk.topic.topic} · ${desk.topic.at}` : t("yozilmagan"), state: desk.topic ? "done" : "todo" },
    {
      n: 3,
      title: t("Uy vazifasi"),
      sub: desk.homework ? t("{name} berildi", { name: desk.homework.name }) : hwLocked ? t("avval {n} ta ishni baholang", { n: desk.prevTask!.unchecked.length }) : t("ixtiyoriy"),
      state: desk.homework ? "done" : hwLocked ? "locked" : "todo",
    },
    { n: 4, title: t("Tanga"), sub: t("faollik {a} / {b}", { a: activityUsed, b: activityLimit }) + (desk.closed ? "" : ` · ${t("dars oxirida")}`), state: desk.closed ? "done" : "todo" },
  ];

  const prevCheckOf = (pupilId: number) => desk.pupils.find((p) => p.pupilId === pupilId)?.check ?? null;

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-bg p-4 font-v2 text-v2-text sm:p-6">
      {desk.who.preview ? <NoticeBar icon={Eye}>{t("Rahbar ko'rinishi: {name} darsi", { name: desk.who.name })}</NoticeBar> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-v2-small text-v2-text-3">
            <Link href={L("/teacher-groups")} className="hover:underline">
              {t("Guruhlarim")}
            </Link>{" "}
            › {desk.group.title}
          </div>
          <h1 className="text-v2-page text-v2-text">{t("Dars · {date}, {wd}", { date: fmt.dayMonth(desk.today), wd: fmt.weekday(desk.today) })}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {[desk.group.title, `${desk.group.start}–${desk.group.end}`, desk.group.room ? `${desk.group.room}-xona` : null, t("{n}-dars", { n: desk.lessonNo })].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {desk.closed ? (
            <span className="rounded-v2-sm bg-v2-success-bg px-2.5 py-1 text-v2-caption font-medium text-v2-success">{t("Yakunlandi · {time}", { time: desk.closed })}</span>
          ) : minsLeft !== null && minsLeft > 0 && minsLeft <= 10 ? (
            <span className="rounded-v2-sm bg-v2-brand-bg px-2.5 py-1 text-v2-caption font-medium text-v2-brand-text">{t("Dars tugashiga {n} daqiqa · {time}", { n: minsLeft, time: now })}</span>
          ) : (
            <span className="rounded-v2-sm bg-v2-brand-bg px-2.5 py-1 text-v2-caption font-medium text-v2-brand-text">{t("Davom etmoqda · {time}", { time: now })}</span>
          )}
          {!desk.closed ? (
            <button type="button" onClick={() => setConfirmEnd(true)} className={minsLeft !== null && minsLeft <= 10 ? primaryBtn : secondaryBtn}>
              <Check className="size-4" strokeWidth={2} aria-hidden />
              {t("Darsni yakunlash")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {steps.map((s) => (
          <StepBox key={s.n} n={s.n} title={s.title} sub={s.sub} state={s.state} active={step === s.n} onClick={() => setStep(s.n)} />
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        {/* Davomat va tanga — kengda doim, telefonda 1 va 4-qadamda. */}
        <Card className={`min-w-0 !p-0 sm:!p-0 ${step === 1 || step === 4 ? "" : "max-lg:hidden"}`}>
          <div className="flex flex-wrap items-start justify-between gap-2 p-4 sm:p-5">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-v2-section text-v2-text">
                {attDone ? <CircleCheck className="size-5 text-v2-success" strokeWidth={2} aria-hidden /> : null}
                {t("Davomat va tanga")}
              </h2>
              <p className="text-v2-small text-v2-text-3">{t("Hammaga «Keldi» turadi — faqat kelmagan yoki kechikkanni belgilang. Davomat va vazifa tangasi o'zi yoziladi")}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-v2-sm bg-v2-success-bg px-2 py-0.5 text-v2-caption text-v2-success">{t("{n} keldi", { n: came })}</span>
              <span className="rounded-v2-sm bg-v2-danger-bg px-2 py-0.5 text-v2-caption text-v2-danger">{t("{n} kelmadi", { n: missed })}</span>
              <span className="rounded-v2-sm bg-v2-surface-2 px-2 py-0.5 text-v2-caption text-v2-text-2">{t("{n} sababli", { n: excused })}</span>
            </div>
          </div>
          {rows.some((r) => !r.att) ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-v2-border bg-v2-warning-bg px-4 py-2.5 text-v2-small sm:px-5">
              <span>{t("{n} o'quvchining davomati saqlanmagan", { n: rows.filter((r) => !r.att).length })}</span>
              <button type="button" disabled={busy !== null} onClick={() => void markRest()} className={primaryBtn}>
                {busy === "att:all" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
                {t("Qolganlarni «Keldi» deb saqlash")}
              </button>
            </div>
          ) : null}
          <div className="hidden grid-cols-[minmax(0,1.3fr)_17rem_8.5rem_3.5rem_2.5rem] items-center gap-3 border-t border-v2-border bg-v2-surface-2 px-5 py-2 text-v2-caption text-v2-text-3 lg:grid">
            <span>{desk.prevTask ? t("O'quvchi · uy vazifasi ({name})", { name: desk.prevTask.name }) : t("O'quvchi")}</span>
            <span>{t("Davomat")}</span>
            <span>{t("Faollik · {a} / {b}", { a: activityUsed, b: activityLimit })}</span>
            <span>{t("Bugun")}</span>
            <span />
          </div>
          <ul>
            {rows.map((r) => {
              const cur = attOf(r.att);
              const absent = r.att === "kelmadi" || r.att === "sababli";
              const ch = prevCheckOf(r.pupilId);
              const hwText = ch
                ? ch.done
                  ? `${t("Vazifa")} ✓ ${ch.score ?? ""}${desk.prevTask?.maxScore ? ` / ${desk.prevTask.maxScore}` : ""}${r.homework ? ` · +${r.homework.amount}` : ""}`
                  : `${t("Vazifa")} × ${r.homework ? r.homework.amount : ""}${ch.note ? ` · ${ch.note}` : ""}`
                : desk.prevTask
                  ? t("Vazifa tekshirilmagan")
                  : "";
              const hwTone = ch ? (ch.done ? "text-v2-success" : "text-v2-danger") : "text-v2-warning";
              const actCanMinus = r.txs.some((x) => x.type === "activity" && x.canUndo);
              return (
                <li key={r.pupilId} className="grid grid-cols-1 items-center gap-2 border-t border-v2-border px-4 py-3 sm:px-5 lg:grid-cols-[minmax(0,1.3fr)_17rem_8.5rem_3.5rem_2.5rem] lg:gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-v2-info-bg text-v2-caption font-semibold text-v2-info">{initialsOf(r.name)}</span>
                    <div className="min-w-0">
                      <div className="truncate text-v2-body font-semibold text-v2-text">{r.name}</div>
                      {absent ? (
                        <div className="text-v2-caption text-v2-text-3">{r.att === "kelmadi" ? t("Kelmadi · sababsiz {n}", { n: r.attAmount }) : t("Sababli")}</div>
                      ) : hwText ? (
                        <div className={`text-v2-caption ${hwTone}`}>{hwText}</div>
                      ) : null}
                    </div>
                  </div>
                  <div role="radiogroup" aria-label={t("Davomat")} className="inline-flex w-fit rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
                    {ATT.map((a) => (
                      <button
                        key={a.k}
                        type="button"
                        role="radio"
                        aria-checked={cur === a.k}
                        disabled={busy !== null || !!desk.closed}
                        onClick={() => cur !== a.k && void mark(r, a.k)}
                        className={`h-8 rounded-[6px] border px-2.5 text-v2-small transition-colors disabled:opacity-60 ${cur === a.k ? a.on : "border-transparent text-v2-text-2 hover:text-v2-text"}`}
                      >
                        {t(a.label)}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 lg:contents">
                  {absent || !r.att ? (
                    <span className="text-v2-small text-v2-text-3">{absent ? t("darsda yo'q") : "—"}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label={t("Faollikni kamaytirish")} disabled={busy !== null || !actCanMinus} onClick={() => void activity(r, -1)} className="grid size-8 place-items-center rounded-v2-md border border-v2-border-strong text-v2-text-2 disabled:opacity-40">
                        <Minus className="size-4" strokeWidth={1.75} aria-hidden />
                      </button>
                      <span className="w-7 text-center text-v2-body font-semibold tabular-nums text-v2-text">{r.activity > 0 ? `+${r.activity}` : 0}</span>
                      <button type="button" aria-label={t("Faollik qo'shish")} disabled={busy !== null || activityUsed >= activityLimit} onClick={() => void activity(r, 1)} className="grid size-8 place-items-center rounded-v2-md border border-v2-border-strong text-v2-text-2 disabled:opacity-40">
                        <Plus className="size-4" strokeWidth={1.75} aria-hidden />
                      </button>
                    </div>
                  )}
                  <span className={`text-v2-body font-semibold tabular-nums ${r.today > 0 ? "text-v2-success" : r.today < 0 ? "text-v2-danger" : "text-v2-text-3"}`}>{r.today > 0 ? `+${r.today}` : r.today}</span>
                  {r.att ? (
                    <button type="button" aria-label={t("Sabab bo'yicha tanga")} onClick={() => setReasonFor(r.pupilId)} className="grid size-8 place-items-center rounded-v2-md border border-v2-border-strong text-v2-small font-semibold text-v2-text-2">
                      ±
                    </button>
                  ) : (
                    <span />
                  )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-v2-border bg-v2-surface-2 px-4 py-3 text-v2-small sm:px-5">
            <span className="text-v2-text-2">
              {t("Bugun guruhga:")} <b className="text-v2-success">+{givenToday}</b> {t("berildi")} · <b className="text-v2-danger">{takenToday}</b> {t("ayirildi")}
              {view ? (
                <span className="block text-v2-caption text-v2-text-3">
                  {t("Avtomatik: keldi +{a} · sababsiz −{b} · vazifa ✓ +{c}, × −{d} · faollik guruhga darsda {e} tagacha", {
                    a: rows.find((r) => r.att === "keldi")?.attAmount ?? 5,
                    b: view.settings.absencePenaltyCoins,
                    c: view.settings.homeworkDoneCoins,
                    d: view.settings.homeworkMissedPenalty,
                    e: activityLimit,
                  })}
                </span>
              ) : null}
            </span>
            <Link href={`/gamification-lesson?groupId=${groupId}`} className={secondaryBtn}>
              {t("Sabab bo'yicha tanga")}
            </Link>
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <div className={step === 2 ? "" : "max-lg:hidden"}>
            <TopicCard desk={desk} teacher={teacher} onSaved={load} />
          </div>
          <div className={step === 3 ? "" : "max-lg:hidden"}>
            <HomeworkCard desk={desk} teacher={teacher} locked={hwLocked} checkHref={L(`/teacher-check?taskId=${desk.prevTask?.id ?? ""}`)} onSaved={load} />
          </div>
        </div>
      </div>

      {reasonFor !== null && view?.group && rows.find((r) => r.pupilId === reasonFor) ? (
        <ReasonDialogV2
          row={rows.find((r) => r.pupilId === reasonFor)!}
          reasons={view.reasons}
          groupId={groupId}
          groupLabel={view.group.label}
          dailyLimit={view.settings.dailyDeductionLimit}
          onClose={() => setReasonFor(null)}
          onDone={() => {
            setReasonFor(null);
            void load();
          }}
        />
      ) : null}
      {confirmEnd ? (
        <V2Confirm
          title={t("Darsni yakunlaysizmi?")}
          body={[
            !attDone ? t("Davomat to'liq saqlanmagan.") : null,
            !desk.topic ? t("Mavzu yozilmagan.") : null,
            t("Yakunlangach dars «Yakunlandi» bo'ladi; davomat va tangani keyin ham tuzatish mumkin (gamifikatsiya qoidalari bo'yicha)."),
          ]
            .filter(Boolean)
            .join(" ")}
          confirmLabel={t("Yakunlash")}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={async () => {
            setConfirmEnd(false);
            await finish();
          }}
        />
      ) : null}
    </div>
  );
}

function TopicCard({ desk, teacher, onSaved }: { desk: Desk; teacher?: string; onSaved: () => Promise<void> }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showError } = useToast();
  const [topic, setTopic] = useState(desk.topic?.topic ?? "");
  const [note, setNote] = useState(desk.topic?.note ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = topic !== (desk.topic?.topic ?? "") || note !== (desk.topic?.note ?? "");
  const save = async () => {
    setSaving(true);
    const r = await teacherPost({ action: "topic", groupId: desk.group.id, topic, note }, teacher);
    setSaving(false);
    if (!r.ok) showError(r.error);
    else await onSaved();
  };
  return (
    <Card>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-v2-section text-v2-text">
          {desk.topic ? <CircleCheck className="size-5 text-v2-success" strokeWidth={2} aria-hidden /> : null}
          {t("Mavzu")}
        </h2>
        {desk.topic ? (
          <span className="inline-flex items-center gap-1 text-v2-caption text-v2-success">
            <Check className="size-3.5" strokeWidth={2} aria-hidden />
            {desk.topic.at}
          </span>
        ) : null}
      </div>
      <p className="mb-3 text-v2-small text-v2-text-3">{t("{n}-dars · o'tilgan mavzu jurnalga yoziladi", { n: desk.lessonNo })}</p>
      <label className="block">
        <span className="mb-1 block text-v2-small font-semibold text-v2-text">{t("Mavzu")}</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder={t("Masalan: Unit 6.1 — Present Perfect")} className={fieldCls()} />
      </label>
      {desk.recentTopics.length ? (
        <div className="mt-2 text-v2-caption text-v2-text-3">
          {t("Oldingi darslar:")}{" "}
          {desk.recentTopics.slice(0, 3).map((x, i) => (
            <span key={x.date}>
              {i ? " · " : ""}
              {fmt.dayMonth(x.date)} — {x.topic}
            </span>
          ))}
        </div>
      ) : null}
      <label className="mt-3 block">
        <span className="mb-1 block text-v2-small font-semibold text-v2-text">
          {t("Izoh")} <span className="font-normal text-v2-text-3">({t("ixtiyoriy")})</span>
        </span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder={t("Masalan: nima qiyin bo'ldi, nimani takrorlash kerak")} className={fieldCls(undefined, "h-auto py-2")} />
      </label>
      {dirty || !desk.topic ? (
        <button type="button" disabled={saving || !topic.trim()} onClick={() => void save()} className={`${primaryBtn} mt-3 w-full justify-center disabled:opacity-50`}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
          {t("Mavzuni saqlash")}
        </button>
      ) : null}
    </Card>
  );
}

function HomeworkCard({ desk, teacher, locked, checkHref, onSaved }: { desk: Desk; teacher?: string; locked: boolean; checkHref: string; onSaved: () => Promise<void> }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showError } = useToast();
  const hw = desk.homework;
  const defDeadline = desk.nextLesson ? `${desk.nextLesson}T${desk.group.start || "09:00"}` : "";
  const [edit, setEdit] = useState(!hw);
  const [name, setName] = useState(hw?.name ?? "");
  const [note, setNote] = useState(hw?.note ?? "");
  const [deadline, setDeadline] = useState(() => {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})(?: \| (\d{2}:\d{2}))?/.exec(hw?.deadline ?? "");
    return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? "09:00"}` : defDeadline;
  });
  const [max, setMax] = useState(String(hw?.maxScore ?? 10));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const r = await teacherPost({ action: "homework", groupId: desk.group.id, name, note, deadline, maxScore: Number(max) }, teacher);
    setSaving(false);
    if (!r.ok) showError(r.error);
    else {
      setEdit(false);
      await onSaved();
    }
  };
  return (
    <Card>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-v2-section text-v2-text">
          {hw ? <CircleCheck className="size-5 text-v2-success" strokeWidth={2} aria-hidden /> : locked ? <Lock className="size-5 text-v2-warning" strokeWidth={1.75} aria-hidden /> : null}
          {t("Uy vazifasi")}
        </h2>
        {locked ? <span className="rounded-v2-sm bg-v2-warning-bg px-2 py-0.5 text-v2-caption text-v2-warning">{t("To'xtatilgan")}</span> : hw ? <span className="text-v2-caption text-v2-success">✓ {hw.at.split("|")[1]?.trim()}</span> : null}
      </div>
      <p className="mb-3 text-v2-small text-v2-text-3">{t("ixtiyoriy · o'quvchi kabinetiga va botga boradi")}</p>

      {desk.prevTask && desk.prevTask.unchecked.length === 0 && desk.prevTask.checked > 0 ? (
        <p className="mb-3 flex items-start gap-2 rounded-v2-md bg-v2-success-bg px-3 py-2 text-v2-small text-v2-success">
          <CircleCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("{name}: {n} ta ish baholandi", { name: desk.prevTask.name, n: desk.prevTask.checked })}
        </p>
      ) : null}

      {locked ? (
        <>
          <div className="rounded-v2-md bg-v2-warning-bg p-4">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 size-5 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />
              <div className="min-w-0">
                <div className="text-v2-body font-semibold text-v2-text">{t("Avval o'tgan dars vazifasini baholang")}</div>
                <p className="text-v2-small text-v2-text-2">
                  {t("{name} · {n} ta ish kutmoqda: {who}", { name: desk.prevTask!.name, n: desk.prevTask!.unchecked.length, who: desk.prevTask!.unchecked.slice(0, 3).join(", ") })}
                </p>
                <Link href={checkHref} className={`${primaryBtn} mt-3`}>
                  <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
                  {t("Tekshirish · {n} ta ish", { n: desk.prevTask!.unchecked.length })}
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-2 text-v2-small text-v2-text-2">
            <Info className="mt-0.5 size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
            {t("Rahbar sozlamasi: «Yangi vazifadan oldin baholash» yoqilgan. Darsga kelmaganlar hisobga olinmaydi.")}
          </p>
        </>
      ) : hw && !edit ? (
        <div>
          <div className="text-v2-body font-semibold text-v2-text">{hw.name}</div>
          {hw.note ? <p className="mt-1 whitespace-pre-line text-v2-small text-v2-text-2">{hw.note}</p> : null}
          <p className="mt-2 text-v2-caption text-v2-text-3">{[hw.deadline ? t("Muddat: {d}", { d: hw.deadline }) : null, t("Maks. ball: {n}", { n: hw.maxScore })].filter(Boolean).join(" · ")}</p>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-v2-border pt-3">
            <span className="text-v2-caption text-v2-text-3">{t("Berildi {time} · o'quvchi kabinetiga ketdi", { time: hw.at.split("|")[1]?.trim() ?? "" })}</span>
            <button type="button" onClick={() => setEdit(true)} className={secondaryBtn}>
              <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Tahrirlash")}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-v2-small font-semibold text-v2-text">{t("Vazifa nomi")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder={t("Masalan: Unit 6 — Present Perfect")} className={fieldCls()} />
          </label>
          <label className="block">
            <span className="mb-1 block text-v2-small font-semibold text-v2-text">{t("Topshiriq")}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder={t("Masalan: Workbook 34–35-bet, 1–4-mashqlar")} className={fieldCls(undefined, "h-auto py-2")} />
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
            <label className="block">
              <span className="mb-1 block text-v2-small font-semibold text-v2-text">{t("Muddat")}</span>
              <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={fieldCls()} />
            </label>
            <label className="block">
              <span className="mb-1 block text-v2-small font-semibold text-v2-text">{t("Maks. ball")}</span>
              <input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, "").slice(0, 3))} className={fieldCls()} />
            </label>
          </div>
          {desk.nextLesson ? <p className="text-v2-caption text-v2-text-3">{t("Keyingi dars: {d}", { d: `${fmt.dayMonth(desk.nextLesson)} ${desk.group.start}` })}</p> : null}
          <div className="flex gap-2">
            <button type="button" disabled={saving || !name.trim()} onClick={() => void save()} className={`${primaryBtn} flex-1 justify-center disabled:opacity-50`}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
              {hw ? t("Saqlash") : t("Vazifa berish")}
            </button>
            {hw ? (
              <button type="button" onClick={() => setEdit(false)} className={secondaryBtn} aria-label={t("Bekor qilish")}>
                <X className="size-4" strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
          </div>
          <p className="text-v2-caption text-v2-text-3">{t("Fayl va havola biriktirish — tez orada")}</p>
        </div>
      )}
    </Card>
  );
}
