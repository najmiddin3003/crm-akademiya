"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CalendarClock, CalendarX2, Check, ChevronLeft, ChevronRight, Coins, Info, Loader2, Lock, Plus, UserPlus, Users } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { withReward } from "@/components/gamification/ui";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { fieldCls } from "@/components/v2/form/fields";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import { roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import { EmptyBlock, MarkIcon, ToneBadge, linkBtn, secondarySm, useProfileFmt } from "@/components/v2/students/profile/profileBits";
import type { AttendanceMark, AttendanceStatus } from "@/lib/attendance";
import type { Group } from "@/lib/groups";
import { postMark, upsertMark, type MarkBody } from "./attendanceApi";
import CoinPanel, { type CoinDone } from "./CoinPanel";
import {
  DAY_STATUSES,
  DAY_STATUS_UI,
  cameStatus,
  dayStatusOf,
  daysBetweenIso,
  defaultLesson,
  editDenial,
  isFrozenPupil,
  marksOfDate,
  memberName,
  neighbourLesson,
  signed,
  timeRangeMin,
  txLabel,
  uzMinuteOfDay,
  type DayStatus,
  type GamRow,
  type GamTx,
  type Member,
} from "./groupDetailBits";
import { useGamView, useMinuteNow, useMonthMarks } from "./useGroupDetail";

// YANGI VERSIYA — «BUGUNGI DARS» (rasmlar «Guruh · Bugungi dars, davomat» va «Guruh ·
// Tanga berish», yorug'/qorong'i, 24.10.2026; sarlavha: «hammasi «keldi», faqat
// kelmaganni bosish»):
//
//   • Dars tanlovi: ‹ Bugun, 12-oktyabr · dushanba › + holat (Belgilanmoqda / Belgilandi /
//     Rejada …) + o'ngda «Dars boshlanganiga 7 daqiqa». Oldingi/keyingi dars — guruh
//     kunlari bo'yicha (lib/attendance.ts → lessonDates).
//   • Belgilanmagan dars HAMMA «Keldi» bo'lib ochiladi (saqlanmagan qoralama) — faqat
//     kelmaganlar bosiladi, «Saqlash» bitta-bitta yozadi (POST /api/groups/:id/attendance,
//     eski jadval bilan bir xil: tarix, gamifikatsiya hodisasi, o'quvchilar boti).
//     Kechikdi / birinchi dars — «Keldi» bo'lib ko'rinadi va o'zgartirilmasa saqlanadi.
//   • Izoh — darsda yo'q o'quvchida (kelmadi, sababli). Holatni o'zgartirish cheklovi
//     (gamifikatsiya: ustoz — faqat dars kuni …) — groupDetailBits.editDenial; izohni
//     cheklovda ham yozish mumkin (server qoidasi).
//   • Tanga — faqat BUGUNGI darsda (gamifikatsiya qoidasi): yozuvlar chip bo'lib turadi
//     (bosilsa — «Ortga»), «+ Tanga» — ./CoinPanel.tsx. Davomati saqlanmagan o'quvchiga
//     tanga berishdan oldin uning belgisi saqlanadi (server «Avval davomatni saqlang»).

interface Draft {
  status: DayStatus;
  note: string;
}

interface RowModel {
  m: Member;
  name: string;
  mark: AttendanceMark | undefined;
  saved: Draft | null;
  eff: Draft | null;
  /** Saqlangandan farq qiladi (qoralama yoki o'zgartirilgan). */
  changed: boolean;
  /** Foydalanuvchi o'zi o'zgartirgan (qoralama emas). */
  touched: boolean;
  gam: GamRow | undefined;
}

const GRID = {
  full: "@min-[50rem]:grid-cols-[2rem_minmax(9rem,1.3fr)_auto_minmax(7.5rem,1fr)_minmax(10rem,1.3fr)_5rem]",
  balance: "@min-[50rem]:grid-cols-[2rem_minmax(9rem,1.3fr)_auto_minmax(9rem,1.4fr)_5rem]",
  none: "@min-[50rem]:grid-cols-[2rem_minmax(9rem,1.3fr)_auto_minmax(10rem,1.6fr)]",
} as const;

