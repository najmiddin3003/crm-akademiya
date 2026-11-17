"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Flame, LineChart, Loader2, Minus, Plus, RotateCcw, Trophy, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { gamApi } from "@/components/gamification/api";
import { withReward } from "@/components/gamification/ui";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { Avatar, Badge, NoticeBar, PageHead, PageShell, TH } from "@/components/v2/students/lists/listKit";
import ReasonDialogV2, { type ReasonDoneV2 } from "./ReasonDialogV2";
import { attChip, isAbsent, type LessonRowV2, type LessonViewV2, type OpRes } from "./lessonTypes";

// YANGI VERSIYA — GAMIFIKATSIYA → «TANGA BERISH» (33-qism, rasmlar «Tanga berish» va telefonda
// «Tanga berish (ustoz)»). Bugungi dars: davomat (avtomatik, Davomat bo'limidan), guruh faolligi
// limiti, bugun guruhga jami; Sarhisob eslatmasi; o'quvchilar — uy vazifasi ✓/✗, faollik +1…+5
// (bitta qiymat: tanlanganini qayta bosish — olib tashlaydi), «± Sabab» (./ReasonDialogV2.tsx).
// Har amaldan keyin pastda 8 soniya «Ortga». Hamma qoida serverda (lib/gamification/lesson.ts):
// ustoz — o'z guruhi, direktor — hamma; davomati belgilanmagan o'quvchiga tanga yozilmaydi.
// ≥1024 px — jadval, torroqda — o'quvchi kartalari.

const UNDO_MS = 8000;

interface UndoBar {
  id: number;
  title: string;
  sub?: string;
  run: () => Promise<void>;
}

const signedNum = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
const toneOf = (n: number) => (n > 0 ? "text-v2-success" : n < 0 ? "text-v2-danger" : "text-v2-text-3");

