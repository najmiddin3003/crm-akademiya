"use client";

import { useState } from "react";
import { ArrowRight, ArrowRightLeft, CalendarCheck, ChevronDown, CircleAlert, ExternalLink, History, MoreHorizontal, UserMinus, UserPlus, Users, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { fmtSum } from "@/components/v2/employees/employeeBits";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { GROUP_TONE } from "@/components/v2/ui/groupStatus";
import type { ProfileGroup } from "@/lib/pupilProfile";
import ActivityList from "./ActivityList";
import { debtMonthsOf, firstDebtCell, lessonsOfMonth, markStats, marksOfMonth, monthSummaryState } from "./profileLedger";
import { AttendanceKpi, DebtKpi, IncompleteNote, NextLessonKpi, attendanceSub } from "./profileKpis";
import { Card, EmptyBlock, KpiStrip, MarkIcon, PayStateIcon, PctBar, ToneBadge, ghostIcon, groupMeta, groupTitle, linkBtn, secondarySm } from "./profileBits";
import type { TabProps } from "./profileTypes";

// YANGI VERSIYA — O'QUVCHI SAHIFASI · UMUMIY (rasm «O'quvchi sahifasi · Umumiy»,
// bo'sh holat — «Yangi o'quvchi · Bo'sh holatlar», 23.10.2026):
//   ko'rsatkichlar — Qarzdorlik | Davomat · oy | Keyingi dars;
//   Guruhlar — har guruh: fan nuqtasi, «Ingliz tili · 2-bosqich» + holat, ustoz · xona ·
//     kunlar soat, o'ngda oylik narx («oyiga · 05.06.2026 dan»; yig'ilayotganda —
//     «qo'shilgan · sana»), «⇄ Ko'chirish», «⋯»; «Guruhga qo'shish»;
//   To'lovlar — oxirgi oylar holati + qarz qutisi («Oktyabr uchun 470 000 so'm qarz ·
//     To'lash»); Davomat — oyning darslari (doirachalar) va foiz;
//   So'nggi harakatlar (5 ta) — «Butun tarix →» Tarix tabiga.

export default function ProfileOverviewTab(props: TabProps) {
  const { data, ledger, fmt, activity, goTab } = props;
  const { t } = useT();
  const cur = ledger.curMonth;
  const monthStats = markStats(marksOfMonth(data.marks, cur));

  return (
    <div className="flex flex-col gap-4">
      <KpiStrip label={t("Ko'rsatkichlar")}>
        <DebtKpi ledger={ledger} fmt={fmt} />
        <AttendanceKpi
          stats={monthStats}
          label={`${t("Davomat")} · ${fmt.monthLower(cur)}`}
          emptySub={data.marks.length === 0 ? t("darslar hali boshlanmagan") : t("bu oy hali belgi yo'q")}
        />
        <NextLessonKpi data={data} fmt={fmt} />
      </KpiStrip>

      <GroupsCard {...props} />

      <div className="grid gap-4 @min-[44rem]:grid-cols-2">
        <PaymentsMini {...props} />
        <AttendanceMini {...props} />
      </div>

      <Card
        title={t("So'nggi harakatlar")}
        flush
        action={
          activity.length > 0 && (
            <button type="button" onClick={() => goTab("tarix")} className={linkBtn}>
              {t("Butun tarix")}
              <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
            </button>
          )
        }
      >
        {activity.length === 0 ? (
          <div className="border-t border-v2-border">
            <EmptyBlock icon={<History className="size-5" strokeWidth={1.75} />} title={t("Hali harakat yo'q")} />
          </div>
        ) : (
          <div className="border-t border-v2-border">
            <ActivityList items={activity.slice(0, 5)} data={data} fmt={fmt} />
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Guruhlar ─────────────────────────────────────────────────────── */

function GroupsCard({ data, fmt, canPay, canGroups, onPay, onAddGroup, onTransfer, onRemove }: TabProps) {
  const { t } = useT();
  const [showPast, setShowPast] = useState(false);
  const current = data.groups.filter((g) => g.current);
  const past = data.groups.filter((g) => !g.current);

  const row = (g: ProfileGroup, isPast: boolean) => {
    const tone = GROUP_TONE[g.status];
    const gathering = g.status === "gathering";
    const titleEl = canGroups ? (
      <Link href={`/groups/${g.id}`} className="truncate font-semibold text-v2-text underline-offset-2 hover:underline">
        {groupTitle(g)}
      </Link>
    ) : (
      <span className="truncate font-semibold text-v2-text">{groupTitle(g)}</span>
    );
    const menu: ActionMenuEntry[] = [
      { key: "h", heading: g.label },
      ...(canGroups ? [{ key: "open", label: t("Guruh sahifasi"), icon: ExternalLink, href: `/groups/${g.id}` } as ActionMenuEntry] : []),
      ...(canPay && !isPast ? [{ key: "pay", label: t("Shu guruh uchun to'lov"), icon: Wallet, onSelect: () => onPay({ groupId: g.id }) } as ActionMenuEntry] : []),
      ...(!isPast
        ? ([
            { key: "d", divider: true },
            { key: "remove", label: t("Guruhdan chiqarish"), icon: UserMinus, danger: true, onSelect: () => onRemove(g) },
          ] as ActionMenuEntry[])
        : []),
    ];
    return (
      <li key={g.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${isPast ? "opacity-75" : ""}`}>
        <div className="flex min-w-[12rem] flex-1 items-start gap-2.5">
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-v2-body">
              {titleEl}
              {isPast ? (
                <ToneBadge tone={{ badge: "bg-v2-surface-2 text-v2-text-2", dot: "bg-v2-text-3" }}>{t("Chiqqan")}</ToneBadge>
              ) : (
                tone && <ToneBadge tone={tone}>{t(tone.label)}</ToneBadge>
              )}
            </div>
            <div className="mt-0.5 text-v2-small text-v2-text-2">{groupMeta(g) || "—"}</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-right">
            {isPast ? (
              <>
                <div className="text-v2-caption text-v2-text-3">{t("chiqqan")}</div>
                <div className="text-v2-small font-semibold tabular-nums text-v2-text">{g.leftAt ? fmt.ddmmyyyy(g.leftAt) : "—"}</div>
              </>
            ) : gathering || g.monthlyPrice === null ? (
              <>
                <div className="text-v2-caption text-v2-text-3">{gathering ? t("qo'shilgan") : t("narx belgilanmagan")}</div>
                <div className="text-v2-small font-semibold tabular-nums text-v2-text">{g.joinedAt ? fmt.ddmmyyyy(g.joinedAt) : "—"}</div>
              </>
            ) : (
              <>
                <div className="text-v2-small font-semibold tabular-nums text-v2-text">
                  {fmtSum(g.monthlyPrice)} {t("so'm")}
                </div>
                <div className="text-v2-caption tabular-nums text-v2-text-3">
                  {g.joinedAt ? t("oyiga · {date} dan", { date: fmt.ddmmyyyy(g.joinedAt) }) : t("oyiga")}
                </div>
              </>
            )}
          </div>
          {!isPast && (
            <button type="button" onClick={() => onTransfer(g)} className={secondarySm}>
              <ArrowRightLeft className="size-3.5" strokeWidth={1.75} aria-hidden />
              {t("Ko'chirish")}
            </button>
          )}
          {menu.length > 1 && (
            <ActionMenu items={menu} label={t("{name} — amallar", { name: g.label })} width={240}>
              {(trigger) => (
                <button type="button" {...trigger} title={t("Amallar")} aria-label={t("{name} — amallar", { name: g.label })} className={ghostIcon}>
                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                </button>
              )}
            </ActionMenu>
          )}
        </div>
      </li>
    );
  };

  return (
    <Card
      title={t("Guruhlar")}
      count={t("{n} ta", { n: current.length })}
      flush
      action={
        <button type="button" onClick={onAddGroup} className={secondarySm}>
          <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Guruhga qo'shish")}
        </button>
      }
    >
      <div className="border-t border-v2-border">
        {current.length === 0 ? (
          <EmptyBlock
            icon={<Users className="size-5" strokeWidth={1.75} />}
            title={t("Hali guruhga qo'shilmagan")}
            text={t("Guruhga qo'shilgach, oylik narx va dars jadvali shu yerda ko'rinadi.")}
          />
        ) : (
          <ul className="divide-y divide-v2-border">{current.map((g) => row(g, false))}</ul>
        )}
        {past.length > 0 && (
          <div className="border-t border-v2-border">
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              aria-expanded={showPast}
              className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-v2-small font-medium text-v2-text-2 transition-colors hover:bg-v2-hover hover:text-v2-text focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)]"
            >
              <ChevronDown className={`size-4 transition-transform ${showPast ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
              {t("Oldingi guruhlar ({n})", { n: past.length })}
            </button>
            {showPast && <ul className="divide-y divide-v2-border border-t border-v2-border">{past.map((g) => row(g, true))}</ul>}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── To'lovlar (qisqa) ────────────────────────────────────────────── */

function PaymentsMini({ ledger, fmt, canPay, onPay, goTab }: TabProps) {
  const { t } = useT();
  const empty = ledger.paymentsCount === 0 && ledger.debt === 0 && ledger.totalPaid === 0;
  const debtMonths = debtMonthsOf(ledger);
  const first = firstDebtCell(ledger);
  const sum = `${fmtSum(ledger.debt)} ${t("so'm")}`;
  // Summa qalin — tarjimadagi o'rni saqlansin: «{month} uchun {sum} qarz» ni «§» bo'yicha bo'lamiz.
  // Boshqa oylardagi ortiqcha to'lov ayrilgan bo'lsa (`offset`), qarz bitta oyga yozilmaydi —
  // «Jami qarz», ostida oyma-oy qarz va ayrilgan summa (profileLedger.ts izohi).
  const debtText =
    ledger.offset > 0
      ? t("Jami qarz {sum}", { sum: "§" })
      : debtMonths.length === 1
        ? t("{month} uchun {sum} qarz", { month: fmt.monthName(debtMonths[0]), sum: "§" })
        : t("{n} oy uchun {sum} qarz", { n: Math.max(1, debtMonths.length), sum: "§" });
  const [before, after] = debtText.split("§");

  return (
    <Card
      title={t("To'lovlar")}
      action={
        !empty && (
          <button type="button" onClick={() => goTab("tolovlar")} className={linkBtn}>
            {t("Batafsil")}
            <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        )
      }
    >
      {empty ? (
        <EmptyBlock
          icon={<Wallet className="size-5" strokeWidth={1.75} />}
          title={t("Hali to'lov qilinmagan")}
          text={t("Birinchi to'lov qabul qilingach, oylar bo'yicha holat shu yerda ko'rinadi.")}
          action={
            canPay && (
              <button
                type="button"
                onClick={() => onPay()}
                className="inline-flex h-9 items-center gap-2 rounded-v2-md bg-v2-brand px-4 text-v2-body font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus"
              >
                <Wallet className="size-4" strokeWidth={1.75} aria-hidden />
                {t("To'lov qabul qilish")}
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          <ol className="grid grid-flow-col auto-cols-fr gap-1" aria-label={t("Oylar bo'yicha")}>
            {ledger.months.map((m) => {
              const state = monthSummaryState(ledger, m);
              const isCur = m === ledger.curMonth;
              return (
                <li
                  key={m}
                  title={fmt.monthName(m)}
                  className={`flex min-w-0 flex-col items-center gap-1.5 rounded-v2-md px-1 py-1.5 ${isCur ? "border border-v2-border-strong bg-v2-surface-2" : "border border-transparent"}`}
                >
                  <span className={`truncate text-v2-caption ${isCur ? "font-semibold text-v2-text" : "text-v2-text-3"}`}>{fmt.monthShort(m)}</span>
                  <PayStateIcon state={state} />
                </li>
              );
            })}
          </ol>
          {ledger.incomplete && ledger.priced === 0 ? null : ledger.debt > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-v2-md bg-v2-danger-bg px-3 py-2.5">
              <CircleAlert className="size-4 shrink-0 text-v2-danger" strokeWidth={2} aria-hidden />
              <span className="min-w-0 flex-1 text-v2-small text-v2-text">
                {before}
                <b className="font-semibold tabular-nums">{sum}</b>
                {after}
                {ledger.offset > 0 && (
                  <span className="mt-0.5 block text-v2-caption text-v2-text-2">
                    {t("oylar bo'yicha {a} so'm − ortiqcha to'langan {b} so'm", { a: fmtSum(ledger.monthDebtSum), b: fmtSum(ledger.offset) })}
                  </span>
                )}
              </span>
              {canPay && (
                <button
                  type="button"
                  onClick={() => onPay(first ? { groupId: first.groupId, month: first.month, amount: first.amount } : undefined)}
                  className="inline-flex h-8 shrink-0 items-center rounded-v2-md border border-v2-danger bg-v2-surface px-3 text-v2-small font-semibold text-v2-danger transition-colors hover:bg-v2-danger-bg focus-visible:outline-none focus-visible:shadow-v2-focus"
                >
                  {t("To'lash")}
                </button>
              )}
            </div>
          ) : ledger.credit > 0 ? (
            <div className="rounded-v2-md bg-v2-success-bg px-3 py-2.5 text-v2-small text-v2-text">
              {t("Oldindan to'langan:")} <b className="font-semibold tabular-nums">{fmtSum(ledger.credit)} {t("so'm")}</b>
            </div>
          ) : (
            <div className="rounded-v2-md bg-v2-surface-2 px-3 py-2.5 text-v2-small text-v2-text-2">{t("Qarz yo'q — joriy oygacha hammasi to'langan")}</div>
          )}
          {ledger.incomplete && <IncompleteNote ledger={ledger} className="rounded-v2-md bg-v2-warning-bg px-3 py-2" />}
        </div>
      )}
    </Card>
  );
}

/* ── Davomat (qisqa) ──────────────────────────────────────────────── */

const MARK_LABEL: Record<string, string> = {
  keldi: "Keldi",
  kechikdi: "Kechikdi",
  birinchi: "Birinchi dars",
  sababli: "Sababli",
  sababsiz: "Kelmadi",
  unmarked: "Belgilanmagan",
  planned: "Rejada",
};

function AttendanceMini({ data, fmt, goTab }: TabProps) {
  const { t } = useT();
  const cur = data.asOf.slice(0, 7);
  const lessons = lessonsOfMonth(data, cur);
  const past = lessons.filter((l) => l.status !== "planned");
  const next = lessons.find((l) => l.status === "planned");
  const shown = [...past.slice(-10), ...(next ? [next] : [])];
  const stats = markStats(marksOfMonth(data.marks, cur));
  const gathering = data.groups.find((g) => g.current && g.status === "gathering");
  const hasGroups = data.groups.some((g) => g.current);

  return (
    <Card
      title={
        <>
          {t("Davomat")} <span className="text-v2-small font-normal text-v2-text-3">{fmt.monthLower(cur)}</span>
        </>
      }
      action={
        shown.length > 0 && (
          <button type="button" onClick={() => goTab("davomat")} className={linkBtn}>
            {t("Batafsil")}
            <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        )
      }
    >
      {shown.length === 0 ? (
        <EmptyBlock
          icon={<CalendarCheck className="size-5" strokeWidth={1.75} />}
          title={t("Darslar hali boshlanmagan")}
          text={
            gathering
              ? t("{course} guruhi yig'ilmoqda. Birinchi dars belgilangach, davomat shu yerda chiqadi.", { course: gathering.course || gathering.label })
              : hasGroups
                ? t("Bu oyda dars yo'q.")
                : t("O'quvchi hali guruhga qo'shilmagan.")
          }
        />
      ) : (
        <div className="space-y-3">
          <ol className="flex flex-wrap gap-x-2.5 gap-y-2" aria-label={t("Darslar")}>
            {shown.map((l) => {
              const isToday = l.date === data.asOf;
              return (
                <li key={l.key} className="flex w-7 flex-col items-center gap-1" title={`${fmt.dayMonth(l.date)} · ${l.group?.course || l.group?.label || ""} · ${t(MARK_LABEL[l.status] ?? l.status)}`}>
                  <MarkIcon status={l.status} />
                  <span className={`text-v2-caption tabular-nums ${isToday ? "font-semibold text-v2-text" : "text-v2-text-3"}`}>{Number(l.date.slice(8, 10))}</span>
                </li>
              );
            })}
          </ol>
          <div className="flex items-center gap-3">
            <span className="text-[1.375rem] font-semibold leading-7 tabular-nums text-v2-text">{stats.pct === null ? "—" : `${stats.pct}%`}</span>
            <div className="min-w-0 flex-1">
              {stats.pct !== null && <PctBar pct={stats.pct} />}
              <div className="mt-1 truncate text-v2-caption text-v2-text-2">{stats.total ? attendanceSub(stats, t) : t("bu oy hali belgi yo'q")}</div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
