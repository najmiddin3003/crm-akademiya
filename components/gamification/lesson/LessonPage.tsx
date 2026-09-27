"use client";

import "../gamification.css";
import { useCallback, useEffect, useState } from "react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import Select from "@/components/ui/Select";
import Link from "@/components/ui/Link";
import { useLang, useT } from "@/components/shared/Language";
import { MONTHS, WEEKDAYS_FULL } from "@/lib/i18n";
import type { GamRole } from "@/lib/gamification/types";
import { gamApi } from "../api";
import { btnSm, cardCls, Chip, fmtDate, signed, Signed, useGamToast, withReward } from "../ui";
import ReasonModal, { type ReasonDone, type ReasonOption, type ReasonTarget } from "./ReasonModal";
import ProfileModal from "../profile/ProfileModal";

// Gamifikatsiya → Tanga berish — DARS JURNALI (TZ 5.1; prototipdagi
// «Tanga berish»). Bugungi dars: davomat (Davomat bo'limidan avtomatik),
// uy vazifasi ✓/✗, faollik +1…+5, «± Sabab», Sarhisob foizlari va bugungi
// yig'indi. Har amaldan keyin 8 soniya «Ortga» (TZ 5.0). Hamma tekshiruv
// serverda — bu yerda faqat ko'rsatish va tugmalarni o'chirib qo'yish.

type Att = "keldi" | "kechikdi" | "kelmadi" | "sababli";

interface Row {
  pupilId: number;
  name: string;
  balance: number;
  streak: { run: number; next: number };
  att: Att | null;
  attAmount: number;
  homework: { value: "done" | "missed"; amount: number; by: string; txId: number; lock: string | null; lockShort: string | null } | null;
  activity: number;
  deducted: number;
  today: number;
  reasonUse: Record<number, number>;
  exam: { prev: number | null; cur: number | null };
}

interface View {
  enabled: boolean;
  role: GamRole;
  today: string;
  settings: {
    homeworkDoneCoins: number;
    homeworkMissedPenalty: number;
    activityMaxPerClick: number;
    activityGroupLimitPerLesson: number;
    absencePenaltyCoins: number;
    dailyDeductionLimit: number;
    objectionDays: number;
    growthThresholdPp: number;
    streakLessons: number;
    streakBonusCoins: number;
    examCoins90: number;
    examCoins80: number;
    examCoins70: number;
    growthBonusCoins: number;
  };
  sys: Record<string, boolean>;
  reasons: ReasonOption[];
  groups: { id: number; label: string; branchName: string }[];
  group: { id: number; label: string; branchName: string; teacher: string } | null;
  canTeach: boolean;
  canExcuse: boolean;
  activityUsed: number;
  examMonths: { prev: string; cur: string } | null;
  examDone: { results: number; growth: number } | null;
  rows: Row[];
}

type OpRes = {
  txId: number | null;
  amount: number;
  applied: number;
  balance: number;
  levelUp: { name: string } | null;
  badges: { name: string }[];
};

const GROUP_KEY = "gam.lesson.group";

/**
 * Boshqa CRM sahifalari bilan bir xil chekka va kenglik. `page-frame` EMAS:
 * u sahifani balandligi qotgan flex ustunga aylantiradi va jadval kartasi
 * ichki scroll'ga siqilib qoladi — bu yerda sahifa odatdagidek aylanadi.
 */
const PAGE = "gm-page container mx-auto max-w-[1900px] space-y-4 p-4 md:p-5";

// Eng oxirgi so'rov tartib raqami — guruh tez almashtirilganda eski javob
// yangisining ustiga yozilmasin. Modul darajasida (ref emas): sahifa bitta.
let loadSeq = 0;