export default function LessonV2({ initialGroupId }: { initialGroupId?: number | null }) {
  const { t, lang } = useT();
  const fmt = useProfileFmt();
  const { showError } = useToast();
  const [view, setView] = useState<LessonViewV2 | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<number | null>(null);
  const [bar, setBar] = useState<UndoBar | null>(null);
  const [secs, setSecs] = useState(0);
  const viewRef = useRef<LessonViewV2 | null>(null);
  const barId = useRef(0);

  const fetchView = useCallback(
    (gid: number | null) =>
      gamApi<LessonViewV2>(gid ? `/api/gamification/lesson?groupId=${gid}` : "/api/gamification/lesson").then((res) => {
        if (!res.ok) {
          setError(res.error);
          return null;
        }
        viewRef.current = res;
        setView(res);
        setError("");
        return res;
      }),
    [],
  );

  useEffect(() => {
    void fetchView(initialGroupId ?? null);
  }, [fetchView, initialGroupId]);

  // «Ortga · 6» — soniya sanog'i; vaqt tugasa qator yo'qoladi.
  useEffect(() => {
    if (!bar) return;
    const start = Date.now();
    const h = window.setInterval(() => {
      const left = Math.ceil((UNDO_MS - (Date.now() - start)) / 1000);
      setSecs(Math.max(0, left));
      if (left <= 0) setBar((b) => (b && b.id === bar.id ? null : b));
    }, 250);
    return () => window.clearInterval(h);
  }, [bar]);

  const g = view?.group ?? null;
  const reload = () => fetchView(g?.id ?? null);
  const rowOf = (pupilId: number) => viewRef.current?.rows.find((r) => r.pupilId === pupilId) ?? null;

  function pickGroup(id: string) {
    const gid = Number(id);
    const url = new URL(window.location.href);
    url.searchParams.set("groupId", String(gid));
    window.history.replaceState(null, "", url.toString());
    void fetchView(gid);
  }

  function showBar(title: string, sub: string | undefined, run: () => Promise<void>) {
    barId.current += 1;
    setSecs(UNDO_MS / 1000);
    setBar({ id: barId.current, title, sub, run });
  }

  async function op<T>(key: string, call: () => Promise<({ ok: true } & T) | { ok: false; error: string }>): Promise<({ ok: true } & T) | null> {
    if (busy) return null;
    setBusy(key);
    const res = await call();
    setBusy(null);
    if (!res.ok) {
      showError(t(res.error));
      void reload();
      return null;
    }
    return res;
  }

  /* ── Uy vazifasi: ✓ / ✗, tanlanganini qayta bosish — olib tashlash ── */
  async function setHomework(r: LessonRowV2, v: "done" | "missed", silent = false) {
    if (!g) return;
    const prev = r.homework?.value ?? "clear";
    const next = prev === v ? "clear" : v;
    const res = await op<OpRes>(`hw:${r.pupilId}`, () => gamApi("/api/gamification/homework", { method: "POST", body: { groupId: g.id, pupilId: r.pupilId, value: next } }));
    if (!res) return;
    await reload();
    if (silent) return;
    const label = next === "clear" ? t("Uy vazifasi belgisi olib tashlandi") : next === "done" ? t("Uy vazifasi bajarildi") : t("Uy vazifasi bajarilmadi");
    const amt = next === "clear" ? "" : ` · ${signedNum(res.amount)}`;
    showBar(withReward(t, `${r.name} · ${label}${amt}`, r.name, res), undefined, async () => {
      const cur = rowOf(r.pupilId);
      if (!cur) return;
      const restore = prev === "clear" ? (cur.homework?.value ?? "done") : prev;
      if (prev === "clear" && !cur.homework) return;
      await setHomework(cur, restore as "done" | "missed", true);
    });
  }

  /* ── Faollik: bitta qiymat (0…5) — farq qo'shiladi yoki yozuvlar qaytarilib qayta yoziladi ── */
  async function setActivity(r: LessonRowV2, target: number, silent = false) {
    if (!g) return;
    const cur = r.activity;
    if (target === cur) return;
    setBusy(`act:${r.pupilId}`);
    let last: OpRes | null = null;
    let err = "";
    if (target < cur) {
      for (const tx of r.txs.filter((x) => x.type === "activity")) {
        if (!tx.canUndo) {
          err = t("Bu faollikni {by} yozgan — uni o'zi yoki direktor o'zgartiradi", { by: tx.createdByName });
          break;
        }
        const u = await gamApi(`/api/gamification/transactions/${tx.id}/undo`, { method: "POST", body: {} });
        if (!u.ok) {
          err = t(u.error);
          break;
        }
      }
      if (!err && target > 0) {
        const a = await gamApi<OpRes>("/api/gamification/activity", { method: "POST", body: { groupId: g.id, pupilId: r.pupilId, coins: target } });
        if (a.ok) last = a;
        else err = t(a.error);
      }
    } else {
      const a = await gamApi<OpRes>("/api/gamification/activity", { method: "POST", body: { groupId: g.id, pupilId: r.pupilId, coins: target - cur } });
      if (a.ok) last = a;
      else err = t(a.error);
    }
    setBusy(null);
    await reload();
    if (err) {
      showError(err);
      return;
    }
    if (silent) return;
    const title = target === 0 ? `${r.name} · ${t("Faollik olib tashlandi")}` : `${r.name} · ${t("Darsdagi faollik")} · +${target}`;
    showBar(last ? withReward(t, title, r.name, last) : title, undefined, async () => {
      const now2 = rowOf(r.pupilId);
      if (now2) await setActivity(now2, cur, true);
    });
  }

  function reasonDone(r: LessonRowV2, d: ReasonDoneV2) {
    setReasonFor(null);
    void reload();
    const short = t(d.reason.name);
    const sub =
      d.amount < 0
        ? t("bugun ayirildi {d} / {limit}", { d: r.deducted + Math.abs(d.amount), limit: view?.settings.dailyDeductionLimit ?? 0 })
        : undefined;
    const txId = d.res.txId;
    showBar(withReward(t, `${r.name} · ${short} · ${signedNum(d.amount)}`, r.name, d.res), sub, async () => {
      if (!txId) return;
      const u = await gamApi(`/api/gamification/transactions/${txId}/undo`, { method: "POST", body: {} });
      if (!u.ok) showError(t(u.error));
      await reload();
    });
  }

  async function runUndo() {
    const b = bar;
    if (!b) return;
    setBar(null);
    await b.run();
  }

  /* ── Holatlar ── */
  if (error && !view) {
    return (
      <PageShell flow>
        <PageHead title={t("Tanga berish")} subtitle="" />
        <NoticeBar>{t(error)}</NoticeBar>
      </PageShell>
    );
  }
  if (!view) {
    return (
      <PageShell flow>
        <PageHead title={t("Tanga berish")} subtitle="" />
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      </PageShell>
    );
  }

  const s = view.settings;
  const rows = view.rows;
  const limit = s.activityGroupLimitPerLesson;
  const left = Math.max(0, limit - view.activityUsed);
  const maxClick = Math.max(1, Math.min(5, s.activityMaxPerClick));
  const allTx = rows.flatMap((r) => r.txs);
  const given = allTx.filter((x) => x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const taken = allTx.filter((x) => x.amount < 0).reduce((a, x) => a + x.amount, 0);
  const cnt = (f: (r: LessonRowV2) => boolean) => rows.filter(f);
  const came = cnt((r) => r.att === "keldi" || r.att === "kechikdi");
  const missed = cnt((r) => r.att === "kelmadi");
  const excused = cnt((r) => r.att === "sababli");
  const unmarked = cnt((r) => r.att === null);
  const perHead = (list: LessonRowV2[]) => (list.length ? Math.max(...list.map((r) => Math.abs(r.attAmount))) * Math.sign(list[0].attAmount || 0) : 0);

  const subtitle = g
    ? [
        `${t("Bugungi dars")} · ${fmt.dayMonth(view.today)}, ${fmt.weekday(view.today)}`,
        timeLabel(g.time),
        roomLabel(g.room),
        g.teacher ? `${t("ustoz")} ${g.teacher}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : t("Sizga biriktirilgan faol guruh yo'q");

  const examMonth = view.examMonths?.cur ?? view.today.slice(0, 7);
  const monthEnd = new Date(Number(examMonth.slice(0, 4)), Number(examMonth.slice(5, 7)), 0).getDate();
  const reasonRow = reasonFor !== null ? rows.find((r) => r.pupilId === reasonFor) ?? null : null;
  const undoLabel = lang === "en" ? "Undo" : t("Ortga");

  /* ── Bitta o'quvchining boshqaruvlari (jadval va karta uchun umumiy) ── */
  const teachDeny = (r: LessonRowV2): string | null =>
    !view.enabled
      ? t("Gamifikatsiya o'chiq")
      : !view.canTeach
        ? t("Uy vazifasi va faollikni guruh ustozi yoki direktor belgilaydi")
        : r.att === null
          ? t("Avval davomat belgilansin")
          : isAbsent(r.att)
            ? t("Darsda yo'q")
            : null;

  const hwButtons = (r: LessonRowV2, compact: boolean) => {
    const deny = teachDeny(r) ?? (r.homework?.lock ? r.homework.lock : null);
    const on = r.homework?.value ?? null;
    const b = busy === `hw:${r.pupilId}`;
    const cls = (active: boolean, bad: boolean) =>
      `inline-flex h-9 items-center justify-center gap-1 rounded-v2-md border text-v2-small font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        compact ? "h-10 w-9" : "px-2.5"
      } ${active ? (bad ? "border-v2-danger bg-v2-danger-bg text-v2-danger" : "border-v2-success bg-v2-success-bg text-v2-success") : "border-v2-border bg-v2-surface text-v2-text-2 hover:bg-v2-hover"}`;
    return (
      <div className="flex shrink-0 gap-1.5" title={deny ?? undefined}>
        <button type="button" disabled={!!deny || b} aria-pressed={on === "done"} aria-label={t("Uy vazifasi bajarildi")} onClick={() => void setHomework(r, "done")} className={cls(on === "done", false)}>
          <Check className="size-4" strokeWidth={2} aria-hidden />
          {!compact && `+${s.homeworkDoneCoins}`}
        </button>
        <button type="button" disabled={!!deny || b} aria-pressed={on === "missed"} aria-label={t("Uy vazifasi bajarilmadi")} onClick={() => void setHomework(r, "missed")} className={cls(on === "missed", true)}>
          <X className="size-4" strokeWidth={2} aria-hidden />
          {!compact && `−${s.homeworkMissedPenalty}`}
        </button>
      </div>
    );
  };

  const canSet = (r: LessonRowV2, n: number) => n === r.activity || n - r.activity <= left;

  const activityButtons = (r: LessonRowV2) => {
    const deny = teachDeny(r);
    const b = busy === `act:${r.pupilId}`;
    return (
      <div className="flex gap-1.5" title={deny ?? undefined}>
        {Array.from({ length: maxClick }, (_, i) => i + 1).map((n) => {
          const on = r.activity === n;
          const off = !!deny || b || !canSet(r, n);
          return (
            <button
              key={n}
              type="button"
              disabled={off}
              aria-pressed={on}
              title={!deny && !canSet(r, n) ? t("Guruh limitidan {n} tanga qoldi", { n: left }) : undefined}
              onClick={() => void setActivity(r, on ? 0 : n)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-v2-md border text-v2-small font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                on ? "border-v2-brand bg-v2-brand text-v2-on-brand" : "border-v2-border bg-v2-surface text-v2-text hover:bg-v2-hover"
              }`}
            >
              +{n}
            </button>
          );
        })}
      </div>
    );
  };

  const activityStepper = (r: LessonRowV2) => {
    const deny = teachDeny(r);
    const b = busy === `act:${r.pupilId}`;
    const up = r.activity + 1;
    return (
      <div className="inline-flex h-10 min-w-0 flex-1 items-center justify-between rounded-v2-md border border-v2-border px-0.5" title={deny ?? undefined}>
        <button type="button" disabled={!!deny || b || r.activity <= 0} onClick={() => void setActivity(r, r.activity - 1)} aria-label={t("Faollikni kamaytirish")} className="inline-flex size-7 shrink-0 items-center justify-center text-v2-text-2 disabled:opacity-35">
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="truncate text-v2-small font-semibold tabular-nums text-v2-brand">
          {t("Faollik")} {r.activity > 0 ? `+${r.activity}` : "0"}
        </span>
        <button type="button" disabled={!!deny || b || up > maxClick || !canSet(r, up)} onClick={() => void setActivity(r, up)} aria-label={t("Faollikni oshirish")} className="inline-flex size-7 shrink-0 items-center justify-center text-v2-text-2 disabled:opacity-35">
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    );
  };

  const reasonChips = (r: LessonRowV2) =>
    r.txs
      .filter((x) => x.type === "reason")
      .map((x) => (
        <span key={x.id} className={`inline-flex max-w-[12rem] items-center rounded-v2-sm px-1.5 py-0.5 text-v2-caption font-semibold ${x.amount > 0 ? "bg-v2-success-bg text-v2-success" : "bg-v2-danger-bg text-v2-danger"}`} title={x.reasonName}>
          <span className="truncate">
            {signedNum(x.amount)} · {t(x.reasonName)}
          </span>
        </span>
      ));

  const sabaBtn = (r: LessonRowV2, compact: boolean) => {
    const hasMinus = r.txs.some((x) => x.type === "reason" && x.amount < 0);
    const hasPlus = r.txs.some((x) => x.type === "reason" && x.amount > 0);
    return (
      <button
        type="button"
        disabled={!view.enabled || !view.reasons.length}
        onClick={() => setReasonFor(r.pupilId)}
        aria-label={t("Sabab bo'yicha tanga")}
        title={!view.reasons.length ? t("Sizga ruxsat etilgan sabab yo'q") : undefined}
        className={`inline-flex h-9 shrink-0 items-center justify-center rounded-v2-md border text-v2-small font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${compact ? "h-10 w-10" : "px-3"} ${
          compact && hasMinus ? "border-v2-danger bg-v2-danger-bg text-v2-danger" : compact && hasPlus ? "border-v2-success bg-v2-success-bg text-v2-success" : "border-v2-border bg-v2-surface text-v2-text hover:bg-v2-hover"
        }`}
      >
        ±{!compact && ` ${t("Sabab")}`}
      </button>
    );
  };

  const attCell = (r: LessonRowV2) => {
    const c = attChip(r.att);
    if (!c) return <span className="text-v2-small text-v2-text-3">{t("belgilanmagan")}</span>;
    return (
      <span className={`inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-v2-md px-2 text-v2-small font-semibold ${c.tone === "success" ? "bg-v2-success-bg text-v2-success" : c.tone === "danger" ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-surface-2 text-v2-text-2"}`}>
        {t(c.label)} · {signedNum(r.attAmount)}
      </span>
    );
  };

  const meta = (r: LessonRowV2) => (
    <span className="flex items-center gap-1.5 text-v2-small text-v2-text-2">
      {r.streak.run > 0 && (
        <>
          <Flame className="size-3.5 text-v2-danger" strokeWidth={2} aria-hidden />
          <span className="tabular-nums">{t("{n} dars", { n: r.streak.run })}</span>
          <span aria-hidden>·</span>
        </>
      )}
      <span className="size-2.5 rounded-full bg-v2-warning" aria-hidden />
      <span className="tabular-nums">{r.balance}</span>
    </span>
  );

  const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

  return (
    <PageShell flow>
      <PageHead
        title={t("Tanga berish")}
        subtitle={subtitle}
        actions={
          view.groups.length > 0 && g ? (
            <>
              <div className="w-[min(24rem,80vw)]">
                <V2Select
                  label={t("Guruh")}
                  value={String(g.id)}
                  onChange={pickGroup}
                  searchable="auto"
                  options={view.groups.map((x) => ({ value: String(x.id), label: x.branchName && view.role !== "teacher" ? `${x.label} · ${x.branchName}` : x.label }))}
                />
              </div>
              <Link href={`/gamification-ranking?groupId=${g.id}`} className={secondaryBtn}>
                <Trophy className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Guruh reytingi")}
              </Link>
            </>
          ) : undefined
        }
      />

      {!view.enabled && <NoticeBar>{t("Gamifikatsiya o'chiq — tanga yozilmaydi. Yoqish: Sozlamalar → Tanga tizimi.")}</NoticeBar>}

      {g && (
        <>
          {/* Kartalar: davomat · faollik · bugun */}
          <section className="grid overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm md:grid-cols-[1.25fr_1fr_1fr] max-lg:hidden">
            <div className="border-v2-border p-5 md:border-r">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-v2-small font-semibold text-v2-text-2">{t("Davomat · avtomatik")}</span>
                <Link href={`/groups/${g.id}`} className="text-v2-small font-semibold text-v2-brand hover:underline">
                  {t("Davomatga o'tish")}
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="success">{t("{n} keldi", { n: came.length })} · {signedNum(perHead(came))}</Badge>
                <Badge tone="danger">{t("{n} kelmadi", { n: missed.length })} · {signedNum(perHead(missed))}</Badge>
                <Badge tone="neutral">{t("{n} sababli", { n: excused.length })} · 0</Badge>
                {unmarked.length > 0 && <Badge tone="warning">{t("{n} belgilanmagan", { n: unmarked.length })}</Badge>}
              </div>
              <p className="mt-3 text-v2-small text-v2-text-2">{t("Davomat bo'limida belgilanganda tanga o'zi yoziladi")}</p>
            </div>
            <div className="border-v2-border p-5 md:border-r">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-v2-small font-semibold text-v2-text-2">{t("Darsdagi faollik · guruhga")}</span>
                <span className={`text-v2-small font-semibold ${left > 0 ? "text-v2-warning" : "text-v2-danger"}`}>{t("qoldi {n}", { n: left })}</span>
              </div>
              <div className="mt-2 text-v2-body text-v2-text-2">
                <b className="text-[26px] font-semibold tabular-nums text-v2-text">{view.activityUsed}</b> / {limit} {t("tanga")}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
                <div className="h-full rounded-full bg-v2-brand" style={{ width: `${Math.min(100, (view.activityUsed / Math.max(1, limit)) * 100)}%` }} />
              </div>
            </div>
            <div className="p-5">
              <span className="text-v2-small font-semibold text-v2-text-2">{t("Bugun guruhga")}</span>
              <div className="mt-2 text-v2-body text-v2-text-2">
                <b className={`text-[26px] font-semibold tabular-nums ${toneOf(given + taken)}`}>{signedNum(given + taken)}</b> {t("tanga")}
              </div>
              <p className="mt-2 text-v2-small">
                <span className="font-semibold text-v2-success">+{given}</span> <span className="text-v2-text-2">{t("berildi")}</span> ·{" "}
                <span className="font-semibold text-v2-danger">{signedNum(taken)}</span> <span className="text-v2-text-2">{t("ayirildi")}</span>
              </p>
            </div>
          </section>

          {/* Telefon: ikki kichik karta + davomat qatori */}
          <section className="space-y-3 lg:hidden">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-v2-small text-v2-text-2">{t("Faollik")}</span>
                  <span className="text-v2-small font-semibold text-v2-warning">{t("qoldi {n}", { n: left })}</span>
                </div>
                <div className="mt-1 text-v2-text-2">
                  <b className="text-[22px] font-semibold tabular-nums text-v2-text">{view.activityUsed}</b> / {limit}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
                  <div className="h-full rounded-full bg-v2-brand" style={{ width: `${Math.min(100, (view.activityUsed / Math.max(1, limit)) * 100)}%` }} />
                </div>
              </div>
              <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
                <span className="text-v2-small text-v2-text-2">{t("Bugun guruhga")}</span>
                <b className={`mt-1 block text-[22px] font-semibold tabular-nums ${toneOf(given + taken)}`}>{signedNum(given + taken)}</b>
                <span className="text-v2-caption text-v2-text-2">
                  +{given} {t("berildi")} · {signedNum(taken)} {t("ayirildi")}
                </span>
              </div>
            </div>
            <p className="text-v2-small text-v2-text-2">
              {t("Davomat avtomatik")}: <b className="text-v2-success">{t("{n} keldi", { n: came.length })}</b> · <b className="text-v2-danger">{t("{n} kelmadi", { n: missed.length })}</b> · {t("{n} sababli", { n: excused.length })}
            </p>
          </section>

          {/* Sarhisob eslatmasi */}
          {view.sys.exam_result !== false && (
            <section className="flex gap-4 rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm max-lg:hidden">
              <span className="grid size-10 shrink-0 place-items-center rounded-v2-md bg-v2-info-bg text-v2-info">
                <LineChart className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-v2-h3 font-semibold text-v2-text">
                    {t("Sarhisob")} · {t("{month} natijalari", { month: fmt.monthLower(examMonth) })}
                  </h2>
                  <Link href="/imtihon" className="text-v2-small font-semibold text-v2-brand hover:underline">
                    {t("Sarhisobga o'tish")} →
                  </Link>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    [t("90% va undan yuqori"), s.examCoins90],
                    ["80–89%", s.examCoins80],
                    ["70–79%", s.examCoins70],
                    ...(view.sys.growth !== false ? [[t("O'tgan oydan +{n} f.p. o'sish", { n: s.growthThresholdPp }), s.growthBonusCoins] as [string, number]] : []),
                  ].map(([label, n]) => (
                    <span key={String(label)} className="rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-1 text-v2-small text-v2-text-2">
                      {label} <b className="font-semibold text-v2-success">+{n}</b>
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-v2-small text-v2-text-2">
                  {view.examDone && view.examDone.results > 0
                    ? t("Bu oy {n} ta o'quvchiga natija tangasi yozilgan.", { n: view.examDone.results })
                    : t("Guruh natijasi Imtihon → Sarhisobda saqlanganda tangalar o'zi yoziladi.")}{" "}
                  {t("Musobaqa va «Oy o'quvchisi» hisobiga kirishi uchun")}{" "}
                  <b className="font-semibold text-v2-text">{`${monthEnd}-${fmt.monthLower(examMonth)}`}</b>
                  {t("gacha kiriting.")}
                </p>
              </div>
            </section>
          )}

          {/* O'quvchilar — jadval (≥1024 px) */}
          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm max-lg:hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4">
              <h2 className="text-v2-h3 font-semibold text-v2-text">
                {t("O'quvchilar")} <span className="font-normal text-v2-text-3">· {rows.length}</span>
              </h2>
              <span className="text-v2-small text-v2-text-2">{t("Tanlangan tugmani qayta bossangiz belgi olib tashlanadi · har amaldan keyin 8 soniya «Ortga» bor")}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-v2-body">
                <thead>
                  <tr className="border-y border-v2-border bg-v2-surface-2 text-left">
                    <th className={`${TH} pl-5`}>{t("O'quvchi")}</th>
                    <th className={TH}>{t("Davomat")}</th>
                    <th className={TH}>{t("Uy vazifasi")}</th>
                    <th className={TH}>
                      {t("Faollik")} · <span className="text-v2-warning">{t("qoldi {n}", { n: left })}</span>
                    </th>
                    <th className={TH}>{t("Boshqa sabablar")}</th>
                    <th className={TH}>
                      {t("Sarhisob")} {view.examMonths ? `${fmt.monthShort(view.examMonths.prev).toLowerCase()} → ${fmt.monthShort(view.examMonths.cur).toLowerCase()}` : ""}
                    </th>
                    <th className={`${TH} pr-5 text-right`}>{t("Bugun")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-v2-small text-v2-text-3">
                        {t("Guruhda faol o'quvchi yo'q")}
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => {
                    const away = isAbsent(r.att);
                    return (
                      <tr key={r.pupilId} className="border-b border-v2-border align-middle last:border-b-0 hover:bg-v2-hover">
                        <td className="py-3 pl-5 pr-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.name} />
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-v2-text">{r.name}</div>
                              {meta(r)}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">{attCell(r)}</td>
                        <td className="px-3 py-3">{away ? <span className="text-v2-small text-v2-text-2">{t("darsda yo'q")}</span> : hwButtons(r, false)}</td>
                        <td className="px-3 py-3">{away ? <span className="text-v2-text-3">—</span> : activityButtons(r)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            {sabaBtn(r, false)}
                            <div className="flex min-w-0 flex-col items-start gap-1">
                              {reasonChips(r)}
                              <span className="text-v2-caption text-v2-text-2">
                                {t("ayirildi")} {r.deducted} / {s.dailyDeductionLimit}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 tabular-nums text-v2-text-2">
                          {pct(r.exam.prev)} → {pct(r.exam.cur)}
                        </td>
                        <td className={`py-3 pl-3 pr-5 text-right text-v2-h3 font-semibold tabular-nums ${toneOf(r.today)}`}>{signedNum(r.today)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-v2-border bg-v2-surface-2 px-5 py-3 text-v2-small text-v2-text-2">
              <b className="font-semibold text-v2-text">{t("Qoidalar")}:</b>{" "}
              {t("faollik — guruhga bir darsda {a} tangagacha · qo'lda ayirish — bir o'quvchidan kuniga {b} tangagacha (davomat −{c} bunga kirmaydi) · balans 0 dan tushmaydi · ayirish darajani tushirmaydi.", {
                a: limit,
                b: s.dailyDeductionLimit,
                c: s.absencePenaltyCoins,
              })}
            </p>
          </section>

          {/* O'quvchilar — kartalar (telefon / planshet) */}
          <section className="space-y-3 pb-20 lg:hidden">
            {rows.map((r) => {
              const away = isAbsent(r.att);
              return (
                <div key={r.pupilId} className="rounded-v2-lg border border-v2-border bg-v2-surface p-3 shadow-v2-sm sm:p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-v2-text">{r.name}</div>
                      {meta(r)}
                    </div>
                    <b className={`text-v2-h3 font-semibold tabular-nums ${toneOf(r.today)}`}>{signedNum(r.today)}</b>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    {attCell(r)}
                    {away ? (
                      <span className="flex-1 text-v2-small text-v2-text-2">{t("darsda yo'q")}</span>
                    ) : (
                      <>
                        {hwButtons(r, true)}
                        {activityStepper(r)}
                      </>
                    )}
                    {sabaBtn(r, true)}
                  </div>
                  {r.txs.some((x) => x.type === "reason") && <div className="mt-2 flex flex-wrap gap-1">{reasonChips(r)}</div>}
                </div>
              );
            })}
          </section>
        </>
      )}

      {reasonRow && g && (
        <ReasonDialogV2
          row={reasonRow}
          reasons={view.reasons}
          groupId={g.id}
          groupLabel={g.label}
          dailyLimit={s.dailyDeductionLimit}
          onClose={() => setReasonFor(null)}
          onDone={(d) => reasonDone(reasonRow, d)}
        />
      )}

      {bar && secs > 0 && (
        <UndoBarView title={bar.title} sub={bar.sub} action={`${undoLabel} · ${secs}`} onUndo={() => void runUndo()} />
      )}
    </PageShell>
  );
}

function UndoBarView({ title, sub, action, onUndo }: { title: ReactNode; sub?: string; action: string; onUndo: () => void }) {
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-v2-lg bg-v2-text px-4 py-3 text-v2-surface shadow-v2-lg lg:bottom-6">
      <Check className="size-4 shrink-0 max-sm:hidden" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{title}</div>
        {sub && <div className="text-v2-small opacity-80">{sub}</div>}
      </div>
      <button type="button" onClick={onUndo} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-v2-md border border-current/40 px-3 font-semibold hover:bg-white/10">
        <RotateCcw className="size-4" strokeWidth={2} aria-hidden />
        {action}
      </button>
    </div>
  );
}
