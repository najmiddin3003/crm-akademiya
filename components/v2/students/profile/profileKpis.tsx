"use client";

import type { ReactNode } from "react";
import { CalendarDays, CircleAlert, TriangleAlert } from "lucide-react";
import { useT, type TFn } from "@/components/shared/Language";
import { fmtSum } from "@/components/v2/employees/employeeBits";
import { roomLabel } from "@/components/v2/ui/groupStatus";
import type { DebtIssue } from "@/lib/debtorsTypes";
import type { PupilProfilePayload } from "@/lib/pupilProfile";
import { dateToIso, debtMonthsOf, isoToDate, nextLessonOf, type Ledger, type MarkStats } from "./profileLedger";
import { KpiCell, PctBar, type ProfileFmt } from "./profileBits";

// YANGI VERSIYA — O'QUVCHI SAHIFASINING KO'RSATKICHLARI (Umumiy, To'lovlar, Davomat
// tablari bo'lishadi): Qarzdorlik, Davomat (oy), Keyingi dars.

/** «7 / 9 dars · 1 kelmadi, 1 sababli». */
export function attendanceSub(s: MarkStats, t: TFn): string {
  const misses = [s.absent ? t("{n} kelmadi", { n: s.absent }) : "", s.excused ? t("{n} sababli", { n: s.excused }) : ""].filter(Boolean).join(", ");
  return [`${s.came} / ${s.total} ${t("dars")}`, misses].filter(Boolean).join(" · ");
}

/** Hisob to'liq emasligi sababi: «Ona tili, Matematika — narx belgilanmagan; …». */
export function issueText(ledger: Ledger, t: TFn): string {
  const by: Record<DebtIssue, string[]> = { price: [], start: [], schedule: [] };
  for (const g of ledger.issueGroups) {
    const name = g.course || g.label;
    for (const i of g.issues) if (!by[i].includes(name)) by[i].push(name);
  }
  return [
    by.price.length ? t("{groups} — narx belgilanmagan", { groups: by.price.join(", ") }) : "",
    by.start.length ? t("{groups} — boshlanish sanasi yo'q", { groups: by.start.join(", ") }) : "",
    by.schedule.length ? t("{groups} — dars kunlari belgilanmagan", { groups: by.schedule.join(", ") }) : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** «Hisob to'liq emas» qatori (sariq) — ko'rsatkich va kartochkalar ostida. */
export function IncompleteNote({ ledger, className = "" }: { ledger: Ledger; className?: string }) {
  const { t } = useT();
  if (!ledger.incomplete) return null;
  return (
    <div className={`flex items-start gap-1.5 text-v2-caption text-v2-warning ${className}`}>
      <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span>
        {t("Hisob to'liq emas")}: {issueText(ledger, t)}
      </span>
    </div>
  );
}

/** Qarzdorlik: «470 000 so'm», «oktyabr · 2 guruh bo'yicha»; qarz yo'q — sababi bilan. */
export function DebtKpi({ ledger, fmt, children }: { ledger: Ledger; fmt: ProfileFmt; children?: ReactNode }) {
  const { t } = useT();
  // Narxi ma'lum guruh umuman yo'q — qarzni hisoblab bo'lmaydi (to'lov bo'lsa ham «0» demaymiz).
  if (ledger.incomplete && ledger.priced === 0) {
    return <KpiCell label={t("Qarzdorlik")} value="—" sub={t("hisoblab bo'lmadi")} footer={<IncompleteNote ledger={ledger} className="mt-1" />} />;
  }
  if (ledger.debt > 0) {
    const months = debtMonthsOf(ledger);
    const when = months.length === 1 ? fmt.monthLower(months[0]) : t("{n} oy", { n: Math.max(1, months.length) });
    const sub = [when, ledger.debtGroups > 0 ? t("{n} guruh bo'yicha", { n: ledger.debtGroups }) : ""].filter(Boolean).join(" · ");
    return (
      <KpiCell
        icon={<CircleAlert className="size-4 shrink-0 text-v2-danger" strokeWidth={2} aria-hidden />}
        label={t("Qarzdorlik")}
        value={`${fmtSum(ledger.debt)} ${t("so'm")}`}
        sub={sub}
        footer={
          <>
            {children}
            <IncompleteNote ledger={ledger} className="mt-1" />
          </>
        }
      />
    );
  }
  const sub =
    ledger.paymentsCount === 0 && ledger.totalPaid === 0
      ? t("to'lov hali qilinmagan")
      : ledger.credit > 0
        ? t("{sum} so'm oldindan to'langan", { sum: fmtSum(ledger.credit) })
        : t("qarz yo'q");
  return <KpiCell label={t("Qarzdorlik")} value={`0 ${t("so'm")}`} sub={sub} footer={<IncompleteNote ledger={ledger} className="mt-1" />} />;
}

/** Davomat (oy bo'yicha): foiz, chiziq, «7 / 9 dars · …». */
export function AttendanceKpi({ stats, label, emptySub }: { stats: MarkStats; label: string; emptySub: string }) {
  const { t } = useT();
  return (
    <KpiCell label={label} value={stats.pct === null ? "—" : `${stats.pct}%`} sub={stats.total ? attendanceSub(stats, t) : emptySub}>
      {stats.pct !== null && <PctBar pct={stats.pct} className="mt-1.5 max-w-[11rem]" />}
    </KpiCell>
  );
}

/** Keyingi dars: «Bugun, 16:00» · «Ingliz tili · 205-xona»; yo'q bo'lsa — sababi. */
export function NextLessonKpi({ data, fmt }: { data: PupilProfilePayload; fmt: ProfileFmt }) {
  const { t } = useT();
  const icon = <CalendarDays className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />;
  // Muzlatilgan / arxivdagi o'quvchiga dars yo'q — jadval qanday bo'lmasin.
  const inactive = data.pupil.status === "Muzlatilgan" || data.pupil.status === "Arxiv";
  const nl = inactive ? null : nextLessonOf(data.groups, data.asOf, data.nowHm);
  if (!nl) {
    const current = data.groups.filter((g) => g.current);
    const sub =
      data.pupil.status === "Muzlatilgan"
        ? t("o'quvchi muzlatilgan")
        : data.pupil.status === "Arxiv"
          ? t("o'quvchi arxivda")
          : current.length === 0
            ? t("guruhga qo'shilmagan")
            : current.some((g) => g.status === "gathering")
              ? t("guruh yig'ilmoqda")
              : t("jadval belgilanmagan");
    return <KpiCell icon={icon} label={t("Keyingi dars")} value="—" sub={sub} />;
  }
  const d = isoToDate(data.asOf);
  d.setDate(d.getDate() + 1);
  const tomorrow = dateToIso(d);
  const diff = Math.round((isoToDate(nl.date).getTime() - isoToDate(data.asOf).getTime()) / 86_400_000);
  const wd = fmt.weekday(nl.date);
  const day =
    nl.date === data.asOf ? t("Bugun") : nl.date === tomorrow ? t("Ertaga") : diff < 7 ? wd.charAt(0).toUpperCase() + wd.slice(1) : fmt.dayMonth(nl.date);
  return (
    <KpiCell
      icon={icon}
      label={t("Keyingi dars")}
      value={nl.time ? `${day}, ${nl.time}` : day}
      sub={[nl.group.course || nl.group.label, roomLabel(nl.group.room)].filter(Boolean).join(" · ")}
    />
  );
}