function readGroup(): number | null {
  try {
    const v = Number(localStorage.getItem(GROUP_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
function saveGroup(id: number) {
  try {
    localStorage.setItem(GROUP_KEY, String(id));
  } catch {
    /* saqlash ixtiyoriy */
  }
}

export default function LessonPage() {
  const { t } = useT();
  const [lang] = useLang();
  const [toastNode, toast] = useGamToast();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<{ text: string; status?: number } | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<ReasonTarget | null>(null);
  const [profileOf, setProfileOf] = useState<number | null>(null);

  // setState faqat promise callback'ida (react-hooks/set-state-in-effect).
  const load = useCallback((gid: number | null): Promise<void> => {
    const my = ++loadSeq;
    return gamApi<View>(gid ? `/api/gamification/lesson?groupId=${gid}` : "/api/gamification/lesson").then((res) => {
      if (my !== loadSeq) return;
      if (!res.ok) {
        setError({ text: res.error, status: res.status });
        return;
      }
      setError(null);
      setView(res);
      if (res.group) {
        setGroupId(res.group.id);
        saveGroup(res.group.id);
      }
    });
  }, []);

  useEffect(() => {
    // localStorage faqat brauzerda — birinchi yuklash effektda.
    void load(readGroup());
  }, [load]);

  const reload = useCallback(() => load(groupId), [load, groupId]);

  if (error && !view) {
    return (
      <div className={PAGE}>
        <h1 className="text-xl font-semibold">{t("Tanga berish")}</h1>
        <div className={`${cardCls} text-sm text-muted-foreground`}>{t(error.text)}</div>
      </div>
    );
  }
  if (!view) return <div className={PAGE}><SpinnerBlock /></div>;

  const s = view.settings;
  const g = view.group;
  const lim = s.activityGroupLimitPerLesson;
  const used = view.activityUsed;
  const showHw = view.sys.homework_done || view.sys.homework_missed;
  const showAct = view.sys.activity;
  const d = new Date(`${view.today}T12:00:00Z`);
  const weekday = (WEEKDAYS_FULL[lang] ?? WEEKDAYS_FULL.uz)[(d.getUTCDay() + 6) % 7]?.toLowerCase() ?? "";
  const monthName = (m: string) => (MONTHS[lang] ?? MONTHS.uz)[Number(m.slice(5, 7)) - 1]?.toLowerCase() ?? m;
  const writable = view.enabled;


  async function run<T>(key: string, fn: () => Promise<{ ok: true } & T | { ok: false; error: string }>, after: (r: T) => void) {
    if (busy) return;
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.ok) {
      toast(t(res.error), { error: true });
      await reload();
      return;
    }
    await reload();
    after(res as T);
  }

  // ── Uy vazifasi ─────────────────────────────────────────────────────
  function homework(r: Row, v: "done" | "missed") {
    const prev = r.homework?.value ?? null;
    void run<OpRes & { removed: "done" | "missed" | null; prev: "done" | "missed" | null }>(
      `hw:${r.pupilId}`,
      () => gamApi("/api/gamification/homework", { method: "POST", body: { groupId: g!.id, pupilId: r.pupilId, value: v } }),
      (res) => {
        if (res.removed) {
          const removed = res.removed;
          toast(t("{name}: uy vazifasi belgisi olib tashlandi", { name: r.name }), {
            undo: () =>
              void run<OpRes>(
                `hw:${r.pupilId}`,
                () => gamApi("/api/gamification/homework", { method: "POST", body: { groupId: g!.id, pupilId: r.pupilId, value: removed } }),
                () => toast(t("Ortga qaytarildi")),
              ),
          });
          return;
        }
        const msg =
          res.applied !== res.amount
            ? t("{name}: balans yetmadi — hamyondan {x} ayirildi (reytingda −{y})", { name: r.name, x: -res.applied, y: -res.amount })
            : v === "done"
              ? t("{name}: uy vazifasi bajarildi ({amount})", { name: r.name, amount: signed(res.amount) })
              : t("{name}: uy vazifasi bajarilmadi ({amount})", { name: r.name, amount: signed(res.amount) });
        const txId = res.txId;
        toast(withReward(t, msg, r.name, res), {
          undo: txId
            ? () =>
                void run<OpRes>(
                  `hw:${r.pupilId}`,
                  () => gamApi(`/api/gamification/transactions/${txId}/undo`, { method: "POST", body: { restore: prev } }),
                  () => toast(t("Ortga qaytarildi")),
                )
            : undefined,
        });
      },
    );
  }

  // ── Faollik ─────────────────────────────────────────────────────────
  function activity(r: Row, n: number) {
    void run<OpRes>(
      `act:${r.pupilId}`,
      () => gamApi("/api/gamification/activity", { method: "POST", body: { groupId: g!.id, pupilId: r.pupilId, coins: n } }),
      (res) => {
        const txId = res.txId;
        toast(withReward(t, t("{name}: faollik +{n}", { name: r.name, n }), r.name, res), {
          undo: txId
            ? () =>
                void run<OpRes>(
                  `act:${r.pupilId}`,
                  () => gamApi(`/api/gamification/transactions/${txId}/undo`, { method: "POST", body: {} }),
                  () => toast(t("Ortga qaytarildi")),
                )
            : undefined,
        });
      },
    );
  }

  // ── «Sababli qilish» / «Sababsizga qaytarish» ───────────────────────
  function excuse(r: Row, action: "excuse" | "unexcuse", isUndo = false) {
    type ExRes = { refunded: number; charged: number };
    void run<ExRes>(
      `att:${r.pupilId}`,
      () => gamApi("/api/gamification/excuse", { method: "POST", body: { groupId: g!.id, pupilId: r.pupilId, date: view!.today, action } }),
      (res) => {
        const date = fmtDate(view!.today);
        if (isUndo) {
          toast(action === "excuse" ? t("Ortga qaytarildi: sababli") : t("Ortga qaytarildi: sababsiz"));
          return;
        }
        const msg =
          action === "excuse"
            ? res.refunded
              ? t("{name} · {date}: sababli — {n} tanga qaytarildi, seriya uzilmaydi", { name: r.name, date, n: res.refunded })
              : t("{name} · {date}: sababli, seriya uzilmaydi", { name: r.name, date })
            : t("{name} · {date}: sababsiz deb qaytarildi", { name: r.name, date });
        toast(msg, { undo: () => excuse(r, action === "excuse" ? "unexcuse" : "excuse", true) });
      },
    );
  }

  // ── «± Sabab» ───────────────────────────────────────────────────────
  function openReason(r: Row) {
    const absent = r.att === "kelmadi" || r.att === "sababli";
    const list = absent ? view!.reasons.filter((x) => x.direction > 0) : view!.reasons;
    if (!list.length) {
      toast(
        absent
          ? t("Darsda yo'q o'quvchidan tanga ayirilmaydi, beriladigan sabab esa sizga ruxsat etilmagan")
          : t("Sizning rolingiz uchun faol sabab yo'q (Sozlamalar → Tanga sabablari)"),
        { error: true },
      );
      return;
    }
    setReasonFor({
      pupilId: r.pupilId,
      name: r.name,
      balance: r.balance,
      deducted: r.deducted,
      reasonUse: r.reasonUse,
      groupId: g!.id,
      groupLabel: g!.label,
      absent,
    });
  }

  async function reasonDone(target: ReasonTarget, res: ReasonDone) {
    await reload();
    const v = Math.abs(res.amount);
    const msg =
      res.direction > 0
        ? t("{name}: +{v} · {reason}", { name: target.name, v, reason: res.reasonName })
        : res.applied === res.amount
          ? t("{name}: −{v} · {reason}", { name: target.name, v, reason: res.reasonName })
          : t("{name}: balans yetmadi — hamyondan {x} ayirildi (reytingda −{y})", { name: target.name, x: -res.applied, y: v });
    const txId = res.txId;
    toast(withReward(t, msg, target.name, res), {
      undo: txId
        ? () =>
            void run<OpRes>(
              `rs:${target.pupilId}`,
              () => gamApi(`/api/gamification/transactions/${txId}/undo`, { method: "POST", body: {} }),
              () => toast(t("Ortga qaytarildi")),
            )
        : undefined,
    });
  }

  // ── Ko'rinish ───────────────────────────────────────────────────────
  const attChip = (r: Row) => {
    const a = r.attAmount;
    const amt = a > 0 ? ` +${a}` : a < 0 ? ` −${-a}` : "";
    switch (r.att) {
      case "keldi":
        return <Chip tone="g">{t("Keldi")}{amt}</Chip>;
      case "kechikdi":
        return <Chip tone="a">{t("Kechikdi")}{amt}</Chip>;
      case "kelmadi":
        return <Chip tone="r">{t("Kelmadi")}{amt}</Chip>;
      case "sababli":
        return <Chip tone="m">{t("Sababli")} · 0</Chip>;
      default:
        return <Chip tone="m">{t("Davomat kiritilmagan")}</Chip>;
    }
  };

  const hwCell = (r: Row) => {
    if (!r.att) return <span className="text-[12px] text-muted-foreground">{t("avval davomat")}</span>;
    if (r.att === "kelmadi" || r.att === "sababli") return <span className="text-muted-foreground">—</span>;
    const h = r.homework;
    if (!view.canTeach || !writable) {
      return h ? (
        <Chip tone={h.amount > 0 ? "g" : "r"}>
          {h.amount > 0 ? "✓" : "✗"} {signed(h.amount)}
        </Chip>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    }
    const lock = h?.lock ?? null;
    const btn = (v: "done" | "missed", label: string, title: string) => {
      const on = h?.value === v;
      return (
        <button
          type="button"
          disabled={!!lock || busy !== null}
          title={t(lock ?? (on ? "Qayta bosish — belgini olib tashlash" : title))}
          onClick={() => homework(r, v)}
          className={`gm-tap inline-flex h-8 min-w-[64px] items-center justify-center rounded-lg border px-2 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
            on
              ? v === "done"
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-rose-500 bg-rose-500 text-white"
              : "border-border bg-card hover:bg-secondary"
          }`}
        >
          {label}
        </button>
      );
    };
    return (
      <div>
        <div className="inline-flex gap-1.5">
          {view.sys.homework_done && btn("done", `✓ +${s.homeworkDoneCoins}`, "Uy vazifasi bajarildi")}
          {view.sys.homework_missed && btn("missed", `✗ −${s.homeworkMissedPenalty}`, "Uy vazifasi bajarilmadi")}
        </div>
        {lock && h?.lockShort && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            🔒 {h.lockShort === "tanga sarflangan" ? t("tanga sarflangan") : t("{by} qo'ygan", { by: h.lockShort })}
          </div>
        )}
      </div>
    );
  };

  const actCell = (r: Row) => {
    if (!r.att) return <span className="text-[12px] text-muted-foreground">{t("avval davomat")}</span>;
    if (r.att === "kelmadi" || r.att === "sababli") return <span className="text-muted-foreground">—</span>;
    if (!view.canTeach || !writable) return r.activity ? <span className="gm-pos">+{r.activity}</span> : <span className="text-muted-foreground">—</span>;
    return (
      <div className="inline-flex items-center gap-1">
        {Array.from({ length: s.activityMaxPerClick }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={used + n > lim || busy !== null}
            onClick={() => activity(r, n)}
            className="gm-tap inline-flex h-8 w-9 items-center justify-center rounded-lg border border-border bg-card text-[12.5px] font-semibold hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-35"
          >
            +{n}
          </button>
        ))}
        {/* Jami uchun joy doim ajratilgan — tugmalar siljimaydi (TZ 5.1). */}
        <span className="gm-pos inline-block w-9 text-right tabular-nums">{r.activity ? `+${r.activity}` : ""}</span>
      </div>
    );
  };

  const examCell = (r: Row) => {
    const { prev, cur } = r.exam;
    if (prev === null && cur === null) return <span className="text-muted-foreground">—</span>;
    const up = prev !== null && cur !== null && cur - prev >= s.growthThresholdPp;
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]">
        <span>
          {prev !== null ? `${prev}%` : "—"} → <b>{cur !== null ? `${cur}%` : "—"}</b>
        </span>
        {up && <Chip tone="g">↑{cur! - prev!}</Chip>}
      </span>
    );
  };

  return (
    <div className={PAGE}>
      {toastNode}
      <div>
        <h1 className="text-xl font-semibold">{t("Tanga berish")}</h1>
        {g && (
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("Bugungi dars")} · {fmtDate(view.today)}, {weekday} · {g.label} · {g.branchName}
            {g.teacher ? ` · ${t("ustoz")} ${g.teacher}` : ""}
          </p>
        )}
      </div>

      {!view.enabled && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px]">
          {t("Gamifikatsiya moduli o'chiq — tangalar yozilmaydi, sahifa faqat ko'rish uchun.")}{" "}
          {view.role === "director" && (
            <Link href="/settings-gamification?tab=general" className="font-semibold text-primary hover:underline">
              {t("Sozlamalar → Gamifikatsiya → Umumiy")}
            </Link>
          )}
        </div>
      )}
      {view.role === "branch_admin" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-[13px] leading-relaxed">
          {t(
            "Filial admini uy vazifasi va faollik tangalarini bermaydi. Admin vazifasi: kelmagan o'quvchini «Sababli» qilish (kasallik va h.k. — ayirilgan tanga qaytadi, seriya uzilmaydi) va adminga ruxsat berilgan sabablar bo'yicha tanga berish/ayirish.",
          )}
        </div>
      )}

      {!g ? (
        <div className={`${cardCls} text-sm text-muted-foreground`}>{t("Sizga biriktirilgan guruh yo'q.")}</div>
      ) : (
        <>
          <div className={cardCls}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-[28rem]">
                <Select
                  value={String(g.id)}
                  onChange={(v) => {
                    const id = Number(v);
                    setGroupId(id);
                    void load(id);
                  }}
                  options={view.groups.map((x) => ({ value: String(x.id), label: x.branchName ? `${x.label} — ${x.branchName}` : x.label }))}
                  size="md"
                  searchable
                />
              </div>
              <Chip tone="m">{t("Davomat — Davomat bo'limidan avtomatik")}</Chip>
              {showAct && <Chip tone={used >= lim ? "r" : "a"}>{t("Faollik: {used} / {limit}", { used, limit: lim })}</Chip>}
            </div>
          </div>

          {(view.sys.exam_result || view.sys.growth) && view.examMonths && (
            // Sarhisob kartasi (TZ 5.1): tanga qoidalari; oy natijasi saqlangach — «✓ Yozildi».
            <div className={cardCls}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[240px] flex-1">
                  <b className="text-[14px]">{t("Sarhisob · {month} natijalari", { month: monthName(view.examMonths.cur) })}</b>
                  <div className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                    {view.sys.exam_result && (
                      <>
                        {t("90%+ → +{a} · 80–89% → +{b} · 70–79% → +{c}.", { a: s.examCoins90, b: s.examCoins80, c: s.examCoins70 })}{" "}
                      </>
                    )}
                    {view.sys.growth && (
                      <>
                        {t("O'tgan oyga nisbatan +{pp} foiz punkt va undan ko'p o'sish → +{n}.", { pp: s.growthThresholdPp, n: s.growthBonusCoins })}{" "}
                      </>
                    )}
                    {t("Ustoz Imtihon → Sarhisob bo'limida guruh natijasini saqlaganda tangalar avtomatik yoziladi. Oy natijalariga (musobaqa, «Oy o'quvchisi») kirishi uchun natijani oy tugaguncha kiriting.")}
                  </div>
                </div>
                {view.examDone && view.examDone.results + view.examDone.growth > 0 && (
                  <Chip tone="g">{t("✓ Yozildi: {n} natija · {m} o'sish", { n: view.examDone.results, m: view.examDone.growth })}</Chip>
                )}
              </div>
            </div>
          )}

          {view.rows.length === 0 ? (
            <div className={`${cardCls} text-sm text-muted-foreground`}>{t("Bu guruhda faol o'quvchi yo'q.")}</div>
          ) : (
            <div className={`${cardCls} gm-scroll-card table-box !p-0`}>
              <table className="gm-table">
                <thead>
                  <tr>
                    <th>{t("O'quvchi")}</th>
                    <th>{t("Davomat")}</th>
                    {showHw && <th>{t("Uy vazifasi")}</th>}
                    {showAct && <th>{view.canTeach && writable ? t("Faollik · qoldi {n}", { n: Math.max(0, lim - used) }) : t("Faollik")}</th>}
                    <th>{t("Boshqa sabablar")}</th>
                    <th className="whitespace-normal">
                      {t("Sarhisob")}
                      {view.examMonths && (
                        <div className="text-[10.5px] font-medium normal-case tracking-normal">
                          {monthName(view.examMonths.prev)} → {monthName(view.examMonths.cur)}
                        </div>
                      )}
                    </th>
                    <th>{t("Bugun")}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((r) => (
                    <tr key={r.pupilId}>
                      <td data-l="" className="gm-lead">
                        {/* Ism bosilsa — o'quvchi profili (TZ 5.1). */}
                        <button type="button" className="text-left font-semibold text-primary hover:underline" onClick={() => setProfileOf(r.pupilId)}>
                          {r.name}
                        </button>
                        <div className="mt-0.5 text-[12px] text-muted-foreground">
                          🔥 {t("{n} dars ketma-ket", { n: r.streak.run })} · <span className="gm-coin">{r.balance}</span>
                        </div>
                      </td>
                      <td data-l={t("Davomat")}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {attChip(r)}
                          {writable && view.canExcuse && r.att === "kelmadi" && (
                            <button type="button" className={btnSm} disabled={busy !== null} onClick={() => excuse(r, "excuse")}>
                              {t("Sababli")}
                            </button>
                          )}
                          {writable && view.canExcuse && r.att === "sababli" && (
                            <button
                              type="button"
                              className={btnSm}
                              disabled={busy !== null}
                              title={t("Sababsizga qaytarish")}
                              aria-label={t("Sababsizga qaytarish")}
                              onClick={() => excuse(r, "unexcuse")}
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      </td>
                      {showHw && <td data-l={t("Uy vazifasi")}>{hwCell(r)}</td>}
                      {showAct && (
                        <td data-l={view.canTeach && writable ? t("Faollik · qoldi {n}", { n: Math.max(0, lim - used) }) : t("Faollik")}>{actCell(r)}</td>
                      )}
                      <td data-l={t("Boshqa sabablar")}>
                        <div className="flex flex-nowrap items-center gap-2">
                          <button
                            type="button"
                            className={btnSm}
                            disabled={!writable || view.reasons.length === 0 || busy !== null}
                            onClick={() => openReason(r)}
                          >
                            ± {t("Sabab")}
                          </button>
                          <span className="whitespace-nowrap text-[12px] text-muted-foreground" title={t("Bugun qo'lda ayirilgan / kunlik limit")}>
                            {t("ayirildi {used}/{limit}", { used: r.deducted, limit: s.dailyDeductionLimit })}
                          </span>
                        </div>
                      </td>
                      <td data-l={t("Sarhisob")}>{examCell(r)}</td>
                      <td data-l={t("Bugun")}>
                        <Signed n={r.today} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {t("Qoidalar")}:{" "}
            {showAct && <>{t("faollik tangasi bir darsda guruhga jami {limit} tangadan oshmaydi", { limit: lim })} · </>}
            {t(
              "bir o'quvchidan bir kunda qo'lda ayiriladigan tanga — ko'pi bilan {limit} (uy vazifasi ✗ + ayiriladigan sabablar; davomat −{absence} bunga kirmaydi)",
              { limit: s.dailyDeductionLimit, absence: s.absencePenaltyCoins },
            )}{" "}
            · {t("balans 0 dan pastga tushmaydi")} · {t("ayirish darajani tushirmaydi")} · {t("✓/✗ ni qayta bossangiz belgi olib tashlanadi")} ·{" "}
            {t("✓/✗, faollik va sabablardan keyin 8 soniya «Ortga» tugmasi turadi (xato bosilganini qaytarish uchun).")}
          </p>
        </>
      )}

      {profileOf !== null && (
        <ProfileModal pupilId={profileOf} onClose={() => setProfileOf(null)} toast={toast} onChanged={() => void reload()} />
      )}
      {reasonFor && (
        <ReasonModal
          target={reasonFor}
          reasons={view.reasons}
          dailyLimit={s.dailyDeductionLimit}
          objectionDays={s.objectionDays}
          onClose={() => setReasonFor(null)}
          onDone={(res) => void reasonDone(reasonFor, res)}
        />
      )}
    </div>
  );
}