const ROW =
  "grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-4 py-3 @min-[50rem]:col-span-full @min-[50rem]:grid-cols-subgrid @min-[50rem]:gap-x-3 @min-[50rem]:gap-y-0 @min-[50rem]:py-1.5";
const WIDE = "[grid-column:2/-1] @min-[50rem]:[grid-column:auto]";
const navBtn =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-40";
const noteCls = fieldCls("default", "text-v2-small", "sm").replace("h-9 ", "h-8 ");

export default function TodayLessonTab({
  group,
  members,
  today,
  date,
  onDate,
  onDirtyChange,
  onAddStudent,
  onEditGroup,
}: {
  group: Group & { branchId?: number | null };
  members: Member[] | null;
  /** Toshkent kuni ("YYYY-MM-DD"). */
  today: string;
  /** Tanlangan dars kuni; guruhda dars kunlari bo'lmasa — null. */
  date: string | null;
  onDate: (iso: string) => void;
  /** Foydalanuvchi o'zgartirgan, saqlanmagan belgilar bor — tab almashishda so'raladi. */
  onDirtyChange: (dirty: boolean) => void;
  onAddStudent: () => void;
  onEditGroup: () => void;
}) {
  const { t, lang } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError, showToast } = useToast();
  const canProfile = useCanOpen("/students-list");
  const nowMs = useMinuteNow();

  const lessonIso = date ?? today;
  const { marks, patch } = useMonthMarks(group.id, lessonIso.slice(0, 7));
  const { view, reload: reloadView } = useGamView(group.id, "");

  const [edits, setEdits] = useState<{ date: string; map: Record<number, Draft> }>({ date: lessonIso, map: {} });
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const [preparing, setPreparing] = useState<number | null>(null);
  const [coinFor, setCoinFor] = useState<number | null>(null);
  const [undoFor, setUndoFor] = useState<{ tx: GamTx; name: string } | null>(null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const coinAnchor = useRef<HTMLElement | null>(null);

  const gam = view && view.enabled && view.group ? view : null;
  const coinsToday = !!gam && date === gam.today;
  const showBalance = !!gam;
  const editsMap = edits.date === lessonIso ? edits.map : {};
  const denial = date ? editDenial(view, date, today) : null;
  const future = !!date && date > today;
  const canDefault = !!date && !denial && !future;
  const ready = marks !== null && members !== null && view !== undefined;

  /* ── Qatorlar ── */
  const saved = marksOfDate(marks, lessonIso);
  const gamRows = new Map((gam?.rows ?? []).map((r) => [r.pupilId, r]));
  const rows: RowModel[] = (members ?? [])
    .filter((m) => saved.has(m.id) || (!isFrozenPupil(m.status) && (!m.joinedAt || m.joinedAt <= lessonIso)))
    .sort((a, b) => memberName(a).localeCompare(memberName(b), "uz"))
    .map((m) => {
      const mark = saved.get(m.id);
      const savedDraft: Draft | null = mark ? { status: dayStatusOf(mark.status) ?? "keldi", note: mark.note ?? "" } : null;
      const edit = editsMap[m.id];
      const eff = edit ?? savedDraft ?? (canDefault ? { status: "keldi" as const, note: "" } : null);
      const changed =
        !!eff && (!savedDraft || eff.status !== savedDraft.status || (eff.status !== "keldi" && eff.note.trim() !== savedDraft.note.trim()));
      return { m, name: memberName(m) || t("Nomsiz o'quvchi"), mark, saved: savedDraft, eff, changed, touched: !!edit && changed, gam: gamRows.get(m.id) };
    });

  const dirty = rows.some((r) => r.changed);
  const touched = rows.some((r) => r.touched);
  const allSaved = rows.length > 0 && rows.every((r) => r.mark);
  const anySaved = rows.some((r) => r.mark);
  const counts = { keldi: 0, sababsiz: 0, sababli: 0 } as Record<DayStatus, number>;
  for (const r of rows) if (r.eff) counts[r.eff.status] += 1;
  const coinSum = coinsToday ? rows.reduce((s, r) => s + (r.gam?.txs ?? []).reduce((a, x) => a + x.amount, 0), 0) : 0;
  const pending = rows.some((r) => !r.mark && r.eff);

  /* ── Tab almashishi / sahifadan chiqish ── */
  useEffect(() => {
    onDirtyChange(touched);
  }, [touched, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    if (!touched) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [touched]);

  if (!date) {
    return (
      <Shell>
        <EmptyBlock
          icon={<CalendarX2 className="size-5" strokeWidth={1.75} />}
          title={t("Dars kunlari belgilanmagan")}
          text={t("Guruhning dars kunlari va muddatini kiriting — shunda darslar shu yerda chiqadi.")}
          action={
            <button type="button" onClick={onEditGroup} className={secondarySm}>
              {t("Guruhni tahrirlash")}
            </button>
          }
        />
      </Shell>
    );
  }
  const lesson = date;

  /* ── Navigatsiya ── */
  const prev = neighbourLesson(group, lesson, -1);
  const next = neighbourLesson(group, lesson, 1);
  const home = defaultLesson(group, today);
  function go(iso: string | null) {
    if (!iso || iso === lesson) return;
    if (touched) {
      setLeaveTo(iso);
      return;
    }
    setEdits({ date: iso, map: {} });
    setCoinFor(null);
    onDate(iso);
  }

  /* ── Tahrir ── */
  function setDraft(r: RowModel, d: Draft) {
    setEdits((e) => ({ date: lesson, map: { ...(e.date === lesson ? e.map : {}), [r.m.id]: d } }));
  }
  function bodyOf(r: RowModel): MarkBody {
    const eff = r.eff as Draft;
    const prevMark = r.mark;
    // Kechikdi / birinchi dars «Keldi» bo'lib ko'rinadi — o'zgartirilmasa o'zi qoladi.
    const status: AttendanceStatus = eff.status === "keldi" && prevMark && cameStatus(prevMark.status) ? prevMark.status : eff.status;
    return {
      pupilId: r.m.id,
      date: lesson,
      status,
      grade: prevMark?.grade ?? null,
      reason: status === "sababli" && prevMark?.status === "sababli" ? (prevMark.reason ?? null) : null,
      note: status === "keldi" || status === "kechikdi" || status === "birinchi" ? null : eff.note.trim() || null,
    };
  }

  /** Bitta-bitta yozadi (tarix id'lari ketma-ket bo'lsin). Natija: muvaffaqiyatli va xato soni. */
  async function persist(list: RowModel[]): Promise<{ ok: number; failed: number; error: string }> {
    let ok = 0;
    let failed = 0;
    let error = "";
    setSaving({ done: 0, total: list.length });
    for (const r of list) {
      const res = await postMark(group.id, bodyOf(r));
      if (res.ok) {
        ok += 1;
        patch((ms) => upsertMark(ms, r.m.id, lesson, res.mark));
        setEdits((e) => {
          if (e.date !== lesson || !(r.m.id in e.map)) return e;
          const map = { ...e.map };
          delete map[r.m.id];
          return { date: lesson, map };
        });
      } else {
        failed += 1;
        error = res.error;
      }
      setSaving((s) => (s ? { ...s, done: s.done + 1 } : s));
    }
    setSaving(null);
    return { ok, failed, error };
  }

  async function saveAll() {
    const list = rows.filter((r) => r.changed && r.eff);
    if (!list.length || saving) return;
    const res = await persist(list);
    if (res.ok > 0 && coinsToday) await reloadView();
    if (res.failed > 0) showError(t("{n} ta o'quvchining davomati saqlanmadi: {error}", { n: res.failed, error: t(res.error) }));
    else showSuccess(t("Davomat saqlandi"));
  }

  async function openCoins(r: RowModel, el: HTMLElement) {
    if (preparing !== null || saving) return;
    if (coinFor === r.m.id) {
      setCoinFor(null);
      return;
    }
    coinAnchor.current = el;
    if (r.changed && r.eff) {
      setPreparing(r.m.id);
      const res = await persist([r]);
      if (res.failed > 0) {
        setPreparing(null);
        showError(t(res.error));
        return;
      }
      await reloadView();
      setPreparing(null);
    }
    setCoinFor(r.m.id);
  }

  const undoLabel = lang === "en" ? "Undo" : t("Ortga");
  async function undoTx(txId: number, name: string) {
    const res = await fetch(`/api/gamification/transactions/${txId}/undo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then((x) => x.json())
      .catch(() => null);
    await reloadView();
    if (!res?.ok) {
      showError(t(res?.error || "Bekor qilib bo'lmadi"));
      return;
    }
    showSuccess(t("{name}: tanga yozuvi qaytarildi", { name }));
  }

  function coinDone(r: RowModel, d: CoinDone) {
    setCoinFor(null);
    void reloadView();
    const v = Math.abs(d.amount);
    const msg =
      d.amount > 0
        ? t("{name}: +{v} · {reason}", { name: r.name, v, reason: d.label })
        : d.res.applied === d.res.amount
          ? t("{name}: −{v} · {reason}", { name: r.name, v, reason: d.label })
          : t("{name}: balans yetmadi — hamyondan {x} ayirildi (reytingda −{y})", { name: r.name, x: -d.res.applied, y: v });
    const txId = d.res.txId;
    showToast({
      tone: "success",
      title: withReward(t, msg, r.name, d.res),
      action: txId ? { label: undoLabel, onClick: () => void undoTx(txId, r.name) } : undefined,
    });
  }

  /* ── Sarlavha matnlari ── */
  const dm = fmt.dayMonth(lesson);
  const wd = fmt.weekday(lesson);
  const gap = daysBetweenIso(today, lesson);
  const title =
    gap === 0
      ? t("Bugun, {date} · {weekday}", { date: dm, weekday: wd })
      : gap === -1
        ? t("Kecha, {date} · {weekday}", { date: dm, weekday: wd })
        : gap === 1
          ? t("Ertaga, {date} · {weekday}", { date: dm, weekday: wd })
          : `${dm} · ${wd}`;
  const sub = [timeLabel(group.time), roomLabel(group.room), group.teacher.trim()].filter(Boolean).join(" · ");
  const dur = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return t("{h} soat {m} daqiqa", { h, m });
    if (h > 0) return t("{h} soat", { h });
    return t("{m} daqiqa", { m });
  };
  let rel = "";
  if (gap > 1) rel = t("{n} kundan keyin", { n: gap });
  else if (gap < -1) rel = t("{n} kun oldin", { n: -gap });
  else if (gap === 0 && nowMs !== null) {
    const range = timeRangeMin(group.time);
    if (range) {
      const now = uzMinuteOfDay(nowMs);
      if (now < range[0]) rel = t("Dars boshlanishiga {d}", { d: dur(range[0] - now) });
      else if (now < range[1]) rel = t("Dars boshlanganiga {d}", { d: dur(now - range[0]) });
      else rel = t("Dars tugagan");
    }
  }

  const tone = future
    ? { label: "Rejada", badge: "bg-v2-surface-2 text-v2-text-2", dot: "bg-v2-text-3" }
    : dirty
      ? { label: "Belgilanmoqda", badge: "bg-v2-warning-bg text-v2-warning", dot: "bg-v2-warning" }
      : allSaved
        ? { label: "Belgilandi", badge: "bg-v2-success-bg text-v2-success", dot: "bg-v2-success" }
        : anySaved
          ? { label: "Qisman belgilangan", badge: "bg-v2-warning-bg text-v2-warning", dot: "bg-v2-warning" }
          : { label: "Belgilanmagan", badge: "bg-v2-danger-bg text-v2-danger", dot: "bg-v2-danger" };

  const grid = coinsToday ? GRID.full : showBalance ? GRID.balance : GRID.none;
  const coinRow = coinFor !== null ? rows.find((r) => r.m.id === coinFor) : undefined;

  return (
    <Shell>
      {/* ── Dars tanlovi ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" className={navBtn} disabled={!prev} onClick={() => go(prev)} aria-label={t("Oldingi dars")} title={t("Oldingi dars")}>
              <ChevronLeft className="size-4" strokeWidth={2} />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-v2-body font-semibold text-v2-text">{title}</h2>
              {sub && <div className="truncate text-v2-caption text-v2-text-2">{sub}</div>}
            </div>
            <button type="button" className={navBtn} disabled={!next} onClick={() => go(next)} aria-label={t("Keyingi dars")} title={t("Keyingi dars")}>
              <ChevronRight className="size-4" strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {ready && rows.length > 0 && <ToneBadge tone={tone}>{t(tone.label)}</ToneBadge>}
            {home && home !== lesson && (
              <button type="button" onClick={() => go(home)} className={`${linkBtn} ml-1`}>
                {home === today ? t("Bugungi dars") : home < today ? t("Oxirgi dars") : t("Keyingi dars")}
              </button>
            )}
          </div>
        </div>
        {rel && <div className="text-v2-small text-v2-text-2">{rel}</div>}
      </div>

      {/* ── Izoh qatori ── */}
      {ready && rows.length > 0 && (future || denial || pending) && (
        <div
          role="note"
          className={`flex items-start gap-2 rounded-v2-md px-3 py-2.5 text-v2-small text-v2-text ${future || !denial ? "bg-v2-info-bg" : "bg-v2-warning-bg"}`}
        >
          {future ? (
            <CalendarClock className="mt-px size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
          ) : denial ? (
            <Lock className="mt-px size-4 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />
          ) : (
            <Info className="mt-px size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
          )}
          <span>
            {denial
              ? t(denial)
              : coinsToday
                ? t("Hamma «keldi» deb ochildi — faqat kelmaganlarni bosing. Tanga shu yerning o'zida beriladi.")
                : t("Hamma «keldi» deb ochildi — faqat kelmaganlarni bosing.")}
            {denial && !future && rows.some((r) => r.saved && r.saved.status !== "keldi") && ` ${t("Izohni yozish mumkin.")}`}
          </span>
        </div>
      )}

      {/* ── Jadval ── */}
      <div className="@container overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        {!ready ? (
          <RowsSkeleton />
        ) : rows.length === 0 ? (
          (members ?? []).length === 0 ? (
            <EmptyBlock
              icon={<Users className="size-5" strokeWidth={1.75} />}
              title={t("Guruhda hali o'quvchi yo'q")}
              text={t("O'quvchi qo'shing — davomat va tangalar shu yerda belgilanadi.")}
              action={
                <button type="button" onClick={onAddStudent} className={secondarySm}>
                  <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
                  {t("O'quvchi qo'shish")}
                </button>
              }
            />
          ) : (
            <EmptyBlock
              icon={<Users className="size-5" strokeWidth={1.75} />}
              title={t("Bu darsda o'quvchi yo'q")}
              text={t("Guruh o'quvchilari bu kundan keyin qo'shilgan yoki muzlatilgan.")}
            />
          )
        ) : (
          <div role="table" aria-label={t("Bugungi dars davomati")} className={`grid grid-cols-1 ${grid}`}>
            <div
              role="row"
              className={`${ROW} hidden! whitespace-nowrap border-b border-v2-border bg-v2-surface-2 py-2! text-v2-caption font-medium text-v2-text-2 @min-[50rem]:grid!`}
            >
              <span role="columnheader">№</span>
              <span role="columnheader">{t("O'quvchi")}</span>
              <span role="columnheader">{t("Davomat")}</span>
              <span role="columnheader">{t("Izoh")}</span>
              {coinsToday && <span role="columnheader">{t("Bugungi tanga")}</span>}
              {showBalance && (
                <span role="columnheader" className="text-right">
                  {t("Tanga jami")}
                </span>
              )}
            </div>
            {rows.map((r, i) => {
              const absent = !!r.eff && r.eff.status !== "keldi";
              const noteEditable = absent && !future && (!denial || (!!r.saved && r.saved.status === r.eff?.status));
              const late = r.mark && (r.mark.status === "kechikdi" || r.mark.status === "birinchi") && r.eff?.status === "keldi";
              const busy = !!saving || preparing === r.m.id;
              const coinBlock = !r.gam
                ? null
                : !r.eff
                  ? t("Avval davomatni belgilang")
                  : r.changed && denial
                    ? t("Avval davomatni saqlang")
                    : null;
              return (
                <div key={r.m.id} role="row" className={`${ROW} border-b border-v2-border last:border-b-0`}>
                  <span role="cell" className="text-v2-small tabular-nums text-v2-text-3">
                    {i + 1}
                  </span>
                  <span role="cell" className={`flex min-w-0 items-center gap-2 ${showBalance ? "" : "[grid-column:2/-1] @min-[50rem]:[grid-column:auto]"}`}>
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[10px] font-semibold text-v2-text-2" aria-hidden>
                      {initialsOf(r.name)}
                    </span>
                    {canProfile ? (
                      <Link href={`/student-edit/${r.m.id}?src=list`} className="truncate text-v2-small font-semibold text-v2-text underline-offset-2 hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      <span className="truncate text-v2-small font-semibold text-v2-text">{r.name}</span>
                    )}
                    {late && (
                      <span className="shrink-0 rounded-v2-full bg-v2-warning-bg px-1.5 py-px text-[11px] font-medium text-v2-warning">
                        {r.mark?.status === "kechikdi" ? t("kechikdi") : t("birinchi dars")}
                      </span>
                    )}
                  </span>
                  <span role="cell" className={WIDE}>
                    <DaySeg
                      value={r.eff?.status ?? null}
                      disabled={!!denial || future || busy}
                      label={t("{name} davomati", { name: r.name })}
                      title={denial ? t(denial) : undefined}
                      onChange={(s) => setDraft(r, { status: s, note: s === "keldi" ? "" : (r.eff?.note ?? r.saved?.note ?? "") })}
                    />
                  </span>
                  <span role="cell" className={`${WIDE} ${absent ? "" : "hidden @min-[50rem]:block"}`}>
                    {absent &&
                      (noteEditable ? (
                        <input
                          value={r.eff?.note ?? ""}
                          onChange={(e) => r.eff && setDraft(r, { status: r.eff.status, note: e.target.value })}
                          disabled={busy}
                          maxLength={500}
                          placeholder={t("Izoh (ixtiyoriy)")}
                          aria-label={t("{name} — izoh", { name: r.name })}
                          className={noteCls}
                        />
                      ) : (
                        <span className="block truncate text-v2-small text-v2-text-2">{r.eff?.note || "—"}</span>
                      ))}
                  </span>
                  {coinsToday && (
                    <span role="cell" className={`${WIDE} flex flex-wrap items-center gap-1.5`}>
                      {(r.gam?.txs ?? []).map((x) => (
                        <TxChip key={x.id} tx={x} label={t(txLabel(x))} onUndo={x.canUndo ? () => setUndoFor({ tx: x, name: r.name }) : undefined} />
                      ))}
                      {r.gam && (
                        <button
                          type="button"
                          onClick={(e) => void openCoins(r, e.currentTarget)}
                          disabled={!!coinBlock || busy}
                          title={coinBlock ?? undefined}
                          aria-expanded={coinFor === r.m.id}
                          aria-haspopup="dialog"
                          className={`inline-flex h-6 items-center gap-1 rounded-v2-full border bg-v2-surface px-2 text-v2-caption font-medium text-v2-text transition-[background-color,border-color,box-shadow] hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-50 ${
                            coinFor === r.m.id ? "border-v2-brand shadow-v2-focus" : "border-v2-border-strong"
                          }`}
                        >
                          {preparing === r.m.id ? <Loader2 className="size-3 animate-spin" strokeWidth={2} aria-hidden /> : <Plus className="size-3" strokeWidth={2.25} aria-hidden />}
                          {t("Tanga")}
                        </button>
                      )}
                    </span>
                  )}
                  {showBalance && (
                    <span
                      role="cell"
                      className="inline-flex items-center justify-end gap-1 text-v2-small font-semibold tabular-nums text-v2-text [grid-column:3] [grid-row:1] @min-[50rem]:[grid-column:auto] @min-[50rem]:[grid-row:auto]"
                      title={t("Tanga jami")}
                    >
                      <Coins className="size-3.5 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                      {r.gam ? r.gam.balance : "—"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pastki qator ── */}
        {ready && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-v2-border px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-v2-small text-v2-text-2">
              <Count status="keldi" n={counts.keldi} label={t("keldi")} />
              <Count status="sababsiz" n={counts.sababsiz} label={t("kelmadi")} />
              <Count status="sababli" n={counts.sababli} label={t("sababli")} />
              {coinsToday && (
                <span className="inline-flex items-center gap-1.5 border-l border-v2-border pl-4">
                  <Coins className="size-4 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                  <b className="font-semibold tabular-nums text-v2-text">{signed(coinSum)}</b>
                  {t("tanga berildi")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {saving ? (
                <span className="inline-flex items-center gap-1.5 text-v2-small text-v2-text-2" aria-live="polite">
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />
                  {t("Saqlanmoqda… {done}/{total}", { done: saving.done, total: saving.total })}
                </span>
              ) : dirty ? (
                <span className="text-v2-small text-v2-text-2">{touched ? t("Saqlanmagan o'zgarishlar") : t("Davomat hali saqlanmagan")}</span>
              ) : (
                allSaved && (
                  <span className="inline-flex items-center gap-1 text-v2-small text-v2-text-2">
                    <Check className="size-4 text-v2-success" strokeWidth={2.25} aria-hidden />
                    {t("Saqlangan")}
                  </span>
                )
              )}
              {touched && (
                <button type="button" disabled={!!saving} onClick={() => setEdits({ date: lesson, map: {} })} className={secondarySm}>
                  {t("Bekor qilish")}
                </button>
              )}
              {(dirty || saving) && (
                <button
                  type="button"
                  disabled={!!saving}
                  onClick={() => void saveAll()}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-md bg-v2-brand px-3 text-v2-small font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="size-4" strokeWidth={2.25} aria-hidden />
                  {t("Saqlash")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Oynalar ── */}
      {coinRow && gam && (
        <CoinPanel
          anchorRef={coinAnchor}
          view={gam}
          row={coinRow.gam ?? null}
          name={coinRow.name}
          groupId={group.id}
          absent={!!coinRow.eff && coinRow.eff.status !== "keldi"}
          onClose={() => setCoinFor(null)}
          onDone={(d) => coinDone(coinRow, d)}
          onError={(msg) => showError(msg)}
        />
      )}
      {undoFor && (
        <V2Confirm
          title={t("Tanga yozuvini qaytarish")}
          body={t("{name}: {amount} · {reason} bekor qilinadi («Xato bosildi — qaytarildi»).", {
            name: undoFor.name,
            amount: signed(undoFor.tx.amount),
            reason: t(txLabel(undoFor.tx)),
          })}
          confirmLabel={t("Yozuvni qaytarish")}
          onCancel={() => setUndoFor(null)}
          onConfirm={() => {
            const u = undoFor;
            setUndoFor(null);
            void undoTx(u.tx.id, u.name);
          }}
        />
      )}
      {leaveTo && (
        <V2Confirm
          title={t("Saqlanmagan o'zgarishlar")}
          body={t("Belgilangan davomat saqlanmagan. Boshqa darsga o'tilsa, o'zgarishlar yo'qoladi.")}
          confirmLabel={t("Saqlamasdan o'tish")}
          onCancel={() => setLeaveTo(null)}
          onConfirm={() => {
            const iso = leaveTo;
            setLeaveTo(null);
            setEdits({ date: iso, map: {} });
            setCoinFor(null);
            onDate(iso);
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

/* ── Uch holat: Keldi | Kelmadi | Sababli ─────────────────────────── */

function DaySeg({
  value,
  onChange,
  disabled,
  label,
  title,
}: {
  value: DayStatus | null;
  onChange: (s: DayStatus) => void;
  disabled: boolean;
  label: string;
  title?: string;
}) {
  const { t } = useT();
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const at = Math.max(0, DAY_STATUSES.indexOf(value ?? "keldi"));
    const nextS = DAY_STATUSES[(at + (e.key === "ArrowRight" ? 1 : DAY_STATUSES.length - 1)) % DAY_STATUSES.length];
    onChange(nextS);
    const box = e.currentTarget.parentElement;
    requestAnimationFrame(() => box?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      title={title}
      className="flex w-full items-center gap-0.5 rounded-v2-md border border-v2-border bg-v2-surface p-0.5 @min-[50rem]:inline-flex @min-[50rem]:w-auto"
    >
      {DAY_STATUSES.map((s, i) => {
        const ui = DAY_STATUS_UI[s];
        const on = value === s;
        const Icon = ui.icon;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (value === null && i === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => !on && onChange(s)}
            onKeyDown={onKey}
            className={`inline-flex h-6 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-[5px] border px-2 text-v2-small transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed @min-[50rem]:flex-none ${
              on ? `${ui.on} font-semibold` : "border-transparent font-medium text-v2-text-2 enabled:hover:bg-v2-surface-2 enabled:hover:text-v2-text disabled:opacity-60"
            }`}
          >
            <Icon className="size-3.5" strokeWidth={on ? 2.5 : 2} aria-hidden />
            {t(ui.label)}
          </button>
        );
      })}
    </div>
  );
}

/* ── Tanga yozuvi (chip) ──────────────────────────────────────────── */

function TxChip({ tx, label, onUndo }: { tx: GamTx; label: string; onUndo?: () => void }) {
  const { t } = useT();
  const cls = `inline-flex h-6 max-w-full items-center gap-1 rounded-v2-full px-2 text-v2-caption font-medium ${
    tx.amount >= 0 ? "bg-v2-success-bg text-v2-success" : "bg-v2-danger-bg text-v2-danger"
  }`;
  const body = (
    <>
      <b className="font-semibold tabular-nums">{signed(tx.amount)}</b>
      <span className="truncate">{label}</span>
    </>
  );
  if (!onUndo)
    return (
      <span className={cls} title={tx.createdByName ? t("Qo'ydi: {name}", { name: tx.createdByName }) : undefined}>
        {body}
      </span>
    );
  return (
    <button
      type="button"
      onClick={onUndo}
      title={t("Bosing — qaytarish")}
      className={`${cls} transition-[filter,box-shadow] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus`}
    >
      {body}
    </button>
  );
}

function Count({ status, n, label }: { status: AttendanceStatus; n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <MarkIcon status={status} size="sm" />
      <b className="font-semibold tabular-nums text-v2-text">{n}</b>
      {label}
    </span>
  );
}

function RowsSkeleton() {
  return (
    <div className="divide-y divide-v2-border" aria-busy>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="h-3 w-4 rounded bg-v2-skeleton" />
          <div className="size-6 rounded-full bg-v2-skeleton" />
          <div className="h-3 w-40 rounded bg-v2-skeleton" />
          <div className="ml-auto h-7 w-52 rounded-v2-md bg-v2-skeleton" />
        </div>
      ))}
    </div>
  );
}
